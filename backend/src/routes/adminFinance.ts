// src/routes/adminFinance.ts — /api/admin: orders placed by staff for a
// customer, order edits, invoices, payments, refunds (with approval),
// refund settings and the ledger.
import { Router } from 'express';
import { insertNumbered, orderNumber } from '../lib/numbers';
import { z } from 'zod';
import { query, transaction } from '../db';
import {
  ACCOUNTS,
  Db,
  issueInvoice,
  post,
  recordPayment,
  refundable,
} from '../lib/accounting';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { addHistory, loadOrder, restock } from '../lib/orders';
import { PaymentGateway } from '../lib/payments';
import { computeTotals, round2, SHIPPING_METHODS } from '../lib/pricing';
import { takeStock } from '../lib/products';
import {
  createRefund,
  getRefundSettings,
  payOut,
  refundSettingsSchema,
  saveRefundSettings,
  toContractRefund,
} from '../lib/refunds';
import { hasPermission } from '../lib/users';
import { finance } from '../lib/finance';
import { authenticate, requirePermission } from '../middleware/auth';
import { toContractAddress } from './checkout';

const METHOD = z.enum(['stripe', 'cod', 'cash', 'mpesa', 'bank'], {
  errorMap: () => ({ message: 'Please choose how it was paid.' }),
});

const addressBody = z.object({
  firstname: z.string().trim().min(1, 'Please enter a first name.').max(100),
  lastname: z.string().trim().min(1, 'Please enter a last name.').max(100),
  company: z.string().trim().max(150).default(''),
  address_1: z.string().trim().min(3, 'Please enter a street address.').max(255),
  address_2: z.string().trim().max(255).default(''),
  city: z.string().trim().min(1, 'Please enter a city.').max(120),
  postcode: z.string().trim().max(20).default(''),
  country: z.string().trim().length(2).toUpperCase().default('KE'),
  zone: z.string().trim().max(120).default(''),
  telephone: z.string().trim().max(40).default(''),
});

const itemBody = z.object({
  product_id: z.coerce.number().int().positive(),
  variant_id: z.coerce.number().int().positive().nullable().optional(),
  quantity: z.coerce.number().int().min(1, 'Quantities start at 1.').max(999),
});

/** Order lines priced from the catalogue, like a cart. */
const priceItems = async (db: Db, items: z.infer<typeof itemBody>[]) => {
  const lines = [];
  for (const [i, it] of items.entries()) {
    const p = (await db.query('SELECT * FROM products WHERE id = $1', [it.product_id])).rows[0];
    if (!p) fail(400, 'One of the products no longer exists.');
    let v: any = null;
    if (it.variant_id) {
      v = (await db.query('SELECT * FROM product_variants WHERE id = $1 AND product_id = $2', [it.variant_id, p.id])).rows[0];
      if (!v) fail(400, `Please choose an option of “${p.name}”.`);
    } else if ((p.attributes || []).length) {
      fail(400, `Please choose the options for “${p.name}”.`);
    }
    const own = v && v.price !== null;
    const price = Number(own ? v.price : p.price);
    const rawSpecial = own ? v.special : p.special;
    const unit = rawSpecial === null || rawSpecial === undefined ? price : Number(rawSpecial);
    lines.push({
      key: i,
      product_id: p.id,
      variant_id: v?.id ?? null,
      name: p.name,
      image: (v?.images && v.images[0]) || p.images[0] || '',
      options: v?.options || {},
      quantity: it.quantity,
      price,
      special: rawSpecial === null || rawSpecial === undefined ? null : Number(rawSpecial),
      unit_price: unit,
      total: round2(unit * it.quantity),
      stock: 0,
    });
  }
  return lines;
};

const insertItems = async (db: Db, orderId: number, lines: any[]) => {
  for (const l of lines) {
    const ok2 = await takeStock(db, { product_id: l.product_id, variant_id: l.variant_id, quantity: l.quantity });
    if (!ok2) fail(409, `There isn’t enough stock of “${l.name}”${Object.keys(l.options).length ? ` (${Object.values(l.options).join(' / ')})` : ''}.`);
    await db.query(
      `INSERT INTO order_items (order_id, product_id, variant_id, name, image, options, unit_price, quantity, total, gift)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [orderId, l.product_id, l.variant_id, l.name, l.image, JSON.stringify(l.options), l.unit_price, l.quantity, l.total,
        l.gift ? JSON.stringify(l.gift) : null]
    );
  }
};

/** Reverses an unpaid invoice's sale and posts it again at the order's new totals. */
const reissue = async (db: Db, invoice: any, order: any, by: number) => {
  if (Number(invoice.amount_paid) > 0) fail(400, 'This order has payments, so its items can’t change. Refund instead.');
  const old = { total: Number(invoice.total), shipping: Number(invoice.shipping), tax: Number(invoice.tax) };
  await post(
    db,
    [
      { account: 'sales', debit: round2(old.total - old.shipping - old.tax) },
      { account: 'vat_payable', debit: old.tax },
      { account: 'delivery_income', debit: old.shipping },
      { account: 'receivables', credit: old.total },
    ],
    { orderId: order.id, invoiceId: invoice.id, currency: invoice.currency, memo: `Order edited: ${invoice.number} reversed`, by }
  );
  const n = { total: Number(order.total), shipping: Number(order.shipping_total), tax: Number(order.tax_total) };
  await post(
    db,
    [
      { account: 'receivables', debit: n.total },
      { account: 'sales', credit: round2(n.total - n.shipping - n.tax) },
      { account: 'vat_payable', credit: n.tax },
      { account: 'delivery_income', credit: n.shipping },
    ],
    { orderId: order.id, invoiceId: invoice.id, currency: invoice.currency, memo: `Order edited: ${invoice.number} reissued`, by }
  );
  await db.query(
    `UPDATE invoices SET subtotal = $2, discount = $3, shipping = $4, tax = $5, total = $6, updated_at = now() WHERE id = $1`,
    [invoice.id, order.subtotal, order.discount, order.shipping_total, order.tax_total, order.total]
  );
};

const INVOICE_SELECT = `
  SELECT i.*, o.status AS order_status, o.payment_method, o.email, o.number AS order_number,
    TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')) AS customer_name
  FROM invoices i JOIN orders o ON o.id = i.order_id LEFT JOIN users u ON u.id = i.user_id`;

const toContractInvoice = (i: any) => ({
  invoice_id: i.id,
  number: i.number,
  order_id: i.order_id,
  order_number: i.order_number,
  status: i.status,
  customer: { customer_id: i.user_id, name: i.customer_name || '', email: i.email },
  subtotal: Number(i.subtotal),
  discount: Number(i.discount),
  shipping: Number(i.shipping),
  tax: Number(i.tax),
  total: Number(i.total),
  amount_paid: Number(i.amount_paid),
  amount_refunded: Number(i.amount_refunded),
  balance: round2(Number(i.total) - Number(i.amount_paid)),
  currency: i.currency,
  payment_method: i.payment_method,
  issued_at: i.issued_at,
  due_at: i.due_at,
  notes: i.notes,
});

const toContractPayment = (p: any) => ({
  payment_id: p.id,
  kind: p.kind,
  method: p.method,
  status: p.status,
  amount: Number(p.amount),
  currency: p.currency,
  reference: p.reference,
  order_id: p.order_id,
  order_number: p.order_number ?? undefined,
  invoice_id: p.invoice_id,
  invoice_number: p.invoice_number ?? undefined,
  refund_id: p.refund_id,
  customer: { customer_id: p.user_id, name: p.customer_name || '', email: p.customer_email || '' },
  note: p.note,
  recorded_by: p.recorded_by_name || null,
  received_at: p.received_at,
});

const JOURNAL_KINDS = { sale: 'Sale', payment: 'Payment', refund: 'Refund', void: 'Cancelled invoice', adjustment: 'Adjustment' };
const METHOD_WORDS: Record<string, string> = { stripe: 'card', cod: 'cash on delivery', cash: 'cash', mpesa: 'M-Pesa', bank: 'bank transfer' };

/** What a journal means, in words anyone can follow. */
const describeJournal = (j: any) => {
  const who = j.customer_name || 'a customer';
  const order = j.order_number ? ` (order ${j.order_number})` : '';
  switch (j.kind) {
    case 'sale':
      return `Sold goods to ${who}${order}; they now owe us for invoice ${j.invoice_number || ''}`.trim();
    case 'payment':
      return `${who} paid${j.payment_method ? ` by ${METHOD_WORDS[j.payment_method] || j.payment_method}` : ''}${order}`;
    case 'refund':
      return `Gave money back to ${who}${j.refund_method ? ` by ${METHOD_WORDS[j.refund_method] || j.refund_method}` : ''}${order}`;
    case 'void':
      return `Cancelled invoice ${j.invoice_number || ''}${order}; nothing is owed any more`;
    default:
      return j.memo || 'Adjustment';
  }
};

const listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.string().optional(),
  days: z.coerce.number().int().min(1).max(3660).optional(),
  customer: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  page: z.coerce.number().int().min(1).default(1),
});

export const adminFinanceRoutes = ({ payments }: { payments: PaymentGateway | null }) => {
  const router = Router();
  router.use(['/orders', '/invoices', '/payments', '/refunds', '/refund-settings', '/ledger', '/delivery-options'], authenticate);

  // Delivery options that are switched on, for staff placing orders.
  router.get('/delivery-options', requirePermission('orders.orders.create'), handler(async (_req, res) => {
    ok(res, SHIPPING_METHODS());
  }));

  // ---------- create an order for a customer ----------
  router.post('/orders', requirePermission('orders.orders.create'), handler(async (req, res) => {
    const b = parse(
      z.object({
        customer_id: z.coerce.number().int().positive({ message: 'Please choose a customer.' }),
        items: z.array(itemBody).min(1, 'Add at least one product.').max(100),
        address_id: z.coerce.number().int().positive().optional(),
        address: addressBody.optional(),
        shipping_method: z.string().min(1, 'Please choose a delivery option.'),
        payment_method: z.enum(['cod', 'invoice'], { errorMap: () => ({ message: 'Please choose how they’ll pay.' }) }),
        due_days: z.coerce.number().int().min(0).max(120).default(7),
        comment: z.string().trim().max(1000).default(''),
        notes: z.string().trim().max(1000).default(''),
        payment: z
          .object({ method: METHOD, amount: z.coerce.number().positive(), reference: z.string().trim().max(120).default('') })
          .optional(),
      }),
      req.body
    );
    const customer = (await query('SELECT id, email FROM users WHERE id = $1', [b.customer_id])).rows[0];
    if (!customer) fail(400, 'That customer doesn’t exist.');
    if (!SHIPPING_METHODS().some((m) => m.code === b.shipping_method)) fail(400, 'That delivery option isn’t available.');
    let address: any = null;
    if (b.address_id) {
      address = (await query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [b.address_id, customer.id])).rows[0];
      if (!address) fail(400, 'Please choose one of the customer’s addresses.');
      address = toContractAddress(address);
    } else if (b.address) {
      address = b.address;
    } else fail(400, 'Please give a delivery address.');

    const orderId = await transaction(async (db) => {
      const lines = await priceItems(db, b.items);
      const totals = computeTotals(lines as any, undefined, b.shipping_method);
      const rows = await insertNumbered(() => orderNumber('STF'), async (number) => (await db.query(
        `INSERT INTO orders (user_id, email, status, payment_method, payment_status, shipping_method, shipping_address,
           payment_address, subtotal, discount, shipping_total, tax_total, total, currency, comment, placed_at, created_by, number)
         VALUES ($1, $2, 'pending', $3, 'pending', $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, now(), $13, $14)
         ON CONFLICT (number) DO NOTHING RETURNING *`,
        [customer.id, customer.email, b.payment_method, b.shipping_method, JSON.stringify(address), totals.subtotal,
          totals.discount, totals.shipping, totals.tax, totals.total, finance().currency, b.comment, req.auth!.userId,
          number]
      )).rows);
      const order = rows[0];
      await insertItems(db, order.id, lines);
      await addHistory(db, order.id, 'pending', 'Order created by staff.', { notified: false, userId: req.auth!.userId });
      const invoice = await issueInvoice(db, order, { by: req.auth!.userId, dueDays: b.due_days, notes: b.notes });
      if (b.payment) {
        await recordPayment(db, { invoice, ...b.payment, by: req.auth!.userId, note: 'Recorded when the order was created' });
      }
      return order.id as number;
    });
    audit(req, 'order.created_by_staff', `order:${orderId}`, { customer: customer.id });
    ok(res, (await loadOrder(orderId, { admin: true }))!.contract, 201);
  }));

  // ---------- edit an order ----------
  router.put('/orders/:id', requirePermission('orders.orders.update'), handler(async (req, res) => {
    const b = parse(
      z.object({
        shipping_address: addressBody.optional(),
        payment_address: addressBody.optional(),
        comment: z.string().trim().max(1000).optional(),
        shipping_method: z.string().optional(),
        items: z.array(itemBody).min(1, 'An order needs at least one item.').max(100).optional(),
      }),
      req.body
    );
    const id = Number(req.params.id);
    await transaction(async (db) => {
      const order = (await db.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!order || !order.placed_at) fail(404, 'Order not found.');
      const changesMoney = b.items !== undefined || (b.shipping_method && b.shipping_method !== order.shipping_method);
      if (changesMoney && !['pending', 'awaiting_payment', 'processing'].includes(order.status)) {
        fail(400, 'Items and delivery can only change before the order ships.');
      }
      if (b.shipping_method && !SHIPPING_METHODS().some((m) => m.code === b.shipping_method)) {
        fail(400, 'That delivery option isn’t available.');
      }
      const sets: string[] = [];
      const params: unknown[] = [id];
      const set = (col: string, v: unknown) => {
        params.push(v);
        sets.push(`${col} = $${params.length}`);
      };
      if (b.shipping_address) set('shipping_address', JSON.stringify(b.shipping_address));
      if (b.payment_address) set('payment_address', JSON.stringify(b.payment_address));
      if (b.comment !== undefined) set('comment', b.comment);
      if (b.shipping_method) set('shipping_method', b.shipping_method);
      if (changesMoney) {
        let lines;
        if (b.items) {
          // Keep gift instructions on lines that stay in the order.
          const gifts = new Map(
            (await db.query('SELECT product_id, variant_id, gift FROM order_items WHERE order_id = $1 AND gift IS NOT NULL', [id]))
              .rows.map((r: any) => [`${r.product_id}:${r.variant_id}`, r.gift])
          );
          await restock(db, id);
          await db.query('DELETE FROM order_items WHERE order_id = $1', [id]);
          lines = (await priceItems(db, b.items)).map((l: any) => ({ ...l, gift: gifts.get(`${l.product_id}:${l.variant_id}`) || null }));
          await insertItems(db, id, lines);
        } else {
          lines = (await db.query('SELECT * FROM order_items WHERE order_id = $1', [id])).rows.map((r: any) => ({
            ...r, total: Number(r.total), quantity: r.quantity, unit_price: Number(r.unit_price),
          }));
        }
        const coupon = order.coupon_code
          ? (await db.query('SELECT * FROM coupons WHERE code = $1', [order.coupon_code])).rows[0]
          : undefined;
        const t = computeTotals(lines as any, coupon, b.shipping_method || order.shipping_method);
        set('subtotal', t.subtotal);
        set('discount', t.discount);
        set('shipping_total', t.shipping);
        set('gift_total', t.gift);
        set('tax_total', t.tax);
        set('total', t.total);
      }
      if (!sets.length) fail(400, 'Nothing to change.');
      await db.query(`UPDATE orders SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, params);
      if (changesMoney) {
        const updated = (await db.query('SELECT * FROM orders WHERE id = $1', [id])).rows[0];
        const invoice = (await db.query('SELECT * FROM invoices WHERE order_id = $1', [id])).rows[0];
        if (invoice) await reissue(db, invoice, updated, req.auth!.userId);
      }
      await addHistory(db, id, order.status, 'Order edited by staff.', { notified: false, userId: req.auth!.userId });
    });
    audit(req, 'order.edited', `order:${id}`, { fields: Object.keys(req.body || {}) });
    ok(res, (await loadOrder(id, { admin: true }))!.contract);
  }));

  // ---------- money on one order ----------
  router.get('/orders/:id/finance', requirePermission('orders.invoices.view'), handler(async (req, res) => {
    const id = Number(req.params.id);
    const invoice = (await query(`${INVOICE_SELECT} WHERE i.order_id = $1`, [id])).rows[0];
    const pays = (await query(
      `SELECT p.*, TRIM(COALESCE(r.firstname, '') || ' ' || COALESCE(r.lastname, '')) AS recorded_by_name
       FROM payments p LEFT JOIN users r ON r.id = p.recorded_by WHERE p.order_id = $1 ORDER BY p.received_at`, [id]
    )).rows;
    const refunds = (await query('SELECT * FROM refunds WHERE order_id = $1 ORDER BY created_at', [id])).rows;
    const left = invoice ? await refundable({ query: (t, p) => query(t, p) }, invoice) : { amount: 0, delivery: 0 };
    ok(res, {
      invoice: invoice ? toContractInvoice(invoice) : null,
      payments: pays.map(toContractPayment),
      refunds: refunds.map(toContractRefund),
      refundable: left,
      refund_settings: await getRefundSettings(),
    });
  }));

  // ---------- invoices ----------
  router.get('/invoices', requirePermission('orders.invoices.view'), handler(async (req, res) => {
    const q = parse(listQuery, req.query);
    const params: unknown[] = [];
    const where: string[] = [];
    if (q.status) {
      params.push(q.status.split(','));
      where.push(`i.status = ANY($${params.length}::text[])`);
    }
    if (q.customer) {
      params.push(q.customer);
      where.push(`i.user_id = $${params.length}`);
    }
    if (q.days) {
      params.push(q.days);
      where.push(`i.issued_at >= now() - make_interval(days => $${params.length})`);
    }
    if (q.search) {
      params.push(`%${q.search.replace(/^#/, '')}%`);
      where.push(`(i.number ILIKE $${params.length} OR o.email ILIKE $${params.length}
        OR (u.firstname || ' ' || u.lastname) ILIKE $${params.length} OR o.id::text ILIKE $${params.length}
        OR o.number ILIKE $${params.length})`);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const base = `FROM invoices i JOIN orders o ON o.id = i.order_id LEFT JOIN users u ON u.id = i.user_id ${w}`;
    const total = (await query(`SELECT count(*)::int AS n ${base}`, params)).rows[0].n;
    const sums = (await query(
      `SELECT COALESCE(sum(i.total), 0) AS billed, COALESCE(sum(i.amount_paid), 0) AS paid,
         COALESCE(sum(CASE WHEN i.status IN ('issued', 'partially_paid') THEN i.total - i.amount_paid END), 0) AS outstanding
       ${base}`, params
    )).rows[0];
    params.push(q.limit, (q.page - 1) * q.limit);
    const rows = (await query(
      `${INVOICE_SELECT} ${w} ORDER BY i.issued_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params
    )).rows;
    res.set('X-Total-Count', String(total));
    ok(res, {
      invoices: rows.map(toContractInvoice),
      total,
      summary: { billed: round2(Number(sums.billed)), paid: round2(Number(sums.paid)), outstanding: round2(Number(sums.outstanding)) },
    });
  }));

  router.get('/invoices/:id', requirePermission('orders.invoices.view'), handler(async (req, res) => {
    const invoice = (await query(`${INVOICE_SELECT} WHERE i.id = $1`, [Number(req.params.id)])).rows[0];
    if (!invoice) fail(404, 'Invoice not found.');
    const loaded = await loadOrder(invoice.order_id, { admin: true });
    const pays = (await query('SELECT * FROM payments WHERE invoice_id = $1 ORDER BY received_at', [invoice.id])).rows;
    ok(res, { invoice: toContractInvoice(invoice), order: loaded!.contract, payments: pays.map(toContractPayment) });
  }));

  router.post('/invoices/:id/payments', requirePermission('orders.payments.record'), handler(async (req, res) => {
    const b = parse(
      z.object({
        method: METHOD,
        amount: z.coerce.number({ invalid_type_error: 'Please enter the amount.' }).positive('Please enter an amount greater than zero.'),
        reference: z.string().trim().max(120).default(''),
        received_at: z.coerce.date().optional(),
        note: z.string().trim().max(500).default(''),
      }),
      req.body
    );
    if (b.method === 'stripe') fail(400, 'Card payments are recorded by Stripe at checkout.');
    if (['mpesa', 'bank'].includes(b.method) && !b.reference) fail(400, 'Please enter the transaction reference.');
    const payment = await transaction(async (db) => {
      const invoice = (await db.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [Number(req.params.id)])).rows[0];
      if (!invoice) fail(404, 'Invoice not found.');
      return recordPayment(db, { invoice, method: b.method, amount: b.amount, reference: b.reference, note: b.note,
        at: b.received_at ?? null, by: req.auth!.userId });
    });
    audit(req, 'payment.recorded', `payment:${payment.id}`, { amount: b.amount, method: b.method });
    ok(res, toContractPayment(payment), 201);
  }));

  // ---------- payments ----------
  router.get('/payments', requirePermission('orders.invoices.view'), handler(async (req, res) => {
    const q = parse(
      listQuery.extend({ kind: z.enum(['payment', 'refund']).optional(), method: z.string().optional() }),
      req.query
    );
    const params: unknown[] = [];
    const where: string[] = [];
    if (q.kind) {
      params.push(q.kind);
      where.push(`p.kind = $${params.length}`);
    }
    if (q.method) {
      params.push(q.method.split(','));
      where.push(`p.method = ANY($${params.length}::text[])`);
    }
    if (q.customer) {
      params.push(q.customer);
      where.push(`p.user_id = $${params.length}`);
    }
    if (q.days) {
      params.push(q.days);
      where.push(`p.received_at >= now() - make_interval(days => $${params.length})`);
    }
    if (q.search) {
      params.push(`%${q.search.replace(/^#/, '')}%`);
      where.push(`(p.reference ILIKE $${params.length} OR i.number ILIKE $${params.length} OR p.order_id::text ILIKE $${params.length}
        OR EXISTS (SELECT 1 FROM orders x WHERE x.id = p.order_id AND x.number ILIKE $${params.length})
        OR (u.firstname || ' ' || u.lastname) ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const base = `FROM payments p LEFT JOIN invoices i ON i.id = p.invoice_id LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN users r ON r.id = p.recorded_by ${w}`;
    const total = (await query(`SELECT count(*)::int AS n ${base}`, params)).rows[0].n;
    const sums = (await query(
      `SELECT COALESCE(sum(p.amount) FILTER (WHERE p.kind = 'payment'), 0) AS received,
         COALESCE(sum(p.amount) FILTER (WHERE p.kind = 'refund'), 0) AS refunded ${base}`, params
    )).rows[0];
    params.push(q.limit, (q.page - 1) * q.limit);
    const rows = (await query(
      `SELECT p.*, i.number AS invoice_number, u.email AS customer_email,
         (SELECT number FROM orders WHERE id = p.order_id) AS order_number,
         TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')) AS customer_name,
         NULLIF(TRIM(COALESCE(r.firstname, '') || ' ' || COALESCE(r.lastname, '')), '') AS recorded_by_name
       ${base} ORDER BY p.received_at DESC, p.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params
    )).rows;
    res.set('X-Total-Count', String(total));
    ok(res, {
      payments: rows.map(toContractPayment),
      total,
      summary: {
        received: round2(Number(sums.received)),
        refunded: round2(Number(sums.refunded)),
        net: round2(Number(sums.received) - Number(sums.refunded)),
      },
    });
  }));

  // ---------- refunds ----------
  router.post('/orders/:id/refunds', requirePermission('orders.orders.refund'), handler(async (req, res) => {
    const b = parse(
      z.object({
        items_amount: z.coerce.number({ invalid_type_error: 'Please enter an amount.' }).min(0),
        include_delivery: z.boolean().optional(),
        apply_fee: z.boolean().default(true),
        reason: z.string().trim().min(3, 'Please say why you’re refunding.').max(500),
        method: METHOD.optional(),
      }),
      req.body
    );
    const refund = await transaction(async (db) => {
      const order = (await db.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [Number(req.params.id)])).rows[0];
      if (!order || !order.placed_at) fail(404, 'Order not found.');
      const r = await createRefund(db, {
        order, itemsAmount: b.items_amount, includeDelivery: b.include_delivery, applyFee: b.apply_fee, reason: b.reason,
        method: b.method, by: req.auth!.userId,
        gateway: payments,
      });
      await addHistory(db, order.id, order.status,
        r.status === 'processed' ? `Refunded ${Number(r.amount).toFixed(2)}: ${b.reason}` : `Refund of ${Number(r.amount).toFixed(2)} waiting for approval.`,
        { notified: false, userId: req.auth!.userId });
      return r;
    });
    audit(req, 'refund.created', `refund:${refund.id}`, { amount: Number(refund.amount), status: refund.status });
    ok(res, toContractRefund(refund), 201);
  }));

  // GET /refunds?status=&search=&method=&days=&page=&limit= → { refunds, total, counts }
  router.get('/refunds', requirePermission('orders.invoices.view'), handler(async (req, res) => {
    const q = parse(listQuery.extend({ method: z.string().optional() }), req.query);
    const params: unknown[] = [];
    const where: string[] = [];
    if (q.method) {
      params.push(q.method.split(','));
      where.push(`r.method = ANY($${params.length}::text[])`);
    }
    if (q.customer) {
      params.push(q.customer);
      where.push(`o.user_id = $${params.length}`);
    }
    if (q.days) {
      params.push(q.days);
      where.push(`r.created_at >= now() - make_interval(days => $${params.length})`);
    }
    if (q.search) {
      params.push(`%${q.search.replace(/^#/, '')}%`);
      where.push(`(i.number ILIKE $${params.length} OR o.id::text ILIKE $${params.length} OR o.number ILIKE $${params.length}
        OR r.reference ILIKE $${params.length}
        OR r.reason ILIKE $${params.length} OR (u.firstname || ' ' || u.lastname) ILIKE $${params.length})`);
    }
    const from = `FROM refunds r JOIN orders o ON o.id = r.order_id LEFT JOIN invoices i ON i.id = r.invoice_id
       LEFT JOIN users u ON u.id = o.user_id`;
    // Counts per status (for the tabs) ignore the status filter itself.
    const counts = Object.fromEntries((await query(
      `SELECT r.status, count(*)::int AS n ${from} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} GROUP BY r.status`,
      params
    )).rows.map((r) => [r.status, r.n]));
    if (q.status) {
      params.push(q.status.split(','));
      where.push(`r.status = ANY($${params.length}::text[])`);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (await query(`SELECT count(*)::int AS n ${from} ${w}`, params)).rows[0].n;
    params.push(q.limit, (q.page - 1) * q.limit);
    const rows = (await query(
      `SELECT r.*, i.number AS invoice_number, o.user_id, o.number AS order_number,
         TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')) AS customer_name,
         NULLIF(TRIM(COALESCE(q.firstname, '') || ' ' || COALESCE(q.lastname, '')), '') AS requested_by_name,
         NULLIF(TRIM(COALESCE(a.firstname, '') || ' ' || COALESCE(a.lastname, '')), '') AS approved_by_name
       ${from} LEFT JOIN users q ON q.id = r.requested_by LEFT JOIN users a ON a.id = r.approved_by
       ${w} ORDER BY r.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )).rows;
    res.set('X-Total-Count', String(total));
    ok(res, { refunds: rows.map(toContractRefund), total, counts });
  }));

  router.put('/refunds/:id', requirePermission('admin.refunds.approve'), handler(async (req, res) => {
    const b = parse(z.object({ action: z.enum(['approve', 'reject']) }), req.body);
    const refund = await transaction(async (db) => {
      const r = (await db.query('SELECT * FROM refunds WHERE id = $1 FOR UPDATE', [Number(req.params.id)])).rows[0];
      if (!r) fail(404, 'Refund not found.');
      if (r.status !== 'pending_approval') fail(400, 'This refund has already been decided.');
      const order = (await db.query('SELECT * FROM orders WHERE id = $1', [r.order_id])).rows[0];
      const money = `${order.currency} ${Number(r.amount).toFixed(2)}`;
      if (b.action === 'reject') {
        await db.query(`UPDATE refunds SET status = 'rejected', approved_by = $2 WHERE id = $1`, [r.id, req.auth!.userId]);
        // The order keeps its status: no money went back.
        if (r.closes_order) {
          await addHistory(db, order.id, order.status, `Refund of ${money} was not approved.`, { userId: req.auth!.userId });
        }
      } else {
        await db.query('UPDATE refunds SET approved_by = $2 WHERE id = $1', [r.id, req.auth!.userId]);
        const invoice = (await db.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [r.invoice_id])).rows[0];
        await payOut(db, r, invoice, order, payments, req.auth!.userId);
        // A full refund requested by moving the order to Refunded completes it now.
        if (r.closes_order && order.status !== 'refunded') {
          await db.query(`UPDATE orders SET status = 'refunded', updated_at = now() WHERE id = $1`, [order.id]);
          await addHistory(db, order.id, 'refunded', `Refund of ${money} approved and paid back.`, { userId: req.auth!.userId });
        }
      }
      return (await db.query('SELECT * FROM refunds WHERE id = $1', [r.id])).rows[0];
    });
    audit(req, `refund.${b.action === 'approve' ? 'approved' : 'rejected'}`, `refund:${refund.id}`, {});
    ok(res, toContractRefund(refund));
  }));

  // ---------- refund settings ----------
  router.get('/refund-settings', requirePermission('admin.refunds.manage'), handler(async (_req, res) => {
    ok(res, { settings: await getRefundSettings() });
  }));
  router.put('/refund-settings', requirePermission('admin.refunds.manage'), handler(async (req, res) => {
    const merged = parse(refundSettingsSchema, { ...(await getRefundSettings()), ...(req.body || {}) });
    await saveRefundSettings(merged, req.auth!.userId);
    audit(req, 'admin.refund_settings_updated', 'refund_settings', { fields: Object.keys(req.body || {}) });
    ok(res, { settings: merged });
  }));

  // ---------- ledger ----------
  router.get('/ledger', requirePermission('admin.ledger.view'), handler(async (req, res) => {
    const q = parse(
      z.object({
        days: z.coerce.number().int().min(1).max(3660).optional(),
        account: z.string().optional(),
        kind: z.string().optional(),
        search: z.string().trim().max(100).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(10),
        page: z.coerce.number().int().min(1).default(1),
      }),
      req.query
    );
    const params: unknown[] = [];
    const where: string[] = [];
    if (q.days) {
      params.push(q.days);
      where.push(`occurred_at >= now() - make_interval(days => $${params.length})`);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const balances = (await query(
      `SELECT account, COALESCE(sum(debit), 0) AS debit, COALESCE(sum(credit), 0) AS credit
       FROM ledger_entries ${w} GROUP BY account`, params
    )).rows;
    const byAccount = Object.fromEntries(balances.map((r) => [r.account, r]));
    const accounts = Object.entries(ACCOUNTS).map(([code, a]) => {
      const r = byAccount[code] || { debit: 0, credit: 0 };
      const debit = round2(Number(r.debit));
      const credit = round2(Number(r.credit));
      // Assets and contra-revenue grow with debits; the rest with credits.
      const balance = ['asset', 'contra'].includes(a.type) ? round2(debit - credit) : round2(credit - debit);
      return { account: code, name: a.name, type: a.type, debit, credit, balance };
    });
    // Every journal as one plain-language row ("Everyday business language").
    const jWhere: string[] = [];
    const jParams: unknown[] = [];
    if (q.days) {
      jParams.push(q.days);
      jWhere.push(`j.occurred_at >= now() - make_interval(days => $${jParams.length})`);
    }
    if (q.account) {
      jParams.push(q.account);
      jWhere.push(`$${jParams.length} = ANY(j.accounts)`);
    }
    if (q.kind) {
      jParams.push(q.kind.split(','));
      jWhere.push(`j.kind = ANY($${jParams.length}::text[])`);
    }
    if (q.search) {
      jParams.push(`%${q.search.replace(/^#/, '')}%`);
      jWhere.push(`(j.memo ILIKE $${jParams.length} OR j.order_id::text ILIKE $${jParams.length} OR o.number ILIKE $${jParams.length}
        OR (u.firstname || ' ' || u.lastname) ILIKE $${jParams.length} OR u.email ILIKE $${jParams.length})`);
    }
    const jw = jWhere.length ? `WHERE ${jWhere.join(' AND ')}` : '';
    const journalsFrom = `FROM (
        SELECT journal_id, max(occurred_at) AS occurred_at, max(memo) AS memo, max(order_id) AS order_id,
          max(invoice_id) AS invoice_id, max(payment_id) AS payment_id, max(refund_id) AS refund_id,
          max(currency) AS currency, sum(debit) AS amount, array_agg(DISTINCT account) AS accounts,
          CASE WHEN max(memo) LIKE 'Invoice %' THEN 'sale' WHEN max(memo) LIKE 'Payment %' THEN 'payment'
            WHEN max(memo) LIKE 'Refund %' THEN 'refund' WHEN max(memo) LIKE 'Void %' THEN 'void'
            ELSE 'adjustment' END AS kind
        FROM ledger_entries GROUP BY journal_id
      ) j LEFT JOIN orders o ON o.id = j.order_id LEFT JOIN users u ON u.id = o.user_id`;
    const totalJournals = (await query(`SELECT count(*)::int AS n ${journalsFrom} ${jw}`, jParams)).rows[0].n;
    jParams.push(q.limit, (q.page - 1) * q.limit);
    const rows = (await query(
      `SELECT j.*, i.number AS invoice_number, p.method AS payment_method, rf.method AS refund_method, o.number AS order_number,
         NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), '') AS customer_name, u.id AS customer_id
       ${journalsFrom} LEFT JOIN invoices i ON i.id = j.invoice_id LEFT JOIN payments p ON p.id = j.payment_id
       LEFT JOIN refunds rf ON rf.id = j.refund_id
       ${jw} ORDER BY j.occurred_at DESC, j.journal_id DESC LIMIT $${jParams.length - 1} OFFSET $${jParams.length}`,
      jParams
    )).rows;
    const lines = rows.length
      ? (await query('SELECT * FROM ledger_entries WHERE journal_id = ANY($1::int[]) ORDER BY debit DESC, id', [rows.map((r) => r.journal_id)])).rows
      : [];
    const grouped = rows.map((j) => ({
      journal_id: j.journal_id,
      kind: j.kind,
      kind_name: JOURNAL_KINDS[j.kind as keyof typeof JOURNAL_KINDS],
      description: describeJournal(j),
      occurred_at: j.occurred_at,
      memo: j.memo,
      amount: round2(Number(j.amount)),
      currency: j.currency,
      order_id: j.order_id,
      order_number: j.order_number,
      invoice_id: j.invoice_id,
      invoice_number: j.invoice_number,
      refund_id: j.refund_id,
      customer: j.customer_id ? { customer_id: j.customer_id, name: j.customer_name } : null,
      lines: lines
        .filter((l) => l.journal_id === j.journal_id)
        .map((l) => ({ account: l.account, name: ACCOUNTS[l.account]?.name || l.account, debit: Number(l.debit), credit: Number(l.credit) })),
    }));
    const totalDebit = round2(accounts.reduce((s, a) => s + a.debit, 0));
    const totalCredit = round2(accounts.reduce((s, a) => s + a.credit, 0));
    ok(res, { accounts, journals: grouped, total_journals: totalJournals, totals: { debit: totalDebit, credit: totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 } });
  }));

  return router;
};
