// src/lib/payments.ts — card payments through Stripe, created and verified on
// the server (the secret key never reaches the browser). Tests inject a fake.
import Stripe from 'stripe';
import { config } from '../config';

export interface PaymentGateway {
  createIntent(input: { amountCents: number; currency: string; orderId: number; email: string }): Promise<{
    id: string;
    clientSecret: string;
  }>;
  getStatus(intentId: string): Promise<'succeeded' | 'processing' | 'requires_action' | 'failed' | string>;
  refund(intentId: string): Promise<void>;
}

export const stripeGateway = (): PaymentGateway | null => {
  if (!config.stripe.secretKey) return null;
  const stripe = new Stripe(config.stripe.secretKey);
  return {
    async createIntent({ amountCents, currency, orderId, email }) {
      const intent = await stripe.paymentIntents.create(
        {
          amount: amountCents,
          currency: currency.toLowerCase(),
          receipt_email: email,
          metadata: { order_id: String(orderId) },
          // Cards only: confirmed in our own checkout (3-D Secure opens in a
          // Stripe modal on the page), never a redirect to another site.
          payment_method_types: ['card'],
        },
        { idempotencyKey: `order-${orderId}-${amountCents}` }
      );
      return { id: intent.id, clientSecret: intent.client_secret! };
    },
    async getStatus(intentId) {
      const intent = await stripe.paymentIntents.retrieve(intentId);
      return intent.status === 'requires_payment_method' ? 'failed' : intent.status;
    },
    async refund(intentId) {
      await stripe.refunds.create({ payment_intent: intentId });
    },
  };
};
