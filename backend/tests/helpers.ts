import request from 'supertest';
import { clearSettingsCache } from '../src/lib/settings';
import { createApp } from '../src/app';
import { pool, query } from '../src/db';
import { hashPassword } from '../src/lib/security';
import { GoogleIdentity } from '../src/lib/google';
import { loadFinance } from '../src/lib/finance';
import { loadDelivery } from '../src/lib/delivery';
import { loadSla } from '../src/lib/sla';
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
};
export const app = createApp({
  verifyGoogle: async (idToken) => {
    const identity = googleIdentities[idToken];
    if (!identity) throw new Error('bad token');
    return identity;
  },
  payments: fakePayments,
});

export const PASSWORD = 'Str0ng!Pass1';

export const resetDatabase = async () => {
  clearSettingsCache();
  await query(
    `TRUNCATE audit_logs, auth_tokens, sessions, users, products, categories, coupons, orders,
       order_items, order_history, returns, cart_items, checkout_state, wishlist_items, addresses,
       newsletter_subscribers, brands, promotions, role_permissions, roles, permissions, sla_settings, legal_pages, support_tickets, support_messages, faq_items, store_settings RESTART IDENTITY CASCADE`
  );
  await loadFinance(); // before seeding, which prices in the shop's currency
  await loadDelivery();
  await loadSla();
  await runSeed();
  sentEmails.length = 0;
  fakePayments.intents.clear();
  fakePayments.refunds.length = 0;
  fakePayments.partialRefunds.length = 0;
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
