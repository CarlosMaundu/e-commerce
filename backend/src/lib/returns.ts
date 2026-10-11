// src/lib/returns.ts — a return's steps: each one is recorded as an event
// (who, when, a note), the customer is emailed when something changes for
// them, and the return follows its refund (pending approval → refunded, or
// back to "item received" when the refund is rejected).
import { config } from '../config';
import { query } from '../db';
import type { Db } from './accounting';
import { sendReturnUpdateEmail } from './mailer';
import { getStore } from './store';

export const RETURN_EVENT_NAMES: Record<string, string> = {
  requested: 'Return requested',
  approved: 'Return approved',
  received: 'Item received',
  refund_requested: 'Refund sent for approval',
  refund_rejected: 'Refund not approved',
  refunded: 'Refunded',
  rejected: 'Return rejected',
  note: 'Note',
};

const money = (currency: string, amount: number) => `${currency} ${Number(amount).toFixed(2)}`;
const HOW: Record<string, string> = {
  stripe: ' to your card',
  mpesa: ' by M-Pesa',
  bank: ' by bank transfer',
  cash: ' in cash',
  cod: ' in cash',
};

const refundNote = (refund: { amount: number | string; method: string; reference?: string }, currency: string) =>
  `${money(currency, Number(refund.amount))} paid back${HOW[refund.method] || ''}${refund.reference ? ` · Ref ${refund.reference}` : ''}.`;

/** The email line when a return's refund has been paid. */
export const refundPaidMessage = (refund: { amount: number | string; method: string; reference?: string }, currency: string) =>
  `We’ve refunded you: ${refundNote(refund, currency)} It can take a few days to show on your statement.`;

export const addReturnEvent = (
  db: Db,
  returnId: number,
  status: string,
  { note = '', userId = null, internal = false }: { note?: string; userId?: number | null; internal?: boolean } = {}
) =>
  db.query('INSERT INTO return_events (return_id, status, note, internal, user_id) VALUES ($1, $2, $3, $4, $5)', [
    returnId,
    status,
    note,
    internal,
    userId,
  ]);

/** The return's steps, oldest first; customers don't see staff-only ones. */
export const returnEvents = async (returnId: number, { admin = false } = {}) =>
  (
    await query(
      `SELECT e.*, NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), '') AS user_name
       FROM return_events e LEFT JOIN users u ON u.id = e.user_id
       WHERE e.return_id = $1 ${admin ? '' : 'AND NOT e.internal'} ORDER BY e.created_at, e.id`,
      [returnId]
    )
  ).rows.map((e) => ({
    status: e.status,
    status_name: RETURN_EVENT_NAMES[e.status] || e.status,
    note: e.note,
    date_added: e.created_at,
    ...(admin ? { by: e.user_name, internal: e.internal } : {}),
  }));

const returnLink = (id: number) => `${config.frontendUrl.replace(/\/$/, '')}/account/returns/${id}`;

/** Emails the customer about a step; never fails the step itself. */
export const emailReturnUpdate = async (returnId: number, headline: string, message: string) => {
  const r = (
    await query(
      `SELECT u.email, u.firstname FROM returns r JOIN users u ON u.id = r.user_id WHERE r.id = $1`,
      [returnId]
    )
  ).rows[0];
  if (!r?.email) return;
  await sendReturnUpdateEmail(r.email, r.firstname, returnId, headline, message, returnLink(returnId)).catch((e) =>
    console.error('Return email failed:', e)
  );
};

/** What the customer is told when the return is approved: where to send it. */
export const sendBackInstructions = async (note: string) => {
  const store = await getStore();
  const where = store.address ? `\n\nPlease send it to:\n${store.name}\n${store.address}` : '';
  return `${note ? `${note}\n\n` : ''}Please pack the item with everything it came with and include your return number.${where}`;
};

/**
 * Keeps a return in step with its refund. Called when a refund is raised,
 * approved, rejected or paid; does nothing for refunds not tied to a return.
 */
export const followRefund = async (
  db: Db,
  refund: { id: number; return_id: number | null; status: string; amount: number | string; method: string; reference?: string },
  currency: string,
  userId: number | null
) => {
  if (!refund.return_id) return null;
  const amount = money(currency, Number(refund.amount));
  if (refund.status === 'processed') {
    await db.query(`UPDATE returns SET status = 'refunded', updated_at = now() WHERE id = $1`, [refund.return_id]);
    await addReturnEvent(db, refund.return_id, 'refunded', { note: refundNote(refund, currency), userId });
    return null;
  }
  if (refund.status === 'pending_approval') {
    await db.query(`UPDATE returns SET status = 'refund_pending', updated_at = now() WHERE id = $1`, [refund.return_id]);
    await addReturnEvent(db, refund.return_id, 'refund_requested', {
      note: `Refund of ${amount} is waiting for approval.`,
      userId,
      internal: true,
    });
    return null;
  }
  if (refund.status === 'rejected') {
    // Back to "item received": staff can refund again or reject the return.
    await db.query(`UPDATE returns SET status = 'received', updated_at = now() WHERE id = $1`, [refund.return_id]);
    await addReturnEvent(db, refund.return_id, 'refund_rejected', {
      note: `Refund of ${amount} was not approved.`,
      userId,
      internal: true,
    });
  }
  return null;
};
