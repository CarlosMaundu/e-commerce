// src/lib/placeOrder.ts — turns a checkout's pending order into a placed one:
// takes stock, counts the promo code, issues the invoice (and records the
// card payment), empties the cart and emails the customer. Used by checkout,
// by Stripe's webhook and by the background payment check, so it's safe to
// call more than once: the order row is locked and a placed order is left as is.
import { query, transaction } from '../db';
import { issueInvoice, recordPayment } from './accounting';
import { fail } from './http';
import { sendOrderConfirmationEmail } from './mailer';
import { addHistory, orderLink } from './orders';
import { round2 } from './pricing';
import { takeStock } from './products';

export interface PlaceOptions {
  paid: boolean;
  // Who placed it (the customer), and staff acting as them, if any.
  userId: number | null;
  placedBy?: number | null;
  // Checkout fails when stock ran out; a payment that already went through
  // places the order anyway and asks staff to check the stock.
  allowShortStock?: boolean;
}

/** Places order `orderId`; returns { placed: true } the first time, false if it already was. */
export const placeOrder = async (orderId: number, o: PlaceOptions) => {
  const result = await transaction(async (db) => {
    const pending = (await db.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId])).rows[0];
    if (!pending) fail(404, 'Order not found.');
    if (pending.placed_at) return { placed: false, order: pending, items: [] as any[] };
    const items = (await db.query('SELECT * FROM order_items WHERE order_id = $1', [orderId])).rows;
    const short: string[] = [];
    for (const item of items) {
      if (!(await takeStock(db, item, o.userId))) {
        if (!o.allowShortStock) fail(409, `Sorry, “${item.name}” sold out while you were checking out. Please update your cart.`);
        short.push(item.name);
      }
    }
    if (pending.coupon_code) {
      await db.query('UPDATE coupons SET uses_count = uses_count + 1 WHERE code = $1', [pending.coupon_code]);
    }
    const paymentStatus = o.paid ? 'paid' : 'pending';
    const status = o.paid ? 'processing' : 'pending';
    await db.query(
      `UPDATE orders SET status = $2, payment_status = $3, placed_by = $4, placed_at = now(), updated_at = now() WHERE id = $1`,
      [orderId, status, paymentStatus, o.placedBy ?? null]
    );
    await addHistory(db, orderId, status, 'Order placed.', { notified: true, userId: o.userId });
    if (short.length) {
      await addHistory(db, orderId, status, `Paid, but stock ran short for: ${short.join(', ')}. Check before dispatch.`, {
        userId: null,
      });
    }
    const placedRow = (await db.query('SELECT * FROM orders WHERE id = $1', [orderId])).rows[0];
    const invoice = await issueInvoice(db, placedRow, { by: o.userId });
    if (o.paid) {
      await recordPayment(db, {
        invoice, method: 'stripe', amount: Number(invoice.total), reference: pending.payment_reference, by: o.userId,
      });
    }
    if (pending.user_id) {
      await db.query('DELETE FROM cart_items WHERE user_id = $1', [pending.user_id]);
      await db.query(
        `UPDATE checkout_state SET coupon_code = NULL, pending_order_id = NULL, comment = ''
         WHERE user_id = $1 AND pending_order_id = $2`,
        [pending.user_id, orderId]
      );
    }
    return { placed: true, order: placedRow, items };
  });
  if (result.placed) {
    const email = result.order.email
      || (await query('SELECT email FROM users WHERE id = $1', [result.order.user_id])).rows[0]?.email;
    if (email) {
      sendOrderConfirmationEmail(email, {
        number: result.order.number,
        total: Number(result.order.total),
        currency: result.order.currency,
        items: result.items.map((i: any) => ({ name: i.name, quantity: i.quantity, total: round2(Number(i.total)) })),
      }, orderLink(orderId)).catch((error) => console.error('Order email failed:', error));
    }
  }
  return result;
};
