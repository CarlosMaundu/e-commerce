import request from 'supertest';
import { query } from '../src/db';
import { app, bearer, closePool, createUser, resetDatabase, signIn } from './helpers';

jest.mock('../src/lib/mailer', () => require('./mailerMock').mailerMock());

beforeEach(resetDatabase);
afterAll(closePool);

const order = async (userId: number, number: string) =>
  (
    await query(
      `INSERT INTO orders (user_id, email, status, payment_method, shipping_method, shipping_address, payment_address,
         subtotal, shipping_total, tax_total, total, currency, number, placed_at)
       VALUES ($1, 'cam@example.com', 'pending', 'cod', 'standard', '{}', '{}', 20, 0, 0, 20, 'USD', $2, now() - interval '1 hour')
       RETURNING id`,
      [userId, number]
    )
  ).rows[0].id as number;

describe('the shopper’s bell', () => {
  test('shows their own order and support updates, marks them read, dismisses and clears', async () => {
    const camId = await createUser('cam@example.com');
    const otherId = await createUser('other@example.com');
    const { token } = await signIn('cam@example.com');
    const other = (await signIn('other@example.com')).token;

    const mine = await order(camId, 'WEB-MINE');
    await order(otherId, 'WEB-THEIRS');
    await query(`INSERT INTO order_history (order_id, status, created_at) VALUES ($1, 'pending', now() - interval '50 minutes')`, [mine]);
    await query(`INSERT INTO order_history (order_id, status, created_at) VALUES ($1, 'shipped', now() - interval '10 minutes')`, [mine]);
    const ticket = (
      await query(
        `INSERT INTO support_tickets (number, user_id, name, email, category, subject)
         VALUES ('SUP-TEST1', $1, 'Cam', 'cam@example.com', 'order', 'Where is my parcel?') RETURNING id`,
        [camId]
      )
    ).rows[0].id;
    await query(`INSERT INTO support_messages (ticket_id, author, body) VALUES ($1, 'staff', 'On its way!')`, [ticket]);

    const list = (await request(app).get('/api/rest/account/notifications').set(bearer(token)).expect(200)).body.data;
    expect(list.items.map((i: any) => i.title)).toEqual([
      'New reply on SUP-TEST1',
      'Order WEB-MINE is on its way',
      'Order WEB-MINE placed',
    ]);
    expect(list.unread).toBe(3);
    expect(list.items[1].link).toBe(`/account/orders/${mine}`);

    // Someone else's orders never show.
    const theirs = (await request(app).get('/api/rest/account/notifications').set(bearer(other))).body.data;
    expect(JSON.stringify(theirs)).not.toMatch(/WEB-MINE|SUP-TEST1/);

    await request(app).post('/api/rest/account/notifications/read').set(bearer(token)).expect(200);
    expect((await request(app).get('/api/rest/account/notifications').set(bearer(token))).body.data.unread).toBe(0);

    await request(app).delete(`/api/rest/account/notifications/${encodeURIComponent(list.items[0].key)}`).set(bearer(token)).expect(200);
    expect((await request(app).get('/api/rest/account/notifications').set(bearer(token))).body.data.total).toBe(2);

    await request(app).post('/api/rest/account/notifications/clear').set(bearer(token)).expect(200);
    expect((await request(app).get('/api/rest/account/notifications').set(bearer(token))).body.data.items).toEqual([]);

    // Signed out: no bell.
    await request(app).get('/api/rest/account/notifications').expect(401);
  });
});
