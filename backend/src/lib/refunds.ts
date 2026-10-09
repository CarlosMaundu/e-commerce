// src/lib/refunds.ts — refund rules (Back office → Refund settings) and the
// refund workflow: work out what's owed, hold large refunds for approval,
// pay card refunds back through Stripe, and post everything to the ledger.
import { z } from 'zod';
import { query } from '../db';
import { Db, postRefund, refundable } from './accounting';
import { fail } from './http';
import { PaymentGateway } from './payments';
import { round2 } from './pricing';

export const refundSettingsSchema = z.object({
  // Customers can ask for a return this many days after delivery (0 = any time).
  return_window_days: z.coerce.number().int().min(0, 'Use 0 for no limit.').max(365),
  // Whether a full refund also gives back the delivery charge.
  refund_delivery: z.boolean(),
  // Kept from returned goods, as a percentage of their price.
  restocking_fee_percent: z.coerce.number().min(0).max(50, 'The restocking fee can be at most 50%.'),
  // Refunds above this need someone with "Approve large refunds" (null = never).
  approval_threshold: z.coerce.number().min(0).nullable(),
});

export type RefundSettings = z.output<typeof refundSettingsSchema>;

export const defaultRefundSettings = (): RefundSettings => ({
  return_window_days: 14,
  refund_delivery: false,
  restocking_fee_percent: 0,
  approval_threshold: null,
});

export const getRefundSettings = async (): Promise<RefundSettings> => {
  const row = (await query('SELECT settings FROM refund_settings WHERE id = 1')).rows[0];
  const parsed = refundSettingsSchema.safeParse({ ...defaultRefundSettings(), ...(row?.settings || {}) });
  return parsed.success ? parsed.data : defaultRefundSettings();
};

export const saveRefundSettings = async (settings: RefundSettings, userId: number) => {
  await query(
    `INSERT INTO refund_settings (id, settings, updated_by, updated_at) VALUES (1, $1, $2, now())
     ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(settings), userId]
  );
};

const methodFor = (paymentMethod: string): 'stripe' | 'cash' => (paymentMethod === 'stripe' ? 'stripe' : 'cash');

/** Sends money back: through Stripe for card payments, else recorded as paid out. */
export const payOut = async (db: Db, refund: any, invoice: any, order: any, gateway: PaymentGateway | null, by: number | null) => {
  let reference = refund.reference || '';
  if (refund.method === 'stripe') {
    if (!gateway || !order.payment_reference) fail(503, 'Card refunds aren’t available right now.');
    const full = Number(refund.amount) >= Number(invoice.amount_paid) - 0.009;
    const id = await gateway!.refund(order.payment_reference, full ? undefined : Math.round(Number(refund.amount) * 100));
    reference = (id as string) || order.payment_reference;
    await db.query('UPDATE refunds SET reference = $2 WHERE id = $1', [refund.id, reference]);
  }
  await postRefund(db, { ...refund, reference }, invoice, { by });
};

/**
 * Creates a refund for an order. `items_amount` is the value of the goods
 * coming back (prices as charged); delivery is added when asked or when the
 * settings say so for a full refund; the restocking fee comes off.
 */
export const createRefund = async (
  db: Db,
  {
    order,
    itemsAmount,
    includeDelivery,
    reason,
    method,
    returnId = null,
    by,
    gateway,
    applyFee = true,
    closesOrder = false,
  }: {
    order: any;
    itemsAmount: number;
    includeDelivery?: boolean;
    reason: string;
    method?: string;
    returnId?: number | null;
    by: number | null;
    gateway: PaymentGateway | null;
    applyFee?: boolean;
    // Marks the order refunded when this refund is paid out.
    closesOrder?: boolean;
  }
) => {
  const invoice = (await db.query('SELECT * FROM invoices WHERE order_id = $1', [order.id])).rows[0];
  if (!invoice) fail(400, 'This order has no invoice yet.');
  if (!(Number(invoice.amount_paid) > 0)) fail(400, 'Nothing has been paid on this order, so there’s nothing to refund. Cancel it instead.');
  const settings = await getRefundSettings();
  const left = await refundable(db, invoice);
  const goodsPaid = round2(Number(invoice.total) - Number(invoice.shipping));
  const items = round2(Math.min(itemsAmount, goodsPaid));
  const fullGoods = items >= goodsPaid - 0.009;
  const delivery = (includeDelivery ?? (fullGoods && settings.refund_delivery)) ? left.delivery : 0;
  const fee = applyFee ? round2((items * settings.restocking_fee_percent) / 100) : 0;
  const amount = round2(items + delivery - fee);
  if (!(amount > 0)) fail(400, 'The refund must be more than zero.');
  if (amount + fee > left.amount + 0.009) fail(400, `Only ${left.amount.toFixed(2)} can still be refunded on this order.`);

  // Above the limit every refund waits in the approval queue, whoever raised
  // it (an approver then approves it there, even their own).
  const needsApproval = settings.approval_threshold !== null && amount > settings.approval_threshold;
  const refund = (
    await db.query(
      `INSERT INTO refunds (order_id, invoice_id, return_id, status, items_amount, delivery_amount, restocking_fee, amount,
         method, reason, requested_by, approved_by, closes_order)
       VALUES ($1, $2, $3, 'pending_approval', $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [order.id, invoice.id, returnId, items, delivery, fee, amount, method || methodFor(order.payment_method), reason, by,
        needsApproval ? null : by, closesOrder]
    )
  ).rows[0];
  if (!needsApproval) await payOut(db, refund, invoice, order, gateway, by);
  return (await db.query('SELECT * FROM refunds WHERE id = $1', [refund.id])).rows[0];
};

export const toContractRefund = (r: any) => ({
  refund_id: r.id,
  order_id: r.order_id,
  order_number: r.order_number ?? undefined,
  invoice_id: r.invoice_id,
  invoice_number: r.invoice_number ?? undefined,
  return_id: r.return_id,
  status: r.status,
  items_amount: Number(r.items_amount),
  delivery_amount: Number(r.delivery_amount),
  restocking_fee: Number(r.restocking_fee),
  amount: Number(r.amount),
  method: r.method,
  reference: r.reference,
  reason: r.reason,
  customer: r.customer_name !== undefined ? { customer_id: r.user_id, name: r.customer_name } : undefined,
  requested_by: r.requested_by_name ?? undefined,
  approved_by: r.approved_by_name ?? undefined,
  date_added: r.created_at,
  date_processed: r.processed_at,
});
