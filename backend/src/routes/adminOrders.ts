// src/routes/adminOrders.ts — order management, returns and dashboard figures.
import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { sendOrderStatusEmail } from '../lib/mailer';
import { addHistory, loadOrder, NEXT_STATUSES, orderLink, restock, statusName, toContractOrder } from '../lib/orders';
import { PaymentGateway } from '../lib/payments';
import { attentionCounts, OVERVIEW_PERIODS, storeOverview } from '../lib/overview';
import { round2 } from '../lib/pricing';
import { issueInvoice, recordPayment, refundable, voidInvoice } from '../lib/accounting';
import { createRefund } from '../lib/refunds';
import { hasPermission } from '../lib/users';
import { authenticate, requirePermission } from '../middleware/auth';
import { RETURN_SELECT, toContractReturn } from './orders';

export const adminOrderRoutes = ({ payments }: { payments: PaymentGateway | null }) => {
  const router = Router();
  router.use(['/orders', '/orderhistory', '/returns', '/dashboard', '/notifications'], authenticate);

  router.get('/orders', requirePermission('orders.orders.view'), handler(async (req, res) => {
    const q = parse(
      z.object({
        status: z.string().optional(),
        search: z.string().trim().max(100).optional(),
        payment_status: z.string().optional(),
        shipping_method: z.string().optional(),
        payment_method: z.string().optional(),
        days: z.coerce.number().int().min(1).max(3650).optional(),
        customer: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        page: z.coerce.number().int().min(1).default(1),
      }),
      req.query
    );
    const params: unknown[] = [];
    const where = ['o.placed_at IS NOT NULL'];
    if (q.customer) {
      params.push(q.customer);
      where.push(`o.user_id = $${params.length}`);
    }
    if (q.status) {
      params.push(q.status.split(','));
      where.push(`o.status = ANY($${params.length}::text[])`);
    }
    if (q.search) {
      params.push(`%${q.search}%`);
      where.push(`(o.email ILIKE $${params.length} OR o.id::text = $${params.length + 1}
        OR (u.firstname || ' ' || u.lastname) ILIKE $${params.length})`);
      params.push(q.search.replace(/^#/, ''));
    }
    for (const key of ['payment_status', 'shipping_method', 'payment_method'] as const) {
      if (q[key]) {
        params.push(q[key]!.split(','));
        where.push(`o.${key} = ANY($${params.length}::text[])`);
      }
    }
    if (q.days) {
      params.push(q.days);
      where.push(`o.placed_at >= now() - make_interval(days => $${params.length})`);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const base = 'FROM orders o LEFT JOIN users u ON u.id = o.user_id';
    const total = (await query(`SELECT count(*)::int AS n ${base} ${whereSql}`, params)).rows[0].n;
    params.push(q.limit, (q.page - 1) * q.limit);
    const { rows } = await query(
      `SELECT o.*, TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')) AS customer_name,
         (SELECT COALESCE(sum(quantity), 0)::int FROM order_items WHERE order_id = o.id) AS item_count,
         (SELECT json_agg(json_build_object('name', name, 'image', image) ORDER BY id) FROM order_items WHERE order_id = o.id) AS preview
       ${base} ${whereSql} ORDER BY o.placed_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.set('X-Total-Count', String(total));
    ok(res, rows.map((o) => ({ ...toContractOrder(o, [], [], { admin: true }), preview: (o.preview || []).slice(0, 4) })));
  }));

  router.get('/orders/:id', requirePermission('orders.orders.view'), handler(async (req, res) => {
    const loaded = await loadOrder(Number(req.params.id), { admin: true });
    if (!loaded || !loaded.order.placed_at) fail(404, 'Order not found.');
    ok(res, loaded!.contract);
  }));

  // OpenCart: PUT /orderhistory/{id} { order_status, notify, comment }
  router.put('/orderhistory/:id', requirePermission('orders.orders.update'), handler(async (req, res) => {
    const b = parse(
      z.object({
        order_status: z.string().min(1, 'Please choose a status.'),
        notify: z.coerce.boolean().default(false),
        comment: z.string().trim().max(2000).default(''),
      }),
      req.body
    );
    const loaded = await loadOrder(Number(req.params.id), { admin: true });
    if (!loaded || !loaded.order.placed_at) fail(404, 'Order not found.');
    const order = loaded!.order;
    if (b.order_status !== order.status && !(NEXT_STATUSES[order.status] || []).includes(b.order_status)) {
      fail(400, `An order that is ${statusName(order.status).toLowerCase()} can’t be moved to ${statusName(b.order_status).toLowerCase()}.`);
    }
    const changing = b.order_status !== order.status;
    if (!changing && !b.comment) fail(400, 'Choose a new status or add a comment.');
    if (changing && b.order_status === 'refunded' && !hasPermission(req.auth!.permissions, 'orders.orders.refund')) {
      fail(403, 'You don’t have permission to refund orders.');
    }

    await transaction(async (db) => {
      if (changing) {
        await db.query('UPDATE orders SET status = $2, updated_at = now() WHERE id = $1', [order.id, b.order_status]);
        if (b.order_status === 'cancelled') await restock(db, order.id);
        // Money and the ledger follow the status.
        const invoice = (await db.query('SELECT * FROM invoices WHERE order_id = $1', [order.id])).rows[0]
          || (await issueInvoice(db, order, { by: req.auth!.userId }));
        const outstanding = Number(invoice.total) - Number(invoice.amount_paid);
        if (b.order_status === 'delivered' && order.payment_method === 'cod' && outstanding > 0.009) {
          await recordPayment(db, {
            invoice, method: 'cod', amount: outstanding, reference: `COD-${order.id}`,
            note: 'Cash collected on delivery', by: req.auth!.userId,
          });
        }
        if (['cancelled', 'refunded'].includes(b.order_status) && Number(invoice.amount_paid) === 0) {
          await voidInvoice(db, invoice, { by: req.auth!.userId });
        } else if (b.order_status === 'refunded') {
          const left = await refundable(db, invoice);
          if (left.amount > 0.009) {
            await createRefund(db, {
              order: { ...order, status: b.order_status },
              itemsAmount: Number(invoice.total) - Number(invoice.shipping),
              includeDelivery: true,
              applyFee: false,
              reason: b.comment || 'Order refunded',
              by: req.auth!.userId,
              canApprove: true,
              gateway: payments,
            });
          }
        }
      }
      await addHistory(db, order.id, b.order_status, b.comment, { notified: b.notify, userId: req.auth!.userId });
    });

    if (b.notify) {
      sendOrderStatusEmail(order.email, order.id, statusName(b.order_status), b.comment, orderLink(order.id))
        .catch((error) => console.error('Status email failed:', error));
    }
    audit(req, 'order.status_changed', `order:${order.id}`, { from: order.status, to: b.order_status });
    ok(res, (await loadOrder(order.id, { admin: true }))!.contract);
  }));

  router.get('/returns', requirePermission('orders.returns.view'), handler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const customer = Number(req.query.customer) || 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (status) {
      params.push(status);
      where.push(`r.status = $${params.length}`);
    }
    if (customer) {
      params.push(customer);
      where.push(`r.user_id = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT r.*, oi.name AS product_name, oi.image, u.email AS customer_email,
         TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')) AS customer_name
       FROM returns r JOIN order_items oi ON oi.id = r.order_item_id LEFT JOIN users u ON u.id = r.user_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.created_at DESC LIMIT 200`,
      params
    );
    ok(res, rows.map(toContractReturn));
  }));

  router.put('/returns/:id', requirePermission('orders.returns.update'), handler(async (req, res) => {
    const { status } = parse(
      z.object({ status: z.enum(['approved', 'rejected', 'refunded'], { errorMap: () => ({ message: 'Please choose a valid status.' }) }) }),
      req.body
    );
    const row = (await query(`${RETURN_SELECT} WHERE r.id = $1`, [Number(req.params.id)])).rows[0];
    if (!row) fail(404, 'Return not found.');
    const allowed: Record<string, string[]> = { requested: ['approved', 'rejected'], approved: ['refunded'] };
    if (!(allowed[row.status] || []).includes(status)) fail(400, `A ${row.status} return can’t be marked ${status}.`);
    if (status === 'refunded') {
      // Pay back the returned items (less any restocking fee) and post it.
      if (!hasPermission(req.auth!.permissions, 'orders.orders.refund')) {
        fail(403, 'You don’t have permission to refund orders.');
      }
      await transaction(async (db) => {
        const item = (await db.query('SELECT * FROM order_items WHERE id = $1', [row.order_item_id])).rows[0];
        const order = (await db.query('SELECT * FROM orders WHERE id = $1', [row.order_id])).rows[0];
        await createRefund(db, {
          order,
          itemsAmount: round2(Number(item.unit_price) * Number(row.quantity)),
          includeDelivery: false,
          reason: `Return #${row.id}: ${row.reason}`,
          returnId: row.id,
          by: req.auth!.userId,
          canApprove: hasPermission(req.auth!.permissions, 'admin.refunds.approve'),
          gateway: payments,
        });
        await db.query('UPDATE returns SET status = $2, updated_at = now() WHERE id = $1', [row.id, status]);
      });
    } else {
      await query('UPDATE returns SET status = $2, updated_at = now() WHERE id = $1', [row.id, status]);
    }
    audit(req, 'order.return_updated', `return:${row.id}`, { status });
    ok(res, toContractReturn((await query(`${RETURN_SELECT} WHERE r.id = $1`, [row.id])).rows[0]));
  }));

  // The back-office "Store overview": GET /admin/dashboard?days=7|30|90.
  router.get('/dashboard', requirePermission('dashboard.overview.view'), handler(async (req, res) => {
    const days = Number(req.query.days) || 30;
    if (!(OVERVIEW_PERIODS as readonly number[]).includes(days)) fail(400, 'Please choose 7, 30 or 90 days, 6 months or 12 months.');
    ok(res, await storeOverview(days));
  }));

  // Counts for the back-office bell and the Orders badge; each one only for
  // staff who may see that area.
  router.get('/notifications', handler(async (req, res) => {
    const user = req.auth!.permissions;
    const c = await attentionCounts();
    const orders = hasPermission(user, 'orders.orders.view');
    const returns = hasPermission(user, 'orders.returns.view');
    const stock = hasPermission(user, 'catalog.products.view');
    ok(res, {
      to_fulfil: orders ? c.to_fulfil : null,
      delayed: orders ? c.delayed : null,
      open_returns: returns ? c.open_returns : null,
      low_stock: stock ? c.low_stock : null,
      out_of_stock: stock ? c.out_of_stock : null,
    });
  }));

  return router;
};
