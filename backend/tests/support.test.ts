import request from 'supertest';
import { query } from '../src/db';
import { app, bearer, closePool, createUser, resetDatabase, sentEmails, signIn } from './helpers';

jest.mock('../src/lib/mailer', () => require('./mailerMock').mailerMock());

beforeEach(resetDatabase);
afterAll(closePool);

const form = {
  name: 'Amina Otieno', email: 'amina@example.com', category: 'order',
  subject: 'Where is my parcel?', message: 'My order has not arrived yet, can you check please?',
};

describe('support requests', () => {
  test('anyone can ask for help; the customer is acknowledged and the shop alerted', async () => {
    await query(`INSERT INTO store_settings (id, settings) VALUES (1, '{"email":"help@shop.test"}'::jsonb)
                 ON CONFLICT (id) DO UPDATE SET settings = store_settings.settings || '{"email":"help@shop.test"}'::jsonb`);
    const bad = await request(app).post('/api/rest/support').send({ ...form, email: 'nope', message: 'short' });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.field_errors)).toEqual(expect.arrayContaining(['email', 'message']));

    const res = await request(app).post('/api/rest/support').send(form);
    expect(res.status).toBe(201);
    expect(res.body.data.number).toMatch(/^SUP-[0-9A-Z]{9}$/);
    const n = res.body.data.number;
    expect(sentEmails.map((e) => [e.to, e.kind])).toEqual(expect.arrayContaining([
      ['amina@example.com', `support:received:${n}`],
      ['help@shop.test', `support:alert:${n}`],
    ]));
  });

  test('customers link their own orders, follow replies and reply back; staff reply and close', async () => {
    await createUser('jane@example.com');
    const jane = await signIn('jane@example.com');
    await createUser('kim@example.com');
    const kimId = (await query("SELECT id FROM users WHERE email = 'kim@example.com'")).rows[0].id;
    const kimOrder = (await query(
      `INSERT INTO orders (user_id, email, status, payment_method, shipping_method, shipping_address, payment_address,
         subtotal, discount, shipping_total, tax_total, total, currency, number, placed_at)
       VALUES ($1, 'kim@example.com', 'pending', 'cod', 'standard', '{}', '{}', 0, 0, 0, 0, 0, 'USD', 'WEB-KIM000001', now())
       RETURNING id`, [kimId]
    )).rows[0].id;
    const notMine = await request(app).post('/api/rest/support').set(bearer(jane.token)).send({ ...form, order_id: kimOrder });
    expect(notMine.body.error).toEqual(['That order isn’t in your account.']);

    const created = (await request(app).post('/api/rest/support').set(bearer(jane.token))
      .send({ ...form, email: 'jane@example.com', name: 'Jane' })).body.data;
    const mine = (await request(app).get('/api/rest/support').set(bearer(jane.token))).body.data;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ number: created.number, status: 'open', status_name: 'Open' });

    // Catalog managers can't see support; the Support role can and replies.
    await createUser('cat@example.com', 'catalog_manager');
    const cat = await signIn('cat@example.com');
    expect((await request(app).get('/api/admin/support').set(bearer(cat.token))).status).toBe(403);
    await createUser('help@example.com', 'support');
    const helper = await signIn('help@example.com');
    const inbox = (await request(app).get('/api/admin/support?status=open').set(bearer(helper.token))).body.data;
    expect(inbox).toMatchObject({ total: 1, counts: { open: 1 } });
    const id = inbox.tickets[0].ticket_id;
    const bell = (await request(app).get('/api/admin/notifications').set(bearer(helper.token))).body.data;
    expect(bell.support_open).toBe(1);
    expect(bell.items.some((i: any) => i.kind === 'support')).toBe(true);

    const replied = await request(app).post(`/api/admin/support/${id}/messages`).set(bearer(helper.token))
      .send({ body: 'It is out for delivery today.' });
    expect(replied.body.data).toMatchObject({ status: 'waiting', last_from: 'staff' });
    expect(replied.body.data.messages.at(-1)).toMatchObject({ author: 'staff', name: 'Test User' });
    expect(sentEmails.some((e) => e.kind === `support:reply:${created.number}` && e.to === 'jane@example.com')).toBe(true);

    // The customer sees "<shop> support", replies, and the request reopens.
    let thread = (await request(app).get(`/api/rest/support/${created.number}`).set(bearer(jane.token))).body.data;
    expect(thread.messages.at(-1)).toMatchObject({ author: 'staff', name: 'Carlos Shop support' });
    thread = (await request(app).post(`/api/rest/support/${created.number}/messages`).set(bearer(jane.token))
      .send({ body: 'Thank you!' })).body.data;
    expect(thread).toMatchObject({ status: 'open', last_from: 'customer' });

    await request(app).put(`/api/admin/support/${id}`).set(bearer(helper.token)).send({ status: 'closed' }).expect(200);
    const closed = await request(app).post(`/api/rest/support/${created.number}/messages`).set(bearer(jane.token))
      .send({ body: 'One more thing' });
    expect(closed.body.error).toEqual(['This request is closed. Please send a new request.']);
    expect((await request(app).get(`/api/rest/support/${created.number}`).set(bearer((await signIn('kim@example.com')).token))).status).toBe(404);
  });
});

describe('FAQ and About us', () => {
  test('a new shop has a useful FAQ with settings filled in; admins manage it', async () => {
    const faq = (await request(app).get('/api/rest/faq')).body.data;
    expect(faq.length).toBeGreaterThanOrEqual(10);
    const returns = faq.find((f: any) => f.question === 'Can I return an item?');
    expect(returns.answer).toContain('<strong>14 days</strong>');
    expect(JSON.stringify(faq)).not.toMatch(/\{\{/);

    await createUser('cat@example.com', 'catalog_manager');
    const cat = await signIn('cat@example.com');
    expect((await request(app).post('/api/admin/faq').set(bearer(cat.token)).send({})).status).toBe(403);

    await createUser('boss@example.com', 'admin');
    const admin = await signIn('boss@example.com');
    const made = await request(app).post('/api/admin/faq').set(bearer(admin.token)).send({
      category: 'Gifts', question: 'Can I send a gift?', answer: '<p>Yes, <em>tick</em> “Send as a gift”.</p><script>x</script>',
    });
    expect(made.status).toBe(201);
    expect(made.body.data.answer).toBe('<p>Yes, <em>tick</em> “Send as a gift”.</p>');
    await request(app).put(`/api/admin/faq/${made.body.data.faq_id}`).set(bearer(admin.token)).send({ published: false }).expect(200);
    expect((await request(app).get('/api/rest/faq')).body.data.some((f: any) => f.category === 'Gifts')).toBe(false);
    await request(app).delete(`/api/admin/faq/${made.body.data.faq_id}`).set(bearer(admin.token)).expect(200);
    expect((await request(app).get('/api/admin/faq').set(bearer(admin.token))).body.data.some((f: any) => f.category === 'Gifts')).toBe(false);
  });

  test('About us is an editable page', async () => {
    const about = (await request(app).get('/api/rest/legal/about')).body.data;
    expect(about.title).toBe('About us');
    expect(about.body).toContain('<strong>Carlos Shop</strong>');
  });
});
