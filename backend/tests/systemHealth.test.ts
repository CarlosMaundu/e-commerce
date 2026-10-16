// Time zone, currency separation, the email outbox and data retention.
import request from 'supertest';
import { query } from '../src/db';
import { app, bearer, closePool, createUser, resetDatabase, signIn } from './helpers';

// A fake mail server that can be made to fail.
const transport = { fail: true, sent: [] as string[] };
jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: async ({ to }: { to: string }) => {
      if (transport.fail) throw new Error('connect ECONNREFUSED');
      transport.sent.push(to);
    },
  }),
}));

beforeEach(async () => {
  await resetDatabase();
  await query('TRUNCATE email_outbox');
  transport.fail = true;
  transport.sent.length = 0;
});
afterAll(closePool);

const settle = () => new Promise((r) => setTimeout(r, 100));

describe('system health', () => {
  test('the database works in the shop’s time zone', async () => {
    const row = (await query('SHOW timezone')).rows[0];
    expect(row.TimeZone ?? row.timezone).toBe('Africa/Nairobi');
  });

  test('emails are saved, sent in the background, and retried when the mail server is down', async () => {
    const { deliverDueEmails, sendPasswordResetEmail } = jest.requireActual('../src/lib/mailer');
    // The request doesn't fail or wait while the mail server is down.
    await sendPasswordResetEmail('jane@example.com', 'https://shop.test/reset');
    await settle();
    let row = (await query('SELECT * FROM email_outbox')).rows[0];
    expect(row).toMatchObject({ to_address: 'jane@example.com', attempts: 1, sent_at: null });
    expect(row.last_error).toMatch(/ECONNREFUSED/);
    // Not due yet: nothing is retried.
    expect(await deliverDueEmails()).toBe(0);
    // Later, the mail server is back and the retry goes through.
    transport.fail = false;
    await query(`UPDATE email_outbox SET next_attempt_at = now() - interval '1 minute'`);
    expect(await deliverDueEmails()).toBe(1);
    row = (await query('SELECT * FROM email_outbox')).rows[0];
    expect(row.sent_at).not.toBeNull();
    expect(transport.sent).toEqual(['jane@example.com']);
  });

  test('reports count the shop’s currency only and say what was left out', async () => {
    await createUser('boss@example.com', 'admin');
    const { token } = await signIn('boss@example.com');
    // Two orders today: one in the shop's currency (USD), one in EUR.
    for (const [currency, number] of [['USD', 'WEB-USD1'], ['EUR', 'WEB-EUR1']]) {
      await query(
        `INSERT INTO orders (email, status, payment_method, shipping_method, shipping_address, payment_address,
           subtotal, shipping_total, tax_total, total, currency, number, placed_at)
         VALUES ('x@example.com', 'processing', 'cod', 'standard', '{}', '{}', 50, 0, 0, 50, $1, $2, now())`,
        [currency, number]
      );
    }
    const report = (await request(app).get('/api/admin/reports/sales').set(bearer(token))).body.data;
    expect(report.cards.find((c: any) => c.key === 'orders').value).toBe(1);
    expect(report.cards.find((c: any) => c.key === 'sales').value).toBe(50);
    expect(report.notes).toEqual(['1 order in EUR isn’t included: totals are in USD only.']);
    // The dashboard counts the same way.
    const overview = (await request(app).get('/api/admin/dashboard?days=7').set(bearer(token))).body.data;
    expect(overview.kpis.revenue.value).toBe(50);
  });

  test('old analytics and audit rows are removed; orders and stock records stay', async () => {
    const { removeOldData } = await import('../src/lib/jobs');
    await query(
      `INSERT INTO search_queries (term, normalized, results, visitor, created_at) VALUES
         ('old', 'old', 0, 'v', now() - interval '500 days'), ('new', 'new', 2, 'v', now())`
    );
    await query(`INSERT INTO audit_logs (action, created_at) VALUES ('old', now() - interval '3 years'), ('new', now())`);
    const stock = (await query('SELECT count(*)::int AS n FROM stock_movements')).rows[0].n;
    expect(await removeOldData()).toBe(2);
    expect((await query('SELECT term FROM search_queries')).rows.map((r) => r.term)).toEqual(['new']);
    expect((await query(`SELECT count(*)::int AS n FROM audit_logs WHERE action = 'old'`)).rows[0].n).toBe(0);
    expect((await query('SELECT count(*)::int AS n FROM stock_movements')).rows[0].n).toBe(stock);
  });
});
