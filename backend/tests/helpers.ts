import request from 'supertest';
import { clearSettingsCache } from '../src/lib/settings';
import { createApp } from '../src/app';
import { pool, query } from '../src/db';
import { hashPassword } from '../src/lib/security';
import { GoogleIdentity } from '../src/lib/google';
import { loadFinance } from '../src/lib/finance';
import { loadDelivery } from '../src/lib/delivery';
import { loadSla } from '../src/lib/sla';
import { loadProviders } from '../src/lib/paymentProviders';
import { runSeed } from '../src/seed';

// Captured emails (the mailer is mocked in each test file).
export const sentEmails: { to: string; link: string; kind: string }[] = [];

export const googleIdentities: Record<string, GoogleIdentity> = {};

// Fake Stripe: tests set the status a PaymentIntent will report.
export const fakePayments = {
  intents: new Map<string, { status: string; amountCents: number; orderId: number }>(),
  refunds: [] as string[],
  partialRefunds: [] as { id: string; amountCents?: number }[],
  async createIntent({ amountCents, orderId }: { amountCents: number; orderId: number }) {
    const id = `pi_${orderId}_${amountCents}`;
    fakePayments.intents.set(id, { status: 'requires_payment_method', amountCents, orderId });
    return { id, clientSecret: `${id}_secret` };
  },
  async getStatus(id: string) {
    return fakePayments.intents.get(id)?.status || 'failed';
  },
  async refund(id: string, amountCents?: number) {
    fakePayments.refunds.push(id);
    fakePayments.partialRefunds.push({ id, amountCents });
    return `re_${id}_${amountCents ?? 'all'}`;
  },
  // Card links shown at the door: tests mark them paid.
  links: new Map<string, { status: 'paid' | 'open' | 'expired'; amountCents: number }>(),
  async createPaymentLink({ amountCents, orderId }: { amountCents: number; orderId: number }) {
    const id = `cs_${orderId}_${amountCents}_${fakePayments.links.size}`;
    fakePayments.links.set(id, { status: 'open', amountCents });
    return { id, url: `https://checkout.stripe.test/${id}` };
  },
  async getPaymentLink(id: string) {
    const l = fakePayments.links.get(id);
    return l?.status === 'paid' ? { status: 'paid' as const, paymentId: `pi_${id}` } : { status: l?.status || ('expired' as const) };
  },
  // Webhooks: 'test-signature' is genuine, anything else is forged.
  parseWebhook(raw: Buffer, signature: string) {
    if (signature !== 'test-signature') throw new Error('No signatures found matching the expected signature');
    return JSON.parse(raw.toString('utf8'));
  },
  async checkKey(key: string) {
    if (!key.startsWith('sk_test_')) throw new Error('Invalid API Key provided');
    return 'Test Shop';
  },
};

// Fake Safaricom Daraja: tests set what a prompt ends up as.
export const fakeMpesa = {
  prompts: [] as { phone: string; amount: number; callbackUrl: string; id: string }[],
  results: new Map<string, 'paid' | 'failed' | 'pending'>(),
  async checkCredentials(cfg: { consumerKey: string }) {
    if (cfg.consumerKey === 'wrong') throw Object.assign(new Error('bad'), { messages: ['Safaricom didn’t accept the consumer key and secret.'] });
  },
  async stkPush(_cfg: unknown, input: { phone: string; amount: number; callbackUrl: string }) {
    const id = `ws_CO_${fakeMpesa.prompts.length + 1}`;
    fakeMpesa.prompts.push({ ...input, id });
    fakeMpesa.results.set(id, 'pending');
    return { checkoutRequestId: id, customerMessage: 'Success. Request accepted for processing' };
  },
  async query(_cfg: unknown, id: string) {
    const status = fakeMpesa.results.get(id) || 'pending';
    return { status, message: status === 'failed' ? 'Request cancelled by user' : status };
  },
};
export const app = createApp({
  verifyGoogle: async (idToken) => {
    const identity = googleIdentities[idToken];
    if (!identity) throw new Error('bad token');
    return identity;
  },
  payments: fakePayments,
  mpesa: fakeMpesa,
});

export const PASSWORD = 'Str0ng!Pass1';

// Resets run one after another: if one overruns a timeout, the next waits
// for it instead of fighting it for locks (which deadlocks).
let resetting: Promise<void> = Promise.resolve();
export const resetDatabase = () => {
  resetting = resetting.catch(() => undefined).then(doReset);
  return resetting;
};

const doReset = async () => {
  clearSettingsCache();
  await query(
    `TRUNCATE audit_logs, auth_tokens, sessions, users, products, categories, coupons, orders,
       order_items, order_history, returns, cart_items, checkout_state, wishlist_items, addresses,
       newsletter_subscribers, brands, promotions, role_permissions, roles, permissions, sla_settings, legal_pages, support_tickets, support_messages, faq_items, store_settings, payment_providers, search_queries, stock_movements, finance_settings, rate_limits RESTART IDENTITY CASCADE`
  );
  await loadFinance(); // before seeding, which prices in the shop's currency
  await loadDelivery();
  await loadSla();
  await loadProviders();
  await runSeed();
  sentEmails.length = 0;
  fakePayments.intents.clear();
  fakePayments.refunds.length = 0;
  fakePayments.partialRefunds.length = 0;
  fakePayments.links.clear();
  fakeMpesa.prompts.length = 0;
  fakeMpesa.results.clear();
};

export const createUser = async (email: string, role = 'customer', password: string | null = PASSWORD) => {
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, firstname, lastname, role_id, email_verified_at)
     SELECT $1, $2, 'Test', 'User', id, now() FROM roles WHERE code = $3 RETURNING id`,
    [email, password ? await hashPassword(password) : null, role]
  );
  return rows[0].id as number;
};

/** Signs in and returns the access token plus the refresh cookie. */
export const signIn = async (email: string, password = PASSWORD) => {
  const res = await request(app).post('/api/rest/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${JSON.stringify(res.body)}`);
  return {
    token: res.body.data.access_token as string,
    cookie: res.headers['set-cookie'][0].split(';')[0] as string,
    user: res.body.data.user,
  };
};

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
export const ajax = { 'X-Requested-With': 'XMLHttpRequest' };

export const closePool = () => pool.end();
