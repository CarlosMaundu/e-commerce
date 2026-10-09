// src/routes/adminOrders.ts — order management, returns and dashboard figures.
import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { sendOrderStatusEmail } from '../lib/mailer';
import { addHistory, loadOrder, orderRef, NEXT_STATUSES, orderLink, restock, statusName, toContractOrder } from '../lib/orders';
import { PaymentGateway } from '../lib/payments';
import { attentionCounts, OVERVIEW_PERIODS, storeOverview } from '../lib/overview';
import { round2 } from '../lib/pricing';
import { issueInvoice, recordPayment, refundable, voidInvoice } from '../lib/accounting';
import { createRefund } from '../lib/refunds';
import { hasPermission } from '../lib/users';
import { authenticate, requirePermission } from '../middleware/auth';
import { RETURN_SELECT, toContractReturn } from './orders';
import { putBack } from '../lib/products';
import { DELIVERED_AT_SQL, orderSlaSummary } from '../lib/sla';
import {
  clearNotifications,
  dismissNotification,
  markNotificationsRead,
  staffNotifications,
} from '../lib/notifications';
import { cashReceipt } from '../lib/numbers';

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
        // A date range (inclusive, East Africa Time), e.g. 2026-09-01.
        date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-09-01.').optional(),
        date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-09-30.').optional(),
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
      where.push(`(o.email ILIKE $${params.length} OR o.number ILIKE $${params.length} OR o.id::text = $${params.length + 1}
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
    if (q.date_from) {
      params.push(q.date_from);
      where.push(`o.placed_at >= ($${params.length}::date)::timestamp AT TIME ZONE 'Africa/Nairobi'`);
    }
    if (q.date_to) {
      params.push(q.date_to);
      where.push(`o.placed_at < ($${params.length}::date + 1)::timestamp AT TIME ZONE 'Africa/Nairobi'`);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const base = 'FROM orders o LEFT JOIN users u ON u.id = o.user_id';
    const total = (await query(`SELECT count(*)::int AS n ${base} ${whereSql}`, params)).rows[0].n;
    params.push(q.limit, (q.page - 1) * q.limit);
    const { rows } = await query(
      `SELECT o.*, (SELECT number FROM invoices WHERE order_id = o.id) AS invoice_number, TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')) AS customer_name,
         (SELECT COALESCE(sum(quantity), 0)::int FROM order_items WHERE order_id = o.id) AS item_count,
         ${DELIVERED_AT_SQL} AS delivered_at,
         (SELECT json_agg(json_build_object('name', name, 'image', image) ORDER BY id) FROM order_items WHERE order_id = o.id) AS preview
       ${base} ${whereSql} ORDER BY o.placed_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.set('X-Total-Count', String(total));
    ok(res, rows.map((o) => ({
      ...toContractOrder(o, [], [], { admin: true }),
      preview: (o.preview || []).slice(0, 4),
      sla: orderSlaSummary(o),
    })));
  }));

  router.get('/orders/:id', requirePermission('orders.orders.view'), handler(async (req, res) => {
    const loaded = await loadOrder(orderRef(req.params.id), { admin: true });
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
    const loaded = await loadOrder(orderRef(req.params.id), { admin: true });
    if (!loaded || !loaded.order.placed_at) fail(404, 'Order not found.');
    const order = loaded!.order;
    if (b.order_status !== order.status && !(NEXT_STATUSES[order.status] || []).includes(b.order_status)) {
      fail(400, `An order that is ${statusName(order.status).toLowerCase()} can’t be moved to ${statusName(b.order_status).toLowerCase()}.`);
    }
    const changing = b.order_status !== order.status;
    if (!changing && !b.comment) fail(400, 'Choose a new status or add a comment.');
    // Gift instructions must be carried out before an order leaves.
    if (changing && b.order_status === 'shipped') {
      const open = loaded!.items.filter((i: any) => i.gift && !i.gift.done);
      if (open.length) {
        fail(400, `Prepare the gift${open.length > 1 ? 's' : ''} for ${open.map((i: any) => `“${i.name}”`).join(', ')} and tick ${open.length > 1 ? 'them' : 'it'} off before dispatch.`);
      }
    }
    if (changing && b.order_status === 'refunded' && !hasPermission(req.auth!.permissions, 'orders.orders.refund')) {
      fail(403, 'You don’t have permission to refund orders.');
    }

    // A paid order only becomes "Refunded" once its money has gone back:
    // straight away, or (above the approval limit) when the refund is approved.
    let refundPending: { amount: number } | null = null;
    await transaction(async (db) => {
      let status = b.order_status;
      let comment = b.comment;
      if (changing) {
        const invoice = (await db.query('SELECT * FROM invoices WHERE order_id = $1', [order.id])).rows[0]
          || (await issueInvoice(db, order, { by: req.auth!.userId }));
        if (b.order_status === 'refunded' && Number(invoice.amount_paid) > 0) {
          const left = await refundable(db, invoice);
          if (left.amount > 0.009) {
            const refund = await createRefund(db, {
              order: { ...order, status: b.order_status },
              itemsAmount: Number(invoice.total) - Number(invoice.shipping),
              includeDelivery: true,
              applyFee: false,
              reason: b.comment || 'Order refunded',
              by: req.auth!.userId,
              gateway: payments,
              closesOrder: true,
            });
            if (refund.status === 'pending_approval') {
              refundPending = { amount: Number(refund.amount) };
              status = order.status;
              comment = `Full refund of ${order.currency} ${Number(refund.amount).toFixed(2)} requested; waiting for approval.${
                b.comment ? ` ${b.comment}` : ''}`;
            }
          }
        }
        if (status !== order.status) {
          await db.query('UPDATE orders SET status = $2, updated_at = now() WHERE id = $1', [order.id, status]);
          if (status === 'cancelled') await restock(db, order.id);
          // Money and the ledger follow the status.
          const outstanding = Number(invoice.total) - Number(invoice.amount_paid);
          if (status === 'delivered' && order.payment_method === 'cod' && outstanding > 0.009) {
            await recordPayment(db, {
              invoice, method: 'cod', amount: outstanding, reference: cashReceipt(),
              note: 'Cash collected on delivery', by: req.auth!.userId,
            });
          }
          if (['cancelled', 'refunded'].includes(status) && Number(invoice.amount_paid) === 0) {
            await voidInvoice(db, invoice, { by: req.auth!.userId });
          }
        }
      }
      await addHistory(db, order.id, status, comment, {
        notified: b.notify && !refundPending, userId: req.auth!.userId,
      });
    });

    if (b.notify && !refundPending) {
      sendOrderStatusEmail(order.email, order.number, statusName(b.order_status), b.comment, orderLink(order.id))
        .catch((error) => console.error('Status email failed:', error));
    }
    audit(req, refundPending ? 'order.refund_requested' : 'order.status_changed', `order:${order.id}`,
      { from: order.status, to: b.order_status });
    ok(res, { ...(await loadOrder(order.id, { admin: true }))!.contract, refund_pending: refundPending });
  }));

  // Tick off (or reopen) a gift line's instructions: wrapped, message printed.
  router.put('/orders/:id/items/:itemId/gift', requirePermission('orders.orders.update'), handler(async (req, res) => {
    const { done } = parse(z.object({ done: z.coerce.boolean() }), req.body);
    const item = (await query('SELECT * FROM order_items WHERE id = $1 AND order_id = $2', [
      Number(req.params.itemId), Number(req.params.id),
    ])).rows[0];
    if (!item?.gift) fail(404, 'That item isn’t being sent as a gift.');
    const gift = done
      ? { ...item.gift, done: true, done_at: new Date().toISOString(), done_by: req.auth!.user.email }
      : { ...item.gift, done: false, done_at: null, done_by: null };
    await query('UPDATE order_items SET gift = $2::jsonb WHERE id = $1', [item.id, JSON.stringify(gift)]);
    audit(req, done ? 'order.gift_prepared' : 'order.gift_reopened', `order:${item.order_id}`, { item: item.id });
    ok(res, (await loadOrder(item.order_id, { admin: true }))!.contract);
  }));

  // Returns: GET /returns?status=&search=&customer=&days=&page=&limit=
  router.get('/returns', requirePermission('orders.returns.view'), handler(async (req, res) => {
    const q = parse(
      z.object({
        status: z.string().optional(),
        search: z.string().trim().max(100).optional(),
        customer: z.coerce.number().int().positive().optional(),
        days: z.coerce.number().int().min(1).max(3660).optional(),
        limit: z.coerce.number().int().min(1).max(200).default(200),
        page: z.coerce.number().int().min(1).default(1),
      }),
      req.query
    );
    const params: unknown[] = [];
    const where: string[] = [];
    if (q.status) {
      params.push(q.status.split(','));
      where.push(`r.status = ANY($${params.length}::text[])`);
    }
    if (q.customer) {
      params.push(q.customer);
      where.push(`r.user_id = $${params.length}`);
    }
    if (q.days) {
      params.push(q.days);
      where.push(`r.created_at >= now() - make_interval(days => $${params.length})`);
    }
    if (q.search) {
      params.push(`%${q.search.replace(/^#/, '')}%`);
      where.push(`(oi.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR r.order_id::text ILIKE $${params.length}
        OR EXISTS (SELECT 1 FROM orders x WHERE x.id = r.order_id AND x.number ILIKE $${params.length})
        OR r.id::text ILIKE $${params.length} OR (u.firstname || ' ' || u.lastname) ILIKE $${params.length})`);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const from = `FROM returns r JOIN order_items oi ON oi.id = r.order_item_id LEFT JOIN users u ON u.id = r.user_id`;
    const total = (await query(`SELECT count(*)::int AS n ${from} ${w}`, params)).rows[0].n;
    const counts = Object.fromEntries((await query(
      `SELECT r.status, count(*)::int AS n ${from} ${where.filter((x) => !x.startsWith('r.status')).length
        ? `WHERE ${where.filter((x) => !x.startsWith('r.status')).join(' AND ')}` : ''} GROUP BY r.status`,
      q.status ? params.slice(1) : params
    )).rows.map((r) => [r.status, r.n]));
    params.push(q.limit, (q.page - 1) * q.limit);
    const { rows } = await query(
      `${RETURN_SELECT.replace('FROM returns r', `, u.email AS customer_email,
         TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')) AS customer_name FROM returns r`)}
       LEFT JOIN users u ON u.id = r.user_id
       ${w} ORDER BY r.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.set('X-Total-Count', String(total));
    if (req.query.page) return ok(res, { returns: rows.map(toContractReturn), total, counts });
    ok(res, rows.map(toContractReturn));
  }));

  router.put('/returns/:id', requirePermission('orders.returns.update'), handler(async (req, res) => {
    const { status, restock } = parse(
      z.object({
        status: z.enum(['approved', 'received', 'rejected', 'refunded'], { errorMap: () => ({ message: 'Please choose a valid status.' }) }),
        // On receipt: whether the item goes back on sale.
        restock: z.coerce.boolean().default(true),
      }),
      req.body
    );
    const row = (await query(`${RETURN_SELECT} WHERE r.id = $1`, [Number(req.params.id)])).rows[0];
    if (!row) fail(404, 'Return not found.');
    // requested → approved (send it back) → received (checked in) → refunded.
    const allowed: Record<string, string[]> = {
      requested: ['approved', 'rejected'],
      approved: ['received', 'rejected'],
      received: ['refunded', 'rejected'],
    };
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
          gateway: payments,
        });
        await db.query('UPDATE returns SET status = $2, updated_at = now() WHERE id = $1', [row.id, status]);
      });
    } else if (status === 'received') {
      await transaction(async (db) => {
        if (restock) {
          const item = (await db.query('SELECT * FROM order_items WHERE id = $1', [row.order_item_id])).rows[0];
          await putBack(db, item, row.quantity);
        }
        await db.query(`UPDATE returns SET status = 'received', received_at = now(), updated_at = now() WHERE id = $1`, [row.id]);
      });
    } else {
      await query('UPDATE returns SET status = $2, updated_at = now() WHERE id = $1', [row.id, status]);
    }
    audit(req, 'order.return_updated', `return:${row.id}`, { status, ...(status === 'received' ? { restock } : {}) });
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
    const support = hasPermission(user, 'support.tickets.view');
    const supportOpen = support
      ? (await query(`SELECT count(*)::int AS n FROM support_tickets WHERE status = 'open'`)).rows[0].n
      : null;
    ok(res, {
      ...(await staffNotifications(req.auth!.userId, user, req.query.all ? 500 : 10)),
      to_fulfil: orders ? c.to_fulfil : null,
      delayed: orders ? c.delayed : null,
      open_returns: returns ? c.open_returns : null,
      low_stock: stock ? c.low_stock : null,
      out_of_stock: stock ? c.out_of_stock : null,
      support_open: supportOpen,
    });
  }));

  router.post('/notifications/read', handler(async (req, res) => {
    await markNotificationsRead(req.auth!.userId);
    ok(res, { read: true });
  }));
  router.post('/notifications/clear', handler(async (req, res) => {
    await clearNotifications(req.auth!.userId);
    ok(res, { cleared: true });
  }));
  router.delete('/notifications/:key', handler(async (req, res) => {
    await dismissNotification(req.auth!.userId, String(req.params.key));
    ok(res, { dismissed: true });
  }));

  return router;
};
