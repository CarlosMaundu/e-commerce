// src/routes/orders.ts — the customer's orders and returns (OpenCart:
// /customerorders, /returns, /order_statuses).
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { loadOrder, ORDER_STATUSES, RETURN_REASONS, toContractOrder } from '../lib/orders';
import { resolveItem } from '../lib/products';
import { authenticate, customersOnly } from '../middleware/auth';
import { buildCart } from './cart';

export const toContractReturn = (r: any) => ({
  return_id: r.id,
  order_id: r.order_id,
  order_product_id: r.order_item_id,
  product: r.product_name,
  image: r.image,
  quantity: r.quantity,
  reason: r.reason,
  reason_name: RETURN_REASONS.find((x) => x.code === r.reason)?.name || r.reason,
  opened: r.opened,
  comment: r.comment,
  status: r.status,
  date_added: r.created_at,
  ...(r.customer_email ? { customer: { email: r.customer_email, name: r.customer_name } } : {}),
});

export const RETURN_SELECT = `
  SELECT r.*, oi.name AS product_name, oi.image
  FROM returns r JOIN order_items oi ON oi.id = r.order_item_id`;

export const orderRoutes = () => {
  const router = Router();

  router.get('/order_statuses', (_req, res) => ok(res, ORDER_STATUSES));
  router.get('/return_reasons', (_req, res) => ok(res, RETURN_REASONS));

  router.use(['/customerorders', '/returns'], authenticate, customersOnly);

  router.get('/customerorders', handler(async (req, res) => {
    const q = parse(
      z.object({
        limit: z.coerce.number().int().min(1).max(50).default(10),
        page: z.coerce.number().int().min(1).default(1),
        status: z.string().optional(),
      }),
      req.query
    );
    const params: unknown[] = [req.auth!.userId];
    let filter = 'o.user_id = $1 AND o.placed_at IS NOT NULL';
    if (q.status) {
      params.push(q.status.split(','));
      filter += ` AND o.status = ANY($${params.length}::text[])`;
    }
    const total = (await query(`SELECT count(*)::int AS n FROM orders o WHERE ${filter}`, params)).rows[0].n;
    params.push(q.limit, (q.page - 1) * q.limit);
    const { rows } = await query(
      `SELECT o.*,
         (SELECT COALESCE(sum(quantity), 0)::int FROM order_items WHERE order_id = o.id) AS item_count,
         (SELECT json_agg(json_build_object('name', name, 'image', image) ORDER BY id) FROM order_items WHERE order_id = o.id) AS preview
       FROM orders o WHERE ${filter}
       ORDER BY o.placed_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.set('X-Total-Count', String(total));
    ok(res, rows.map((o) => ({ ...toContractOrder(o), preview: (o.preview || []).slice(0, 4) })));
  }));

  router.get('/customerorders/:id', handler(async (req, res) => {
    const loaded = await loadOrder(Number(req.params.id), { userId: req.auth!.userId });
    if (!loaded) fail(404, 'Order not found.');
    const returns = (await query(`${RETURN_SELECT} WHERE r.order_id = $1 ORDER BY r.id`, [loaded!.order.id])).rows;
    ok(res, { ...loaded!.contract, returns: returns.map(toContractReturn) });
  }));

  // Adds everything still available from a past order back to the cart.
  router.post('/customerorders/:id/reorder', handler(async (req, res) => {
    const loaded = await loadOrder(Number(req.params.id), { userId: req.auth!.userId });
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
