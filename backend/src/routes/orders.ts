// src/routes/orders.ts — the customer's orders and returns (OpenCart:
// /customerorders, /returns, /order_statuses).
import { Router } from 'express';
import { getRefundSettings } from '../lib/refunds';
import { z } from 'zod';
import { query } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { loadOrder, orderRef, ORDER_STATUSES, RETURN_REASONS, toContractOrder } from '../lib/orders';
import { resolveItem } from '../lib/products';
import { authenticate, customersOnly } from '../middleware/auth';
import { buildCart } from './cart';

export const toContractReturn = (r: any) => ({
  return_id: r.id,
  order_id: r.order_id,
  order_number: r.order_number,
  order_product_id: r.order_item_id,
  product: r.product_name,
  image: r.image,
  quantity: r.quantity,
  reason: r.reason,
  reason_name: RETURN_REASONS.find((x) => x.code === r.reason)?.name || r.reason,
  opened: r.opened,
  comment: r.comment,
  status: r.status,
  status_name: RETURN_STATUS_NAMES[r.status] || r.status,
  amount: r.unit_price !== undefined ? Number(r.unit_price) * r.quantity : undefined,
  received_at: r.received_at || null,
  // The refund it led to, if any.
  refund: r.refund_id
    ? { refund_id: r.refund_id, status: r.refund_status, amount: Number(r.refund_amount), method: r.refund_method }
    : null,
  date_added: r.created_at,
  date_modified: r.updated_at,
  ...(r.customer_email ? { customer: { email: r.customer_email, name: r.customer_name } } : {}),
});

export const RETURN_STATUS_NAMES: Record<string, string> = {
  requested: 'Requested',
  approved: 'Approved — awaiting the item',
  received: 'Item received',
  rejected: 'Rejected',
  refunded: 'Refunded',
};

export const RETURN_SELECT = `
  SELECT r.*, oi.name AS product_name, oi.image, oi.unit_price, oi.options,
    (SELECT number FROM orders WHERE id = r.order_id) AS order_number,
    rf.id AS refund_id, rf.status AS refund_status, rf.amount AS refund_amount, rf.method AS refund_method
  FROM returns r JOIN order_items oi ON oi.id = r.order_item_id
  LEFT JOIN LATERAL (
    SELECT id, status, amount, method FROM refunds WHERE return_id = r.id ORDER BY id DESC LIMIT 1
  ) rf ON true`;

export const orderRoutes = () => {
  const router = Router();

  router.get('/order_statuses', (_req, res) => ok(res, ORDER_STATUSES));
  router.get('/return_reasons', (_req, res) => ok(res, RETURN_REASONS));

  router.use(['/customerorders', '/returns', '/refunds'], authenticate, customersOnly);

  router.get('/customerorders', handler(async (req, res) => {
    const q = parse(
      z.object({
        limit: z.coerce.number().int().min(1).max(50).default(10),
        page: z.coerce.number().int().min(1).default(1),
        status: z.string().optional(),
        // Orders placed in the last N days.
        days: z.coerce.number().int().min(1).max(3660).optional(),
      }),
      req.query
    );
    const params: unknown[] = [req.auth!.userId];
    let filter = 'o.user_id = $1 AND o.placed_at IS NOT NULL';
    if (q.status) {
      params.push(q.status.split(','));
      filter += ` AND o.status = ANY($${params.length}::text[])`;
    }
    if (q.days) {
      params.push(q.days);
      filter += ` AND o.placed_at >= now() - make_interval(days => $${params.length})`;
    }
    const total = (await query(`SELECT count(*)::int AS n FROM orders o WHERE ${filter}`, params)).rows[0].n;
    params.push(q.limit, (q.page - 1) * q.limit);
    const { rows } = await query(
      `SELECT o.*, (SELECT number FROM invoices WHERE order_id = o.id) AS invoice_number,
         (SELECT COALESCE(sum(quantity), 0)::int FROM order_items WHERE order_id = o.id) AS item_count,
         (SELECT json_agg(json_build_object('name', name, 'image', image, 'options', options, 'quantity', quantity,
            'price', unit_price, 'total', total, 'product_id', product_id) ORDER BY id)
          FROM order_items WHERE order_id = o.id) AS preview
       FROM orders o WHERE ${filter}
       ORDER BY o.placed_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.set('X-Total-Count', String(total));
    ok(res, rows.map((o) => ({ ...toContractOrder(o), preview: (o.preview || []).slice(0, 10) })));
  }));

  router.get('/customerorders/:id', handler(async (req, res) => {
    const loaded = await loadOrder(orderRef(req.params.id), { userId: req.auth!.userId });
    if (!loaded) fail(404, 'Order not found.');
    const returns = (await query(`${RETURN_SELECT} WHERE r.order_id = $1 ORDER BY r.id`, [loaded!.order.id])).rows;
    ok(res, { ...loaded!.contract, returns: returns.map(toContractReturn) });
  }));

  // Adds everything still available from a past order back to the cart.
  router.post('/customerorders/:id/reorder', handler(async (req, res) => {
    const loaded = await loadOrder(orderRef(req.params.id), { userId: req.auth!.userId });
    if (!loaded) fail(404, 'Order not found.');
    let added = 0;
    for (const item of loaded!.items) {
      if (!item.product_id) continue;
      const resolved = await resolveItem(item.product_id, item.options).catch(() => null);
      if (!resolved || resolved.stock <= 0) continue;
      const cap = Math.min(resolved.stock, 99);
      await query(
        `INSERT INTO cart_items (user_id, product_id, variant_id, quantity, options) VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (user_id, product_id, options)
         DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, $6), variant_id = EXCLUDED.variant_id`,
        [req.auth!.userId, item.product_id, resolved.variantId, Math.min(item.quantity, cap), JSON.stringify(resolved.options), cap]
      );
      added += 1;
    }
    if (!added) fail(409, 'None of the items in this order are available any more.');
    ok(res, { added, skipped: loaded!.items.length - added, cart: await buildCart(req.auth!.userId) });
  }));

  // The customer's refunds: what was paid back (or is being approved), how,
  // and for which order or return.
  router.get('/refunds', handler(async (req, res) => {
    const { rows } = await query(
      `SELECT r.id, r.order_id, r.return_id, r.status, r.amount, r.items_amount, r.delivery_amount, r.restocking_fee,
         r.method, r.reference, r.created_at, r.processed_at, o.number AS order_number, o.currency,
         i.number AS invoice_number, oi.name AS product, oi.image
       FROM refunds r JOIN orders o ON o.id = r.order_id
       LEFT JOIN invoices i ON i.id = r.invoice_id
       LEFT JOIN returns rt ON rt.id = r.return_id
       LEFT JOIN order_items oi ON oi.id = rt.order_item_id
       WHERE o.user_id = $1 AND r.status IN ('processed', 'pending_approval', 'failed')
       ORDER BY r.created_at DESC`,
      [req.auth!.userId]
    );
    ok(res, rows.map((r) => ({
      refund_id: r.id,
      order_id: r.order_id,
      order_number: r.order_number,
      invoice_number: r.invoice_number,
      return_id: r.return_id,
      product: r.product || null,
      image: r.image || null,
      // Customers see "on its way" rather than internal approval steps.
      status: r.status === 'processed' ? 'refunded' : r.status === 'failed' ? 'failed' : 'processing',
      amount: Number(r.amount),
      items_amount: Number(r.items_amount),
      delivery_amount: Number(r.delivery_amount),
      restocking_fee: Number(r.restocking_fee),
      method: r.method,
      reference: r.status === 'processed' ? r.reference : '',
      currency: r.currency,
      date_added: r.created_at,
      date_processed: r.processed_at,
    })));
  }));

  router.get('/returns', handler(async (req, res) => {
    const { rows } = await query(`${RETURN_SELECT} WHERE r.user_id = $1 ORDER BY r.created_at DESC`, [req.auth!.userId]);
    ok(res, rows.map(toContractReturn));
  }));

  router.get('/returns/:id', handler(async (req, res) => {
    const row = (await query(`${RETURN_SELECT} WHERE r.id = $1 AND r.user_id = $2`, [Number(req.params.id), req.auth!.userId])).rows[0];
    if (!row) fail(404, 'Return not found.');
    ok(res, toContractReturn(row));
  }));

  router.post('/returns', handler(async (req, res) => {
    const b = parse(
      z.object({
        order_id: z.coerce.number().int().positive(),
        order_product_id: z.coerce.number().int().positive('Please choose the item to return.'),
        quantity: z.coerce.number().int().min(1, 'Please return at least one item.'),
        reason: z.enum(RETURN_REASONS.map((r) => r.code) as [string, ...string[]], {
          errorMap: () => ({ message: 'Please choose a reason for the return.' }),
        }),
        opened: z.coerce.boolean().default(false),
        comment: z.string().trim().max(1000).default(''),
      }),
      req.body
    );
    const loaded = await loadOrder(b.order_id, { userId: req.auth!.userId });
    if (!loaded) fail(404, 'Order not found.');
    if (loaded!.order.status !== 'delivered') fail(400, 'You can return items once your order has been delivered.');
    const { return_window_days: windowDays } = await getRefundSettings();
    if (windowDays > 0) {
      const delivered = loaded!.history.filter((h: any) => h.status === 'delivered').pop();
      const since = delivered ? (Date.now() - new Date(delivered.created_at).getTime()) / 86400000 : 0;
      if (since > windowDays) fail(400, `Returns are accepted within ${windowDays} days of delivery.`);
    }
    const item = loaded!.items.find((i: any) => i.id === b.order_product_id);
    if (!item) fail(400, 'That item isn’t part of this order.');
    const already = Number(
      (await query(
        `SELECT COALESCE(sum(quantity), 0) AS n FROM returns WHERE order_item_id = $1 AND status <> 'rejected'`,
        [item.id]
      )).rows[0].n
    );
    if (b.quantity > item.quantity - already) {
      fail(400, already ? `You can return up to ${item.quantity - already} more of this item.` : `You ordered ${item.quantity} of this item.`);
    }
    const { rows } = await query(
      `INSERT INTO returns (order_id, order_item_id, user_id, quantity, reason, opened, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [b.order_id, item.id, req.auth!.userId, b.quantity, b.reason, b.opened, b.comment]
    );
    audit(req, 'order.return_requested', `return:${rows[0].id}`, { order_id: b.order_id });
    const row = (await query(`${RETURN_SELECT} WHERE r.id = $1`, [rows[0].id])).rows[0];
    ok(res, toContractReturn(row), 201);
  }));

  return router;
};
