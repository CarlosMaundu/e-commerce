// src/routes/stripeWebhook.ts — Stripe tells us a payment went through:
// a checkout card payment (place the order, even if the customer closed the
// page) or a card link paid at the door (record it). Signed by Stripe; the
// raw body is needed to check the signature.
import express, { Router } from 'express';
import { query } from '../db';
import { PaymentGateway } from '../lib/payments';
import { placeOrder } from '../lib/placeOrder';
import { markPaid } from './adminPayments';

export const stripeWebhookRoutes = ({ payments }: { payments: PaymentGateway | null }) => {
  const router = Router();
  router.post('/payments/stripe/webhook', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
    let event;
    try {
      event = payments!.parseWebhook(req.body as Buffer, String(req.get('stripe-signature') || ''));
    } catch {
      return res.status(400).json({ error: 'Invalid signature.' });
    }
    try {
      const obj = event.data.object;
      if (event.type === 'payment_intent.succeeded') {
        const order = (await query(
          `SELECT id, user_id FROM orders WHERE payment_reference = $1 AND payment_method = 'stripe' AND placed_at IS NULL`,
          [obj.id]
        )).rows[0];
        if (order) await placeOrder(order.id, { paid: true, userId: order.user_id, allowShortStock: true });
      } else if (event.type === 'checkout.session.completed' && obj.payment_status === 'paid') {
        const r = (await query(
          `SELECT id FROM payment_requests WHERE provider = 'card_link' AND external_id = $1 AND status = 'pending'`,
          [obj.id]
        )).rows[0];
        if (r) await markPaid(r.id, typeof obj.payment_intent === 'string' ? obj.payment_intent : obj.id, 'stripe', null);
      }
      return res.json({ received: true });
    } catch (error) {
      console.error('Stripe webhook failed:', error);
      // Stripe retries on errors; the background check also catches up.
      return res.status(500).json({ error: 'Not processed.' });
    }
  });
  return router;
};
