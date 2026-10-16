import request from 'supertest';
import { query } from '../src/db';
import { app, bearer, closePool, createUser, resetDatabase, signIn } from './helpers';

jest.mock('../src/lib/mailer', () => require('./mailerMock').mailerMock());

beforeEach(resetDatabase);
afterAll(closePool);

const M = { Size: 'M' };
const ADDRESS = {
  firstname: 'Jane', lastname: 'Doe', address_1: '1 Market St', city: 'Nairobi',
  postcode: '00100', country: 'ke', telephone: '+254700000000',
};
const productId = async (name: string) => (await query('SELECT id FROM products WHERE name = $1', [name])).rows[0].id as number;
const staff = async (role: string, email: string) => {
  await createUser(email, role);
  return (await signIn(email)).token;
};

describe('data for reports', () => {
  test('stock movements record sales, cancellations and staff adjustments; order lines keep their cost', async () => {
    const admin = await staff('admin', 'boss@example.com');
    const jacket = await productId('Denim jacket');
    // Staff set a cost price on the product and on one variant.
    const product = (await request(app).get(`/api/admin/products/${jacket}`).set(bearer(admin))).body.data;
    const variants = product.variants.map((v: any) => ({
      ...v, cost_price: v.options.Size === 'M' ? 31.5 : null,
    }));
    const saved = (await request(app).put(`/api/admin/products/${jacket}`).set(bearer(admin))
      .send({ cost_price: 28, variants })).body.data;
    expect(saved.cost_price).toBe(28);
    expect(saved.variants.find((v: any) => v.options.Size === 'M').cost_price).toBe(31.5);
    // Never shown in the shop.
    const pub = (await request(app).get(`/api/rest/products/${jacket}`)).body.data;
    expect(JSON.stringify(pub)).not.toContain('cost_price');

    // A sale takes stock (and keeps the cost), a cancellation puts it back.
    await createUser('jane@example.com');
    const { token } = await signIn('jane@example.com');
    await request(app).post('/api/rest/cart').set(bearer(token)).send({ product_id: jacket, quantity: 2, option: M }).expect(200);
    await request(app).post('/api/rest/shippingaddress').set(bearer(token)).send(ADDRESS).expect(201);
    await request(app).post('/api/rest/shippingmethods').set(bearer(token)).send({ shipping_method: 'standard' }).expect(200);
    await request(app).post('/api/rest/paymentmethods').set(bearer(token)).send({ payment_method: 'cod', agree: true }).expect(200);
    await request(app).post('/api/rest/confirm').set(bearer(token)).expect(200);
    const order = (await request(app).put('/api/rest/confirm').set(bearer(token))).body.data;
    const line = (await query('SELECT unit_cost FROM order_items WHERE order_id = $1', [order.order_id])).rows[0];
    expect(Number(line.unit_cost)).toBe(31.5);
    await request(app).put(`/api/admin/orderhistory/${order.order_id}`).set(bearer(admin)).send({ order_status: 'cancelled' }).expect(200);

    const moves = (await query(
      `SELECT m.change, m.reason, m.order_id, m.user_id IS NOT NULL AS by_someone
       FROM stock_movements m JOIN product_variants v ON v.id = m.variant_id
       WHERE m.product_id = $1 AND v.options->>'Size' = 'M' ORDER BY m.id`,
      [jacket]
    )).rows;
    expect(moves.map((m) => [m.reason, m.change])).toEqual([
      ['initial', expect.any(Number)],
      ['sale', -2],
      ['cancelled', 2],
    ]);
    expect(moves[1]).toMatchObject({ order_id: order.order_id, by_someone: true });

    // A staff edit to the stock is an adjustment by that person.
    const editVariants = saved.variants.map((v: any) => ({ ...v, quantity: v.options.Size === 'M' ? v.quantity + 5 : v.quantity }));
    await request(app).put(`/api/admin/products/${jacket}`).set(bearer(admin)).send({ variants: editVariants }).expect(200);
    const last = (await query('SELECT reason, change, user_id FROM stock_movements ORDER BY id DESC LIMIT 1')).rows[0];
    expect(last).toMatchObject({ reason: 'adjustment', change: 5, user_id: expect.any(Number) });

    // Stock still adds up: the movements explain today's quantity.
    const sum = (await query(
      `SELECT v.quantity, COALESCE((SELECT sum(change) FROM stock_movements WHERE variant_id = v.id), 0)::int AS moved
       FROM product_variants v WHERE v.product_id = $1`,
      [jacket]
    )).rows;
    sum.forEach((r) => expect(r.moved).toBe(r.quantity));
  });

  test('shop searches are recorded once per search, with how many results they found', async () => {
    const search = (term: string, agent = 'phone') =>
      request(app).get('/api/rest/products').query({ search: term, limit: 4 }).set('User-Agent', agent).expect(200);
    // Typing: one search, the last term.
    for (const t of ['jac', 'jack', 'jacket']) await search(t);
    await search('zzqqxx');
    await search('jacket', 'laptop'); // someone else
    const rows = (await query('SELECT normalized, results FROM search_queries ORDER BY id')).rows;
    expect(rows.map((r) => r.normalized)).toEqual(['jacket', 'zzqqxx', 'jacket']);
    expect(rows[0].results).toBeGreaterThan(0);
    expect(rows[1].results).toBe(0);
    // Paging through results isn't a new search.
    await request(app).get('/api/rest/products').query({ search: 'jacket', page: 2, limit: 1 }).set('User-Agent', 'tablet');
    expect((await query('SELECT count(*)::int AS n FROM search_queries')).rows[0].n).toBe(3);
    // Suggestions shown while typing aren't searches either.
    const suggested = await request(app).get('/api/rest/products')
      .query({ search: 'denim', limit: 6, suggest: 1 }).set('User-Agent', 'watch').expect(200);
    expect(suggested.body.data.length).toBeGreaterThan(0);
    expect((await query('SELECT count(*)::int AS n FROM search_queries')).rows[0].n).toBe(3);
  });

  test('cost prices: demo products come with costs; staff edit them, fill missing ones from a margin, and use them for past orders', async () => {
    const admin = await staff('admin', 'boss@example.com');
    // The demo catalog has costs, so margins show from the start.
    const missingAtStart = (await request(app).get('/api/admin/cost-prices').set(bearer(admin))).body.data.counts;
    expect(missingAtStart).toMatchObject({ missing: 0 });
    const ops = await staff('order_manager', 'ops@example.com');
    expect((await request(app).get('/api/admin/cost-prices').set(bearer(ops))).status).toBe(403);

    // A product without a cost, and a past order line of it.
    const tote = await productId('Canvas tote bag');
    await query('UPDATE products SET cost_price = NULL WHERE id = $1', [tote]);
    const orderId = (await query(
      `INSERT INTO orders (email, status, payment_method, shipping_method, shipping_address, payment_address, subtotal, shipping_total, tax_total, total, currency, number, placed_at)
       VALUES ('x@example.com', 'delivered', 'cod', 'standard', '{}', '{}', 20, 0, 0, 20, 'USD', 'WEB-TEST', now()) RETURNING id`
    )).rows[0].id;
    await query(
      `INSERT INTO order_items (order_id, product_id, name, image, options, unit_price, quantity, total)
       VALUES ($1, $2, 'Canvas tote bag', '', '{}', 20, 1, 20)`,
      [orderId, tote]
    );
    const missing = (await request(app).get('/api/admin/cost-prices?missing=1').set(bearer(admin))).body.data;
    expect(missing.items.map((i: any) => i.name)).toEqual(['Canvas tote bag']);
    expect(missing.items[0]).toMatchObject({ cost_price: null, margin: null });

    // Filling from a 40% margin, used for past orders too.
    const filled = (await request(app).post('/api/admin/cost-prices/fill').set(bearer(admin))
      .send({ margin_percent: 40, apply_to_past_orders: true })).body.data;
    expect(filled.filled).toBe(1);
    const row = (await request(app).get('/api/admin/cost-prices?search=tote').set(bearer(admin))).body.data.items[0];
    expect(row.margin).toBeCloseTo(40, 0);
    expect(Number((await query('SELECT unit_cost FROM order_items WHERE order_id = $1', [orderId])).rows[0].unit_cost))
      .toBeCloseTo(row.cost_price, 2);

    // Editing a cost; past order lines that already have one keep it.
    await request(app).put('/api/admin/cost-prices').set(bearer(admin))
      .send({ items: [{ product_id: tote, variant_id: null, cost_price: 5 }], apply_to_past_orders: true }).expect(200);
    expect(Number((await query('SELECT cost_price FROM products WHERE id = $1', [tote])).rows[0].cost_price)).toBe(5);
    expect(Number((await query('SELECT unit_cost FROM order_items WHERE order_id = $1', [orderId])).rows[0].unit_cost))
      .toBeCloseTo(row.cost_price, 2);
    expect((await request(app).post('/api/admin/cost-prices/fill').set(bearer(admin)).send({ margin_percent: 120 })).status).toBe(400);
  });

  test('deal views and clicks are counted (views once per visitor a day) and reported per deal', async () => {
    const admin = await staff('admin', 'boss@example.com');
    const deals = (await request(app).get('/api/admin/deals').set(bearer(admin))).body.data;
    const deal = deals[0];
    const send = (kind: string, placement: string, agent = 'phone') =>
      request(app).post(`/api/rest/promotions/${deal.promotion_id}/events`).set('User-Agent', agent).send({ kind, placement });
    await send('view', 'strip').expect(204);
    await send('view', 'strip').expect(204); // same visitor, same day: once
    await send('view', 'banner').expect(204);
    await send('view', 'strip', 'laptop').expect(204);
    await send('click', 'strip').expect(204);
    await send('click', 'banner', 'laptop').expect(204);
    expect((await send('stare', 'strip')).status).toBe(400);
    await request(app).post('/api/rest/promotions/999999/events').send({ kind: 'view', placement: 'strip' }).expect(204);

    const report = (await request(app).get('/api/admin/reports/promotions').set(bearer(admin))).body.data;
    expect(report.cards.find((c: any) => c.key === 'deal_views').value).toBe(3);
    expect(report.cards.find((c: any) => c.key === 'deal_clicks').value).toBe(2);
    const row = report.breakdowns[0].rows.find((r: any) => r.title === deal.title);
    expect(row).toMatchObject({ views: 3, clicks: 2, rate: 66.67, split: '1 / 1' });
    expect(report.notes).toBeUndefined();
  });
});
