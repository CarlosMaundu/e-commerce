// src/lib/accounting.ts — invoices, payments, refunds and the ledger.
//
// Every money event posts a balanced journal (debits = credits):
//   invoice issued   Dr receivables            Cr sales, vat_payable, delivery_income
//   payment received Dr cash/card/mobile/bank  Cr receivables
//   refund paid      Dr sales_returns, vat_payable, delivery_income
//                    Cr cash/card/mobile/bank, restocking_income (fee kept)
//   invoice voided   the issue journal reversed (unpaid cancelled orders)
// So the ledger always agrees with what customers owe, paid and got back.
import { query } from '../db';
import { fail } from './http';
import { round2 } from './pricing';

export type Db = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };
const direct: Db = { query: (t, p) => query(t, p) };

export const PAYMENT_METHODS_ALL = ['stripe', 'cod', 'cash', 'mpesa', 'bank'] as const;
export type Method = (typeof PAYMENT_METHODS_ALL)[number];

export const ACCOUNTS: Record<string, { name: string; type: 'asset' | 'liability' | 'income' | 'contra' }> = {
  receivables: { name: 'Customer receivables', type: 'asset' },
  cash: { name: 'Cash', type: 'asset' },
  card_clearing: { name: 'Card clearing (Stripe)', type: 'asset' },
  mobile_money: { name: 'Mobile money (M-Pesa)', type: 'asset' },
  bank: { name: 'Bank', type: 'asset' },
  vat_payable: { name: 'VAT payable', type: 'liability' },
  sales: { name: 'Sales', type: 'income' },
  delivery_income: { name: 'Delivery income', type: 'income' },
  restocking_income: { name: 'Restocking fees', type: 'income' },
  sales_returns: { name: 'Sales returns and refunds', type: 'contra' },
};

export const accountFor = (method: string) =>
  ({ stripe: 'card_clearing', cod: 'cash', cash: 'cash', mpesa: 'mobile_money', bank: 'bank' } as Record<string, string>)[method] ||
  'cash';

import { cashReceipt, invoiceNumber, mpesaRef, bankRef, stripeLikeRef } from './numbers';

interface Line {
  account: string;
  debit?: number;
  credit?: number;
}
interface Ctx {
  orderId?: number | null;
  invoiceId?: number | null;
  paymentId?: number | null;
  refundId?: number | null;
  currency: string;
  memo: string;
  at?: Date | string | null;
  by?: number | null;
}

/** Posts one balanced journal; returns its id. */
export const post = async (db: Db, lines: Line[], ctx: Ctx) => {
  const clean = lines
    .map((l) => ({ account: l.account, debit: round2(l.debit || 0), credit: round2(l.credit || 0) }))
    .filter((l) => l.debit > 0 || l.credit > 0);
  const debit = round2(clean.reduce((s, l) => s + l.debit, 0));
  const credit = round2(clean.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(debit - credit) > 0.009) throw new Error(`Unbalanced journal (${debit} ≠ ${credit}): ${ctx.memo}`);
  if (!clean.length) return null;
  const journal = (await db.query("SELECT nextval('ledger_journal_seq')::int AS id")).rows[0].id;
  for (const l of clean) {
    await db.query(
      `INSERT INTO ledger_entries (journal_id, account, debit, credit, memo, order_id, invoice_id, payment_id, refund_id,
         currency, occurred_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::timestamptz, now()), $12)`,
      [journal, l.account, l.debit, l.credit, ctx.memo.slice(0, 200), ctx.orderId ?? null, ctx.invoiceId ?? null,
        ctx.paymentId ?? null, ctx.refundId ?? null, ctx.currency, ctx.at ?? null, ctx.by ?? null]
    );
  }
  return journal;
};

/** Revenue split of an order: goods (net of tax and discount), tax, delivery. */
const split = (o: { total: any; shipping_total?: any; shipping?: any; tax_total?: any; tax?: any }) => {
  const total = Number(o.total);
  const shipping = Number(o.shipping_total ?? o.shipping ?? 0);
  const tax = Number(o.tax_total ?? o.tax ?? 0);
  return { total, shipping, tax, sales: round2(total - shipping - tax) };
};

/** Issues the invoice for a placed order and posts the sale. Idempotent. */
export const issueInvoice = async (
  db: Db,
  order: any,
  { by = null, at = null, dueDays = 0, notes = '' }: { by?: number | null; at?: Date | string | null; dueDays?: number; notes?: string } = {}
) => {
  const existing = (await db.query('SELECT * FROM invoices WHERE order_id = $1', [order.id])).rows[0];
  if (existing) return existing;
  const s = split(order);
  const issued = at || order.placed_at || new Date();
  const invoice = (
    await db.query(
      `INSERT INTO invoices (number, order_id, user_id, subtotal, discount, shipping, tax, total, currency, issued_at,
         due_at, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz,
         CASE WHEN $11::int > 0 THEN $10::timestamptz + make_interval(days => $11::int) END, $12, $13)
       RETURNING *`,
      [invoiceNumber(issued), order.id, order.user_id, order.subtotal, order.discount || 0, s.shipping, s.tax, s.total,
        order.currency, issued, dueDays, notes, by]
    )
  ).rows[0];
  await post(
    db,
    [
      { account: 'receivables', debit: s.total },
      { account: 'sales', credit: s.sales },
      { account: 'vat_payable', credit: s.tax },
      { account: 'delivery_income', credit: s.shipping },
    ],
    { orderId: order.id, invoiceId: invoice.id, currency: order.currency, memo: `Invoice ${invoice.number}`, at: issued, by }
  );
  return invoice;
};

/** Money in against an invoice. Marks the invoice (and order) paid when settled. */
export const recordPayment = async (
  db: Db,
  {
    invoice,
    method,
    amount,
    reference = '',
    note = '',
    at = null,
    by = null,
  }: { invoice: any; method: Method; amount: number; reference?: string; note?: string; at?: Date | string | null; by?: number | null }
) => {
  const outstanding = round2(Number(invoice.total) - Number(invoice.amount_paid));
  amount = round2(amount);
  if (!(amount > 0)) fail(400, 'Please enter an amount greater than zero.');
  if (['void', 'refunded'].includes(invoice.status)) fail(400, `This invoice is ${invoice.status}; it can’t take payments.`);
  if (amount > outstanding + 0.009) fail(400, `Only ${outstanding.toFixed(2)} is outstanding on this invoice.`);
  const payment = (
    await db.query(
      `INSERT INTO payments (kind, method, amount, currency, reference, order_id, invoice_id, user_id, note, received_at, recorded_by)
       VALUES ('payment', $1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, now()), $10) RETURNING *`,
      [method, amount, invoice.currency, reference, invoice.order_id, invoice.id, invoice.user_id, note, at, by]
    )
  ).rows[0];
  await post(
    db,
    [
      { account: accountFor(method), debit: amount },
      { account: 'receivables', credit: amount },
    ],
    {
      orderId: invoice.order_id, invoiceId: invoice.id, paymentId: payment.id, currency: invoice.currency,
      memo: `Payment ${reference || `#${payment.id}`} for ${invoice.number}`, at, by,
    }
  );
  const paid = round2(Number(invoice.amount_paid) + amount);
  const settled = paid >= Number(invoice.total) - 0.009;
  await db.query(
    `UPDATE invoices SET amount_paid = $2, status = $3, updated_at = now() WHERE id = $1`,
    [invoice.id, paid, settled ? 'paid' : 'partially_paid']
  );
  if (settled) await db.query(`UPDATE orders SET payment_status = 'paid', updated_at = now() WHERE id = $1`, [invoice.order_id]);
  return payment;
};

/** Cancels an unpaid invoice: reverses the sale. */
export const voidInvoice = async (db: Db, invoice: any, { by = null, at = null }: { by?: number | null; at?: Date | string | null } = {}) => {
  if (invoice.status === 'void') return;
  if (Number(invoice.amount_paid) > 0) fail(400, 'This invoice has payments; refund them instead of voiding it.');
  const s = split(invoice);
  await post(
    db,
    [
      { account: 'sales', debit: s.sales },
      { account: 'vat_payable', debit: s.tax },
      { account: 'delivery_income', debit: s.shipping },
      { account: 'receivables', credit: s.total },
    ],
    { orderId: invoice.order_id, invoiceId: invoice.id, currency: invoice.currency, memo: `Void ${invoice.number}`, at, by }
  );
  await db.query(`UPDATE invoices SET status = 'void', updated_at = now() WHERE id = $1`, [invoice.id]);
};

/**
 * Pays a refund out and posts it: the goods (with their share of tax), any
 * delivery, less a restocking fee that the shop keeps.
 */
export const postRefund = async (db: Db, refund: any, invoice: any, { by = null, at = null }: { by?: number | null; at?: Date | string | null } = {}) => {
  const items = Number(refund.items_amount);
  const delivery = Number(refund.delivery_amount);
  const fee = Number(refund.restocking_fee);
  const goodsWithTax = Number(invoice.total) - Number(invoice.shipping);
  const itemTax = goodsWithTax > 0 ? round2((items * Number(invoice.tax)) / goodsWithTax) : 0;
  const payment = (
    await db.query(
      `INSERT INTO payments (kind, method, amount, currency, reference, order_id, invoice_id, user_id, refund_id, note,
         received_at, recorded_by)
       VALUES ('refund', $1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, now()), $11) RETURNING *`,
      [refund.method, refund.amount, invoice.currency, refund.reference || '', refund.order_id, invoice.id, invoice.user_id,
        refund.id, refund.reason || '', at, by]
    )
  ).rows[0];
  await post(
    db,
    [
      { account: 'sales_returns', debit: round2(items - itemTax) },
      { account: 'vat_payable', debit: itemTax },
      { account: 'delivery_income', debit: delivery },
      { account: accountFor(refund.method), credit: Number(refund.amount) },
      { account: 'restocking_income', credit: fee },
    ],
    {
      orderId: refund.order_id, invoiceId: invoice.id, paymentId: payment.id, refundId: refund.id,
      currency: invoice.currency, memo: `Refund #${refund.id} for ${invoice.number}`, at, by,
    }
  );
  const refunded = round2(Number(invoice.amount_refunded) + Number(refund.amount) + fee);
  const full = refunded >= Number(invoice.amount_paid) - 0.009;
  await db.query(
    `UPDATE invoices SET amount_refunded = $2, status = $3, updated_at = now() WHERE id = $1`,
    [invoice.id, round2(Number(invoice.amount_refunded) + Number(refund.amount)), full ? 'refunded' : 'partially_refunded']
  );
  if (full) await db.query(`UPDATE orders SET payment_status = 'refunded', updated_at = now() WHERE id = $1`, [refund.order_id]);
  await db.query(
    `UPDATE refunds SET status = 'processed', processed_at = COALESCE($2::timestamptz, now()) WHERE id = $1`,
    [refund.id, at]
  );
  return payment;
};

/** How much of an order can still be refunded, and of its delivery. */
export const refundable = async (db: Db, invoice: any) => {
  const r = (
    await db.query(
      `SELECT COALESCE(sum(amount + restocking_fee), 0) AS taken, COALESCE(sum(delivery_amount), 0) AS delivery
       FROM refunds WHERE invoice_id = $1 AND status IN ('processed', 'pending_approval')`,
      [invoice.id]
    )
  ).rows[0];
  return {
    amount: round2(Number(invoice.amount_paid) - Number(r.taken)),
    delivery: round2(Number(invoice.shipping) - Number(r.delivery)),
  };
};

/**
 * How an earlier order was paid. Card orders keep their Stripe id. Demo
 * shoppers' cash-on-delivery orders were mostly paid by M-Pesa on delivery,
 * some by bank transfer or in cash, with references in the usual formats.
 */
export const backfillPayment = (o: any, at: Date | string) => {
  if (o.payment_method === 'stripe') {
    return { method: 'stripe' as Method, reference: o.payment_reference || stripeLikeRef('pi') };
  }
  if (String(o.email || '').startsWith('demo.buyer')) {
    const r = Math.random();
    if (r < 0.7) return { method: 'mpesa' as Method, reference: mpesaRef(at) };
    if (r < 0.85 || Number(o.total) > 100000) return { method: 'bank' as Method, reference: bankRef(at) };
  }
  return { method: 'cod' as Method, reference: cashReceipt(at) };
};

/**
 * Gives every placed order without an invoice its invoice, payment and
 * refund history (orders placed before invoicing existed, demo orders).
 */
export const backfillAccounting = async (db: Db = direct) => {
  const orders = (
    await db.query(
      `SELECT o.*,
         (SELECT min(created_at) FROM order_history h WHERE h.order_id = o.id AND h.status = 'delivered') AS delivered_at,
         (SELECT min(created_at) FROM order_history h WHERE h.order_id = o.id AND h.status IN ('cancelled', 'refunded')) AS ended_at
       FROM orders o
       WHERE o.placed_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = o.id)
       ORDER BY o.placed_at`
    )
  ).rows;
  for (const o of orders) {
    let invoice = await issueInvoice(db, o, { at: o.placed_at });
    const paid = ['paid', 'refunded'].includes(o.payment_status);
    if (paid) {
      const at = o.payment_method === 'stripe' ? o.placed_at : o.delivered_at || o.placed_at;
      const { method, reference } = backfillPayment(o, at);
      await recordPayment(db, { invoice, method, amount: Number(invoice.total), reference, at });
      invoice = (await db.query('SELECT * FROM invoices WHERE id = $1', [invoice.id])).rows[0];
    }
    if (o.payment_status === 'refunded' || (o.status === 'refunded' && paid)) {
      const refund = (
        await db.query(
          `INSERT INTO refunds (order_id, invoice_id, status, items_amount, delivery_amount, amount, method, reference, reason, created_at)
           VALUES ($1, $2, 'pending_approval', $3, $4, $5, $6, $7, 'Order refunded', COALESCE($8::timestamptz, now())) RETURNING *`,
          [o.id, invoice.id, round2(Number(invoice.total) - Number(invoice.shipping)), Number(invoice.shipping), Number(invoice.total),
            o.payment_method === 'stripe' ? 'stripe' : 'cash',
            o.payment_method === 'stripe' ? stripeLikeRef('re') : cashReceipt(o.ended_at || undefined), o.ended_at]
        )
      ).rows[0];
      await postRefund(db, refund, invoice, { at: o.ended_at });
    } else if (['cancelled', 'refunded'].includes(o.status) && !paid) {
      await voidInvoice(db, invoice, { at: o.ended_at });
    }
  }
  return orders.length;
};
