// src/routes/checkout.ts — address book and the OpenCart checkout steps:
//   shippingaddress → shippingmethods → paymentaddress → paymentmethods →
//   POST confirm (order overview + payment) → PUT confirm (place order)
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { query, transaction } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { sendOrderConfirmationEmail } from '../lib/mailer';
import { addHistory, loadOrder, orderLink } from '../lib/orders';
import { PaymentGateway } from '../lib/payments';
import { takeStock } from '../lib/products';
import {
  checkStock, computeTotals, findCoupon, loadCartLines, PAYMENT_METHODS, round2, SHIPPING_METHODS,
} from '../lib/pricing';
import { authenticate, customersOnly } from '../middleware/auth';

const required = (message: string) => z.string({ required_error: message, invalid_type_error: message }).trim();

const addressSchema = z.object({
  firstname: required('Please enter a first name.').min(1, 'Please enter a first name.').max(100),
  lastname: required('Please enter a last name.').min(1, 'Please enter a last name.').max(100),
  company: z.string().trim().max(150).default(''),
  address_1: required('Please enter a street address.').min(3, 'Please enter a street address.').max(255),
  address_2: z.string().trim().max(255).default(''),
  city: required('Please enter a city.').min(1, 'Please enter a city.').max(120),
  postcode: z.string().trim().max(20).default(''),
  country: required('Please choose a country.').length(2, 'Please choose a country.').transform((c) => c.toUpperCase()),
  zone: z.string().trim().max(120).default(''),
  telephone: z.string().trim().max(40).default(''),
  default: z.boolean().optional(),
});

const ADDRESS_FIELDS = ['firstname', 'lastname', 'company', 'address_1', 'address_2', 'city', 'postcode', 'country', 'zone', 'telephone'];

export const toContractAddress = (a: any) => ({
  address_id: a.id,
  ...Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, a[f]])),
  default: a.is_default,
});

const loadAddress = async (userId: number, id: number) =>
  (await query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [id, userId])).rows[0];

const listAddresses = async (userId: number) =>
  (await query('SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id', [userId])).rows;

const createAddress = async (userId: number, body: z.infer<typeof addressSchema>) => {
  const isFirst = !(await listAddresses(userId)).length;
  const makeDefault = body.default || isFirst;
  if (makeDefault) await query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
  const { rows } = await query(
    `INSERT INTO addresses (user_id, ${ADDRESS_FIELDS.join(', ')}, is_default)
     VALUES ($1, ${ADDRESS_FIELDS.map((_, i) => `$${i + 2}`).join(', ')}, $${ADDRESS_FIELDS.length + 2}) RETURNING *`,
    [userId, ...ADDRESS_FIELDS.map((f) => (body as any)[f]), makeDefault]
  );
  return rows[0];
};

const setState = (userId: number, fields: Record<string, unknown>) => {
  const keys = Object.keys(fields);
  return query(
    `INSERT INTO checkout_state (user_id, ${keys.join(', ')}) VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')})
     ON CONFLICT (user_id) DO UPDATE SET ${keys.map((k) => `${k} = EXCLUDED.${k}`).join(', ')}, updated_at = now()`,
    [userId, ...keys.map((k) => fields[k])]
  );
};

const getState = async (userId: number) =>
  (await query('SELECT * FROM checkout_state WHERE user_id = $1', [userId])).rows[0] || {};

export const checkoutRoutes = ({ payments }: { payments: PaymentGateway | null }) => {
  const router = Router();
  router.use(
    ['/account/address', '/shippingaddress', '/paymentaddress', '/shippingmethods', '/paymentmethods', '/confirm'],
    authenticate,
    customersOnly
  );

  // ---------- address book (OpenCart: /account/address) ----------
  router.get('/account/address', handler(async (req, res) => {
    ok(res, (await listAddresses(req.auth!.userId)).map(toContractAddress));
  }));

  router.post('/account/address', handler(async (req, res) => {
    const body = parse(addressSchema, req.body);
    if ((await listAddresses(req.auth!.userId)).length >= 20) fail(400, 'You can save up to 20 addresses.');
    ok(res, toContractAddress(await createAddress(req.auth!.userId, body)), 201);
  }));

  router.get('/account/address/:id', handler(async (req, res) => {
    const a = await loadAddress(req.auth!.userId, Number(req.params.id));
    if (!a) fail(404, 'Address not found.');
    ok(res, toContractAddress(a));
  }));

  router.put('/account/address/:id', handler(async (req, res) => {
    const id = Number(req.params.id);
    if (!(await loadAddress(req.auth!.userId, id))) fail(404, 'Address not found.');
    const body = parse(addressSchema, req.body);
    if (body.default) await query('UPDATE addresses SET is_default = false WHERE user_id = $1', [req.auth!.userId]);
    const { rows } = await query(
      `UPDATE addresses SET ${ADDRESS_FIELDS.map((f, i) => `${f} = $${i + 3}`).join(', ')},
         is_default = is_default OR $${ADDRESS_FIELDS.length + 3}
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, req.auth!.userId, ...ADDRESS_FIELDS.map((f) => (body as any)[f]), Boolean(body.default)]
    );
    ok(res, toContractAddress(rows[0]));
  }));

  router.delete('/account/address/:id', handler(async (req, res) => {
    const id = Number(req.params.id);
    const a = await loadAddress(req.auth!.userId, id);
    if (!a) fail(404, 'Address not found.');
    await query('DELETE FROM addresses WHERE id = $1', [id]);
    if (a.is_default) {
      await query(
        `UPDATE addresses SET is_default = true WHERE id = (SELECT id FROM addresses WHERE user_id = $1 ORDER BY id LIMIT 1)`,
        [req.auth!.userId]
      );
    }
    ok(res, true);
  }));

  // ---------- checkout addresses ----------
  for (const kind of ['shipping', 'payment'] as const) {
    const column = `${kind}_address_id`;
    router.get(`/${kind}address`, handler(async (req, res) => {
      const state = await getState(req.auth!.userId);
      const addresses = await listAddresses(req.auth!.userId);
      ok(res, {
        addresses: addresses.map(toContractAddress),
        address_id: state[column] ?? addresses.find((a) => a.is_default)?.id ?? null,
      });
    }));
    // New address: saved to the address book and selected.
    router.post(`/${kind}address`, handler(async (req, res) => {
      const address = await createAddress(req.auth!.userId, parse(addressSchema, req.body));
      await setState(req.auth!.userId, { [column]: address.id });
      ok(res, { address_id: address.id, address: toContractAddress(address) }, 201);
    }));
    router.post(`/${kind}address/existing`, handler(async (req, res) => {
      const { address_id } = parse(z.object({ address_id: z.coerce.number().int().positive('Please choose an address.') }), req.body);
      if (!(await loadAddress(req.auth!.userId, address_id))) fail(404, 'Address not found.');
      await setState(req.auth!.userId, { [column]: address_id });
      ok(res, { address_id });
    }));
  }

  // ---------- methods ----------
  router.get('/shippingmethods', handler(async (req, res) => {
    const state = await getState(req.auth!.userId);
    if (!state.shipping_address_id) fail(400, 'Please choose a delivery address first.');
    const lines = await loadCartLines(req.auth!.userId);
    const coupon = state.coupon_code ? await findCoupon(state.coupon_code) : undefined;
    ok(res, {
      shipping_methods: SHIPPING_METHODS().map((m) => ({
        ...m,
        // Actual price for this cart (standard can be free above the threshold).
        cost: computeTotals(lines, coupon, m.code).shipping,
      })),
      shipping_method: state.shipping_method || null,
    });
  }));

  router.post('/shippingmethods', handler(async (req, res) => {
    const b = parse(z.object({ shipping_method: z.string(), comment: z.string().max(1000).optional() }), req.body);
    if (!SHIPPING_METHODS().some((m) => m.code === b.shipping_method)) fail(400, 'Please choose a delivery option.');
    const state = await getState(req.auth!.userId);
    if (!state.shipping_address_id) fail(400, 'Please choose a delivery address first.');
    await setState(req.auth!.userId, { shipping_method: b.shipping_method, ...(b.comment !== undefined ? { comment: b.comment } : {}) });
    ok(res, { shipping_method: b.shipping_method });
  }));

  router.get('/paymentmethods', handler(async (req, res) => {
    const state = await getState(req.auth!.userId);
    ok(res, { payment_methods: PAYMENT_METHODS(), payment_method: state.payment_method || null });
  }));

  router.post('/paymentmethods', handler(async (req, res) => {
    const b = parse(z.object({ payment_method: z.string(), agree: z.coerce.boolean().optional() }), req.body);
    if (!PAYMENT_METHODS().some((m) => m.code === b.payment_method)) fail(400, 'Please choose a payment method.');
    if (!b.agree) fail(400, 'Please accept the terms and conditions to continue.');
    await setState(req.auth!.userId, { payment_method: b.payment_method });
    ok(res, { payment_method: b.payment_method });
  }));

  // ---------- confirm ----------
  // POST: validates everything, (re)creates the unplaced order and, for cards,
  // a payment for its exact total. Nothing is charged or reserved yet.
  router.post('/confirm', handler(async (req, res) => {
    const userId = req.auth!.userId;
    const state = await getState(userId);
    const lines = await loadCartLines(userId);
    if (!lines.length) fail(400, 'Your cart is empty.');
    checkStock(lines);
    if (!state.shipping_address_id) fail(400, 'Please choose a delivery address.');
    if (!state.shipping_method) fail(400, 'Please choose a delivery option.');
    if (!state.payment_method) fail(400, 'Please choose a payment method.');
    if (!PAYMENT_METHODS().some((m) => m.code === state.payment_method)) fail(400, 'That payment method isn’t available. Please choose another.');
    const shipping = await loadAddress(userId, state.shipping_address_id);
    const billing = (state.payment_address_id && (await loadAddress(userId, state.payment_address_id))) || shipping;
    if (!shipping) fail(400, 'Please choose a delivery address.');
    const coupon = state.coupon_code ? await findCoupon(state.coupon_code) : undefined;
    const totals = computeTotals(lines, coupon, state.shipping_method);
    if (totals.coupon_problem) fail(400, `${totals.coupon_problem} Remove it to continue.`);

    const orderId = await transaction(async (db) => {
      // Replace the previous unplaced order for this checkout, if any.
      if (state.pending_order_id) {
        await db.query('DELETE FROM orders WHERE id = $1 AND user_id = $2 AND placed_at IS NULL', [state.pending_order_id, userId]);
      }
      const { rows } = await db.query(
        `INSERT INTO orders (user_id, email, status, payment_method, shipping_method, shipping_address, payment_address,
           coupon_code, subtotal, discount, shipping_total, tax_total, total, currency, comment)
         VALUES ($1, $2, 'awaiting_payment', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
        [userId, req.auth!.user.email, state.payment_method, state.shipping_method,
          JSON.stringify(toContractAddress(shipping)), JSON.stringify(toContractAddress(billing)),
          totals.coupon?.code ?? null, totals.subtotal, totals.discount, totals.shipping, totals.tax, totals.total,
          config.shop.currency, state.comment || '']
      );
      const id = rows[0].id as number;
      for (const l of lines) {
        await db.query(
          `INSERT INTO order_items (order_id, product_id, variant_id, name, image, options, unit_price, quantity, total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [id, l.product_id, l.variant_id, l.name, l.image, JSON.stringify(l.options), l.unit_price, l.quantity, l.total]
        );
      }
      await db.query('UPDATE checkout_state SET pending_order_id = $2 WHERE user_id = $1', [userId, id]);
      return id;
    });

    let payment: Record<string, unknown> = { method: state.payment_method };
    if (state.payment_method === 'stripe') {
      if (!payments) fail(503, 'Card payments aren’t available right now. Please choose another payment method.');
      const intent = await payments!.createIntent({
        amountCents: Math.round(totals.total * 100), currency: config.shop.currency, orderId, email: req.auth!.user.email,
      });
      await query('UPDATE orders SET payment_reference = $2 WHERE id = $1', [orderId, intent.id]);
      payment = { ...payment, client_secret: intent.clientSecret, publishable_key: config.stripe.publishableKey };
    }
    const loaded = await loadOrder(orderId, { admin: false });
    ok(res, { order: loaded!.contract, payment });
  }));

  // PUT: places the order. Card orders must already be paid (checked with
  // Stripe, never trusted from the browser). Stock is reserved atomically.
  router.put('/confirm', handler(async (req, res) => {
    const userId = req.auth!.userId;
    const state = await getState(userId);
    const pending = state.pending_order_id
      && (await query('SELECT * FROM orders WHERE id = $1 AND user_id = $2 AND placed_at IS NULL', [state.pending_order_id, userId])).rows[0];
    if (!pending) fail(400, 'Please review your order again before placing it.');

    let paymentStatus = 'pending';
    if (pending.payment_method === 'stripe') {
      if (!payments || !pending.payment_reference) fail(400, 'Your card payment wasn’t completed. Please try again.');
      const status = await payments!.getStatus(pending.payment_reference);
      if (status !== 'succeeded') fail(402, 'Your card payment wasn’t completed. Please try again or use another card.');
      paymentStatus = 'paid';
    }

    const placed = await transaction(async (db) => {
      const items = (await db.query('SELECT * FROM order_items WHERE order_id = $1', [pending.id])).rows;
      for (const item of items) {
        if (!(await takeStock(db, item))) {
          fail(409, `Sorry, “${item.name}” sold out while you were checking out. Please update your cart.`);
        }
      }
      if (pending.coupon_code) {
        await db.query('UPDATE coupons SET uses_count = uses_count + 1 WHERE code = $1', [pending.coupon_code]);
      }
      const status = paymentStatus === 'paid' ? 'processing' : 'pending';
      await db.query(
        `UPDATE orders SET status = $2, payment_status = $3, placed_by = $4, placed_at = now(), updated_at = now()
         WHERE id = $1`,
        [pending.id, status, paymentStatus, req.auth!.impersonatorId]
      );
      await addHistory(db, pending.id, status, 'Order placed.', { notified: true, userId });
      await db.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
      await db.query(
        `UPDATE checkout_state SET coupon_code = NULL, pending_order_id = NULL, comment = '' WHERE user_id = $1`,
        [userId]
      );
      return items;
    });

    const loaded = (await loadOrder(pending.id, { userId }))!;
    audit(req, 'order.placed', `order:${pending.id}`, { total: Number(pending.total) });
    sendOrderConfirmationEmail(req.auth!.user.email, {
      id: pending.id,
      total: Number(pending.total),
      currency: pending.currency,
      items: placed.map((i: any) => ({ name: i.name, quantity: i.quantity, total: round2(Number(i.total)) })),
    }, orderLink(pending.id)).catch((error) => console.error('Order email failed:', error));
    ok(res, loaded.contract);
  }));

  return router;
};
