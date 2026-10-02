import request from 'supertest';
import { createApp } from '../src/app';
import { pool, query } from '../src/db';
import { hashPassword } from '../src/lib/security';
import { GoogleIdentity } from '../src/lib/google';
import { runSeed } from '../src/seed';

// Captured emails (the mailer is mocked in each test file).
export const sentEmails: { to: string; link: string; kind: string }[] = [];

export const googleIdentities: Record<string, GoogleIdentity> = {};

// Fake Stripe: tests set the status a PaymentIntent will report.
export const fakePayments = {
  intents: new Map<string, { status: string; amountCents: number; orderId: number }>(),
  refunds: [] as string[],
  async createIntent({ amountCents, orderId }: { amountCents: number; orderId: number }) {
    const id = `pi_${orderId}_${amountCents}`;
    fakePayments.intents.set(id, { status: 'requires_payment_method', amountCents, orderId });
    return { id, clientSecret: `${id}_secret` };
  },
  async getStatus(id: string) {
    return fakePayments.intents.get(id)?.status || 'failed';
  },
  async refund(id: string) {
    fakePayments.refunds.push(id);
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
  await query(
    `TRUNCATE audit_logs, auth_tokens, sessions, users, products, categories, coupons, orders,
       order_items, order_history, returns, cart_items, checkout_state, wishlist_items, addresses,
       newsletter_subscribers, role_permissions, roles, permissions RESTART IDENTITY CASCADE`
  );
  await runSeed();
  sentEmails.length = 0;
  fakePayments.intents.clear();
  fakePayments.refunds.length = 0;
};

export const createUser = async (email: string, role = 'customer', password: string | null = PASSWORD) => {
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, firstname, lastname, role_id)
     SELECT $1, $2, 'Test', 'User', id FROM roles WHERE code = $3 RETURNING id`,
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
