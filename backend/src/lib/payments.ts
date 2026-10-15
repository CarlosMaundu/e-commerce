// src/lib/payments.ts — card payments through Stripe, created and verified on
// the server (the secret key never reaches the browser). Keys come from
// Back office → Payments (or the environment) at the time of each call, so a
// change there applies at once. Tests inject a fake.
import Stripe from 'stripe';
import { fail } from './http';
import { stripeKeys, stripeWebhookSecret } from './paymentProviders';

export interface PaymentGateway {
  createIntent(input: { amountCents: number; currency: string; orderId: number; email: string }): Promise<{
    id: string;
    clientSecret: string;
  }>;
  getStatus(intentId: string): Promise<'succeeded' | 'processing' | 'requires_action' | 'failed' | string>;
  /** Refunds all of the payment, or `amountCents` of it; returns the refund id. */
  refund(intentId: string, amountCents?: number): Promise<string | void>;
  /**
   * A Stripe-hosted page to pay `amountCents` (cards, Apple Pay, Google Pay):
   * the link and QR code staff show at the door.
   */
  createPaymentLink(input: {
    amountCents: number;
    currency: string;
    orderId: number;
    description: string;
    email?: string;
  }): Promise<{ id: string; url: string }>;
  /** Whether the link has been paid, and the payment's id when it has. */
  getPaymentLink(id: string): Promise<{ status: 'paid' | 'open' | 'expired'; paymentId?: string }>;
  /** Checks a secret key; returns the account's name. */
  checkKey(secretKey: string): Promise<string>;
  /** A webhook call from Stripe, checked against its signature; throws if forged. */
  parseWebhook(raw: Buffer, signature: string): { type: string; data: { object: any } };
}

const client = (secretKey?: string) => {
  const key = secretKey || stripeKeys().secretKey;
  if (!key) fail(503, 'Card payments aren’t set up. Add your Stripe keys under Payments.');
  return new Stripe(key);
};

export const stripeGateway = (): PaymentGateway => ({
  async createIntent({ amountCents, currency, orderId, email }) {
    const intent = await client().paymentIntents.create(
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
    const intent = await client().paymentIntents.retrieve(intentId);
    return intent.status === 'requires_payment_method' ? 'failed' : intent.status;
  },
  async refund(intentId, amountCents) {
    const r = await client().refunds.create({
      payment_intent: intentId,
      ...(amountCents ? { amount: amountCents } : {}),
    });
    return r.id;
  },
  async createPaymentLink({ amountCents, currency, orderId, description, email }) {
    const session = await client().checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: { currency: currency.toLowerCase(), unit_amount: amountCents, product_data: { name: description } },
        },
      ],
      customer_email: email || undefined,
      metadata: { order_id: String(orderId), source: 'door' },
      payment_intent_data: { metadata: { order_id: String(orderId), source: 'door' } },
      // Nothing to come back to: the rider's screen checks the payment.
      success_url: 'https://stripe.com',
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    });
    return { id: session.id, url: session.url! };
  },
  async getPaymentLink(id) {
    const s = await client().checkout.sessions.retrieve(id);
    if (s.payment_status === 'paid') {
      return { status: 'paid', paymentId: typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id };
    }
    return { status: s.status === 'expired' ? 'expired' : 'open' };
  },
  parseWebhook(raw, signature) {
    const secret = stripeWebhookSecret();
    if (!secret) fail(503, 'Stripe webhooks aren’t set up.');
    return client().webhooks.constructEvent(raw, signature, secret) as any;
  },
  async checkKey(secretKey) {
    const account = await client(secretKey).accounts.retrieve();
    return account.settings?.dashboard?.display_name || account.business_profile?.name || account.email || account.id;
  },
});
