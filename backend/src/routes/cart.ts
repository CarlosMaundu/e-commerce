// src/routes/cart.ts — OpenCart cart, cart_bulk, coupon and wishlist routes.
// Carts belong to signed-in users; the browser keeps a guest cart and merges
// it with POST /cart_bulk on sign-in.
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { fail, handler, ok, parse } from '../lib/http';
import { computeTotals, couponProblem, findCoupon, loadCartLines } from '../lib/pricing';
import { authenticate } from '../middleware/auth';
import { PRODUCT_SELECT, ProductRow, toContractProduct } from './catalog';

const optionsSchema = z
  .object({
    size: z.string().trim().max(40).optional(),
    color: z.string().trim().max(40).optional(),
  })
  .default({})
  .transform((o) => {
    // Normalised so the same choice always matches the same cart line.
    const clean: Record<string, string> = {};
    if (o.size) clean.size = o.size;
    if (o.color) clean.color = o.color;
    return clean;
  });

const itemSchema = z.object({
  product_id: z.coerce.number().int().positive('Please choose a product.'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1.').max(99, 'You can add up to 99 at a time.').default(1),
  option: optionsSchema,
});

const checkoutState = async (userId: number) =>
  (await query('SELECT * FROM checkout_state WHERE user_id = $1', [userId])).rows[0] || {};

export const buildCart = async (userId: number) => {
  const lines = await loadCartLines(userId);
  const state = await checkoutState(userId);
  const coupon = state.coupon_code ? await findCoupon(state.coupon_code) : undefined;
  const totals = computeTotals(lines, coupon, state.shipping_method || null);
  return {
    products: lines.map((l) => ({ ...l, in_stock: l.stock >= l.quantity })),
    item_count: lines.reduce((s, l) => s + l.quantity, 0),
    coupon: totals.coupon,
    coupon_problem: totals.coupon_problem,
    shipping_method: state.shipping_method || null,
    totals: totals.lines,
    total: totals.total,
  };
};

const addToCart = async (userId: number, item: z.infer<typeof itemSchema>, { merge = false } = {}) => {
  const product = (await query('SELECT id, name, quantity FROM products WHERE id = $1', [item.product_id])).rows[0];
  if (!product) fail(404, 'That product is no longer available.');
  const existing = (
    await query('SELECT quantity FROM cart_items WHERE user_id = $1 AND product_id = $2 AND options = $3::jsonb', [
      userId, item.product_id, JSON.stringify(item.option),
    ])
  ).rows[0];
  const wanted = (existing?.quantity || 0) + item.quantity;
  if (product.quantity <= 0) {
    if (merge) return; // silently skip unavailable items when merging a guest cart
    fail(409, `“${product.name}” is out of stock.`);
  }
  const quantity = Math.min(wanted, product.quantity, 99);
  if (!merge && wanted > product.quantity) {
    fail(409, `Only ${product.quantity} of “${product.name}” left${existing ? `, and ${existing.quantity} ${existing.quantity === 1 ? 'is' : 'are'} already in your cart` : ''}.`);
  }
  await query(
    `INSERT INTO cart_items (user_id, product_id, quantity, options) VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (user_id, product_id, options) DO UPDATE SET quantity = EXCLUDED.quantity`,
    [userId, item.product_id, quantity, JSON.stringify(item.option)]
  );
};

export const cartRoutes = () => {
  const router = Router();
  router.use(['/cart', '/cart_bulk', '/coupon', '/wishlist'], authenticate);

  router.get('/cart', handler(async (req, res) => ok(res, await buildCart(req.auth!.userId))));

  router.post(
    '/cart',
    handler(async (req, res) => {
      await addToCart(req.auth!.userId, parse(itemSchema, req.body));
      ok(res, await buildCart(req.auth!.userId));
    })
  );

  router.post(
    '/cart_bulk',
    handler(async (req, res) => {
      const items = parse(z.array(itemSchema).max(100, 'Too many items at once.'), req.body);
      for (const item of items) await addToCart(req.auth!.userId, item, { merge: true });
      ok(res, await buildCart(req.auth!.userId));
    })
  );

  router.put(
    '/cart',
    handler(async (req, res) => {
      const b = parse(
        z.object({
          key: z.coerce.number().int().positive(),
          quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1.').max(99, 'You can order up to 99.'),
        }),
        req.body
      );
      const line = (
        await query(
          `SELECT ci.id, p.quantity AS stock, p.name FROM cart_items ci JOIN products p ON p.id = ci.product_id
           WHERE ci.id = $1 AND ci.user_id = $2`,
          [b.key, req.auth!.userId]
        )
      ).rows[0];
      if (!line) fail(404, 'That item is no longer in your cart.');
      if (b.quantity > line.stock) fail(409, `Only ${line.stock} of “${line.name}” left.`);
      await query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [b.quantity, b.key]);
      ok(res, await buildCart(req.auth!.userId));
    })
  );

  router.delete(
    '/cart/empty',
    handler(async (req, res) => {
      await query('DELETE FROM cart_items WHERE user_id = $1', [req.auth!.userId]);
      ok(res, await buildCart(req.auth!.userId));
    })
  );

  router.delete(
    '/cart/:key',
    handler(async (req, res) => {
      await query('DELETE FROM cart_items WHERE id = $1 AND user_id = $2', [Number(req.params.key), req.auth!.userId]);
      ok(res, await buildCart(req.auth!.userId));
    })
  );

  // ---------- coupon ----------
  router.post(
    '/coupon',
    handler(async (req, res) => {
      const { coupon: code } = parse(
        z.object({ coupon: z.string().trim().min(1, 'Please enter a promo code.').max(40) }),
        req.body
      );
      const lines = await loadCartLines(req.auth!.userId);
      if (!lines.length) fail(400, 'Add something to your cart before using a promo code.');
      const coupon = await findCoupon(code);
      const problem = couponProblem(coupon, computeTotals(lines, undefined, null).subtotal);
      if (problem) fail(400, problem);
      await query(
        `INSERT INTO checkout_state (user_id, coupon_code) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET coupon_code = EXCLUDED.coupon_code, updated_at = now()`,
        [req.auth!.userId, coupon!.code]
      );
      ok(res, await buildCart(req.auth!.userId));
    })
  );

  router.delete(
    '/coupon',
    handler(async (req, res) => {
      await query('UPDATE checkout_state SET coupon_code = NULL WHERE user_id = $1', [req.auth!.userId]);
      ok(res, await buildCart(req.auth!.userId));
    })
  );

  // ---------- wishlist ----------
  router.get(
    '/wishlist',
    handler(async (req, res) => {
      const { rows } = await query<ProductRow>(
        `${PRODUCT_SELECT} JOIN wishlist_items w ON w.product_id = p.id
         WHERE w.user_id = $1 ORDER BY w.created_at DESC`,
        [req.auth!.userId]
      );
      ok(res, rows.map(toContractProduct));
    })
  );

  router.post(
    '/wishlist/:id',
    handler(async (req, res) => {
      const id = Number(req.params.id);
      if (!(await query('SELECT 1 FROM products WHERE id = $1', [id])).rows[0]) {
        fail(404, 'That product is no longer available.');
      }
      await query(
        'INSERT INTO wishlist_items (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.auth!.userId, id]
      );
      ok(res, { product_id: id, in_wishlist: true });
    })
  );

  router.delete(
    '/wishlist/:id',
    handler(async (req, res) => {
      const id = Number(req.params.id);
      await query('DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2', [req.auth!.userId, id]);
      ok(res, { product_id: id, in_wishlist: false });
    })
  );

  return router;
};
