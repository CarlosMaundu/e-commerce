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
        limit: z.coerce.number().int().min(1).max(100).default(20),
        page: z.coerce.number().int().min(1).default(1),
      }),
      req.query
    );
    const params: unknown[] = [];
    const where = ['o.placed_at IS NOT NULL'];
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
         (SELECT COALESCE(sum(quantity), 0)::int FROM order_items WHERE order_id = o.id) AS item_count
       ${base} ${whereSql} ORDER BY o.placed_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.set('X-Total-Count', String(total));
    ok(res, rows.map((o) => toContractOrder(o, [], [], { admin: true })));
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

    if (changing && b.order_status === 'refunded' && order.payment_status === 'paid' && order.payment_method === 'stripe') {
      if (!payments) fail(503, 'Card refunds aren’t available right now.');
      await payments!.refund(order.payment_reference);
    }

    await transaction(async (db) => {
      if (changing) {
        const paymentStatus =
          b.order_status === 'refunded' ? 'refunded'
            : b.order_status === 'delivered' && order.payment_method === 'cod' ? 'paid'
              : order.payment_status;
        await db.query('UPDATE orders SET status = $2, payment_status = $3, updated_at = now() WHERE id = $1', [
          order.id, b.order_status, paymentStatus,
        ]);
        if (b.order_status === 'cancelled') await restock(db, order.id);
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
    const { rows } = await query(
      `SELECT r.*, oi.name AS product_name, oi.image, u.email AS customer_email,
         TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')) AS customer_name
       FROM returns r JOIN order_items oi ON oi.id = r.order_item_id LEFT JOIN users u ON u.id = r.user_id
       ${status ? 'WHERE r.status = $1' : ''} ORDER BY r.created_at DESC LIMIT 200`,
      status ? [status] : []
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
    await query('UPDATE returns SET status = $2, updated_at = now() WHERE id = $1', [row.id, status]);
    audit(req, 'order.return_updated', `return:${row.id}`, { status });
    ok(res, toContractReturn((await query(`${RETURN_SELECT} WHERE r.id = $1`, [row.id])).rows[0]));
  }));

  // The back-office "Store overview": GET /admin/dashboard?days=7|30|90.
  router.get('/dashboard', requirePermission('dashboard.overview.view'), handler(async (req, res) => {
    const days = Number(req.query.days) || 30;
    if (!(OVERVIEW_PERIODS as readonly number[]).includes(days)) fail(400, 'Please choose 7, 30 or 90 days.');
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
