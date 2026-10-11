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
  });
});
