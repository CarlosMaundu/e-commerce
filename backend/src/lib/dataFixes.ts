// src/lib/dataFixes.ts — brings existing data up to the current formats on
// start-up. Each step only touches rows still in the old format, so running
// it again does nothing.
//   - orders get numbers (WEB-… / STF-… for staff-made ones)
//   - INV-000123 invoices become INV-YYYYMMDD-HHMMSS-XXXX (journals follow)
//   - seeded COD-123 payment references and blank refund references get
//     references in the real formats (M-Pesa, bank, Stripe, cash receipts)
import { transaction } from '../db';
import { accountFor, backfillPayment } from './accounting';
import { cashReceipt, invoiceNumber, orderNumber, stripeLikeRef } from './numbers';
import { demoStageChain } from './demoHistory';

type Db = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

const unique = async (db: Db, make: () => string, sql: string) => {
  for (;;) {
    const value = make();
    if (!(await db.query(sql, [value])).rows.length) return value;
  }
};

export const fixLegacyData = async () =>
  transaction(async (db) => {
    let changed = 0;

    const orders = (await db.query('SELECT id, placed_at, created_at, created_by FROM orders WHERE number IS NULL ORDER BY id')).rows;
    for (const o of orders) {
      const number = await unique(db, () => orderNumber(o.created_by ? 'STF' : 'WEB', o.placed_at || o.created_at),
        'SELECT 1 FROM orders WHERE number = $1');
      await db.query('UPDATE orders SET number = $2 WHERE id = $1', [o.id, number]);
      changed += 1;
    }

    const invoices = (await db.query(`SELECT id, number, issued_at FROM invoices WHERE number ~ '^INV-[0-9]{6}$'`)).rows;
    for (const inv of invoices) {
      const number = await unique(db, () => invoiceNumber(inv.issued_at), 'SELECT 1 FROM invoices WHERE number = $1');
      await db.query('UPDATE invoices SET number = $2 WHERE id = $1', [inv.id, number]);
      await db.query('UPDATE ledger_entries SET memo = replace(memo, $2, $3) WHERE invoice_id = $1', [inv.id, inv.number, number]);
      changed += 1;
    }

    const payments = (
      await db.query(
        `SELECT p.*, o.email, o.total, o.payment_method AS order_method, o.payment_reference, i.number AS invoice_number
         FROM payments p JOIN orders o ON o.id = p.order_id JOIN invoices i ON i.id = p.invoice_id
         WHERE p.kind = 'payment' AND p.reference LIKE 'COD-%'`
      )
    ).rows;
    for (const p of payments) {
      const { method, reference } = backfillPayment(
        { email: p.email, total: p.total, payment_method: p.order_method, payment_reference: p.payment_reference },
        p.received_at
      );
      await db.query('UPDATE payments SET method = $2, reference = $3 WHERE id = $1', [p.id, method, reference]);
      await db.query(
        `UPDATE ledger_entries SET account = CASE WHEN account = $2 THEN $3 ELSE account END, memo = $4 WHERE payment_id = $1`,
        [p.id, accountFor(p.method), accountFor(method), `Payment ${reference} for ${p.invoice_number}`]
      );
      changed += 1;
    }

    const refunds = (await db.query(`SELECT * FROM refunds WHERE reference = '' AND status = 'processed'`)).rows;
    for (const r of refunds) {
      const reference = r.method === 'stripe' ? stripeLikeRef('re') : cashReceipt(r.processed_at || r.created_at);
      await db.query('UPDATE refunds SET reference = $2 WHERE id = $1', [r.id, reference]);
      await db.query(`UPDATE payments SET reference = $2 WHERE refund_id = $1 AND kind = 'refund'`, [r.id, reference]);
      changed += 1;
    }
    // Demo orders with a single history row get a full stage history.
    const demo = (
      await db.query(
        `SELECT o.id, o.status, o.placed_at, o.shipping_method FROM orders o
         WHERE o.email LIKE 'demo.buyer%' AND o.placed_at IS NOT NULL
           AND (SELECT count(*) FROM order_history h WHERE h.order_id = o.id) = 1
           AND EXISTS (SELECT 1 FROM order_history h WHERE h.order_id = o.id AND h.comment = 'Demo order')`
      )
    ).rows;
    for (const o of demo) {
      await db.query('DELETE FROM order_history WHERE order_id = $1', [o.id]);
      await db.query(`INSERT INTO order_history (order_id, status, comment, created_at) VALUES ($1, 'pending', 'Demo order', $2)`,
        [o.id, o.placed_at]);
      for (const step of demoStageChain(o.status, new Date(o.placed_at), o.shipping_method)) {
        await db.query(`INSERT INTO order_history (order_id, status, comment, created_at) VALUES ($1, $2, 'Demo order', $3)`,
          [o.id, step.status, step.at]);
      }
      changed += 1;
    }
    return changed;
  });
