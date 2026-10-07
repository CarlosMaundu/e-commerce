// src/routes/cart.ts — OpenCart cart, cart_bulk, coupon and wishlist routes.
// Carts belong to signed-in users; the browser keeps a guest cart and merges
// it with POST /cart_bulk on sign-in.
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { fail, handler, ok, parse } from '../lib/http';
import { computeTotals, couponProblem, findCoupon, GiftChoice, giftBoxOf, loadCartLines } from '../lib/pricing';
import { delivery, giftBoxes } from '../lib/delivery';
import { authenticate, customersOnly } from '../middleware/auth';
import { hydrate, PRODUCT_SELECT, ProductRow, resolveItem } from '../lib/products';

// Any of the product's attributes, e.g. { "Color": "Black", "Size": "L" };
// checked against the product in resolveItem.
const optionsSchema = z
  .record(z.union([z.string().max(60), z.number()]))
  .refine((o) => Object.keys(o).length <= 10, 'Too many options.')
  .default({});

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
    products: lines.map((l) => ({ ...l, gift: giftContract(l.gift), in_stock: l.stock >= l.quantity })),
    item_count: lines.reduce((s, l) => s + l.quantity, 0),
    coupon: totals.coupon,
    coupon_problem: totals.coupon_problem,
    shipping_method: state.shipping_method || null,
    gift_options: giftOptions(),
    totals: totals.lines,
    total: totals.total,
  };
};

/** A cart line's gift with its box details. */
const giftContract = (g: GiftChoice | null | undefined) => {
  if (!g) return null;
  const box = giftBoxOf(g);
  return { to: g.to, from: g.from, message: g.message || '', box: box ? { id: box.id, name: box.name, price: box.price, image: box.image } : null };
};

const giftOptions = () => ({
  enabled: delivery().gift.enabled,
  boxes: giftBoxes().map(({ id, name, price, image, description }) => ({ id, name, price, image, description })),
});

const giftSchema = z
  .object({
    to: z.string().trim().min(1, 'Please say who the gift is for.').max(60, 'Keep the name under 60 characters.'),
    from: z.string().trim().min(1, 'Please say who the gift is from.').max(60, 'Keep the name under 60 characters.'),
    message: z.string().trim().max(60, 'Gift messages can be up to 60 characters.').default(''),
    // Which gift box, if any (see Delivery options → Gift options).
    box_id: z.string().trim().max(40).nullable().default(null),
  })
  .nullable();

const addToCart = async (userId: number, item: z.infer<typeof itemSchema>, { merge = false } = {}) => {
  let resolved;
  try {
    resolved = await resolveItem(item.product_id, item.option);
  } catch (error) {
    if (merge) return; // skip guest-cart items that are gone or need a choice
    throw error;
  }
  const existing = (
    await query('SELECT quantity FROM cart_items WHERE user_id = $1 AND product_id = $2 AND options = $3::jsonb', [
      userId, item.product_id, JSON.stringify(resolved.options),
    ])
  ).rows[0];
  const wanted = (existing?.quantity || 0) + item.quantity;
  if (resolved.stock <= 0) {
    if (merge) return; // silently skip unavailable items when merging a guest cart
    fail(409, `“${resolved.name}” is out of stock.`);
  }
  const quantity = Math.min(wanted, resolved.stock, 99);
  if (!merge && wanted > resolved.stock) {
    fail(409, `Only ${resolved.stock} of “${resolved.name}” left${existing ? `, and ${existing.quantity} ${existing.quantity === 1 ? 'is' : 'are'} already in your cart` : ''}.`);
  }
  await query(
    `INSERT INTO cart_items (user_id, product_id, variant_id, quantity, options) VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (user_id, product_id, options) DO UPDATE SET quantity = EXCLUDED.quantity, variant_id = EXCLUDED.variant_id`,
    [userId, item.product_id, resolved.variantId, quantity, JSON.stringify(resolved.options)]
  );
};

export const cartRoutes = () => {
  const router = Router();
  router.use(['/cart', '/cart_bulk', '/coupon', '/wishlist'], authenticate, customersOnly);

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
      const line = (await loadCartLines(req.auth!.userId)).find((l) => l.key === b.key);
      if (!line) fail(404, 'That item is no longer in your cart.');
      if (b.quantity > line!.stock) fail(409, `Only ${line!.stock} of “${line!.name}” left.`);
      await query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [b.quantity, b.key]);
      ok(res, await buildCart(req.auth!.userId));
    })
  );

  // Send a line as a gift (or stop: gift = null).
  router.put(
    '/cart/:key/gift',
    handler(async (req, res) => {
      const gift = parse(giftSchema, req.body?.gift ?? null);
      if (gift && !delivery().gift.enabled) fail(400, 'Gift options aren’t available right now.');
      if (gift?.box_id && !giftBoxes().some((b) => b.id === gift.box_id)) {
        fail(400, 'That gift box isn’t available any more. Please choose another.');
      }
      const { rowCount } = await query('UPDATE cart_items SET gift = $3::jsonb WHERE id = $1 AND user_id = $2', [
        Number(req.params.key), req.auth!.userId, gift ? JSON.stringify(gift) : null,
      ]) as any;
      if (!rowCount) fail(404, 'That item is no longer in your cart.');
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
      ok(res, await hydrate(rows));
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
