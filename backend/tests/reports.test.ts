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
const order = async (token: string, coupon?: string) => {
  await request(app).post('/api/rest/cart').set(bearer(token))
    .send({ product_id: await productId('Denim jacket'), quantity: 2, option: M }).expect(200);
  if (coupon) await request(app).post('/api/rest/coupon').set(bearer(token)).send({ coupon }).expect(200);
  await request(app).post('/api/rest/shippingaddress').set(bearer(token)).send(ADDRESS).expect(201);
  await request(app).post('/api/rest/shippingmethods').set(bearer(token)).send({ shipping_method: 'standard' }).expect(200);
  await request(app).post('/api/rest/paymentmethods').set(bearer(token)).send({ payment_method: 'cod', agree: true }).expect(200);
  await request(app).post('/api/rest/confirm').set(bearer(token)).expect(200);
  return (await request(app).put('/api/rest/confirm').set(bearer(token))).body.data;
};
const cardOf = (r: any, key: string) => r.cards.find((c: any) => c.key === key);

describe('reports', () => {
  test('each report answers from real orders, returns, payments, support and searches', async () => {
    const admin = await staff('admin', 'boss@example.com');
    const report = (name: string, query: object = {}, who = admin) =>
      request(app).get(`/api/admin/reports/${name}`).query(query).set(bearer(who));

    await createUser('jane@example.com');
    const jane = (await signIn('jane@example.com')).token;
    const first = await order(jane, 'WELCOME10');
    const second = await order(jane);
    // The first order is delivered (cash collected), then one item comes back and is refunded.
    for (const s of ['processing', 'shipped', 'delivered']) {
      await request(app).put(`/api/admin/orderhistory/${first.order_id}`).set(bearer(admin)).send({ order_status: s }).expect(200);
    }
    const ret = (await request(app).post('/api/rest/returns').set(bearer(jane)).send({
      order_id: first.order_id, order_product_id: first.products[0].order_product_id, quantity: 1, reason: 'damaged',
    })).body.data;
    for (const status of ['approved', 'received', 'refunded']) {
      await request(app).put(`/api/admin/returns/${ret.return_id}`).set(bearer(admin)).send({ status }).expect(200);
    }
    await request(app).post('/api/rest/support').send({
      name: 'Jane', email: 'jane@example.com', category: 'order', subject: 'Where is it?', message: 'My second order hasn’t arrived yet.',
    }).expect(201);
    await request(app).get('/api/rest/products').query({ search: 'nothing-like-this', limit: 4 });

    const sales = (await report('sales')).body.data;
    expect(cardOf(sales, 'orders').value).toBe(2);
    const total = first.total + second.total;
    expect(cardOf(sales, 'sales').value).toBeCloseTo(total, 2);
    expect(cardOf(sales, 'refunds').value).toBeGreaterThan(0);
    expect(cardOf(sales, 'net').value).toBeCloseTo(total - cardOf(sales, 'refunds').value, 2);
    expect(sales.series.datasets.map((d: any) => d.key)).toEqual(['net', 'orders']);
    expect(sales.breakdowns.find((b: any) => b.title === 'By payment method').rows[0]).toMatchObject({ name: 'Cash on delivery', orders: 2 });

    const products = (await report('products')).body.data;
    expect(products.table.rows.find((r: any) => r.name === 'Denim jacket')).toMatchObject({ units: 4, orders: 2, returned: 1, return_rate: 25 });

    const inventory = (await report('inventory', { product: await productId('Denim jacket') })).body.data;
    const m = inventory.table.rows.find((r: any) => r.name === 'Denim jacket · M');
    expect(m).toMatchObject({ units: 4 });
    const reasons = inventory.breakdowns[0].rows.map((r: any) => r.name);
    expect(reasons).toEqual(expect.arrayContaining(['Sold', 'Returned']));

    const customers = (await report('customers')).body.data;
    expect(cardOf(customers, 'buyers').value).toBe(1);
    expect(customers.table.rows[0]).toMatchObject({ orders: 2 });

    const promos = (await report('promotions')).body.data;
    expect(cardOf(promos, 'with_code').value).toBe(1);
    expect(promos.table.rows[0]).toMatchObject({ code: 'WELCOME10', uses: 1 });
    expect(promos.breakdowns.find((b: any) => b.title.startsWith('First orders')).rows[0])
      .toMatchObject({ code: 'WELCOME10', first_orders: 1, came_back: 1 });

    const service = (await report('service')).body.data;
    expect(cardOf(service, 'returns').value).toBe(1);
    expect(cardOf(service, 'tickets').value).toBe(1);
    expect(service.breakdowns[0].rows[0]).toMatchObject({ returns: 1 });

    const fin = (await report('finance')).body.data;
    expect(cardOf(fin, 'received').value).toBeGreaterThan(0); // cash collected on delivery
    expect(fin.breakdowns.find((b: any) => b.title === 'Unpaid invoices by age').rows[0]).toMatchObject({ name: '0–30 days', invoices: 1 });
    expect(cardOf(fin, 'cod').value).toBeCloseTo(second.total, 2); // the undelivered order

    const search = (await report('search')).body.data;
    expect(search.table.rows[0]).toMatchObject({ term: 'nothing-like-this', results: 0 });

    // Comparing with last year, grouping by month, and a bad range.
    const monthly = (await report('sales', { from: '2026-01-01', to: '2026-12-31', compare: 'last_year' })).body.data;
    expect(monthly.period).toMatchObject({ group: 'month', compare: { from: '2025-01-02' } });
    expect((await report('sales', { from: '2026-02-01', to: '2026-01-01' })).status).toBe(400);
    expect((await report('nope')).status).toBe(404);

    // Permissions: order managers see reports and finance; catalog managers don't.
    const ops = await staff('order_manager', 'ops@example.com');
    await report('sales', {}, ops).expect(200);
    await report('finance', {}, ops).expect(200);
    const cat = await staff('catalog_manager', 'cat@example.com');
    expect((await report('sales', {}, cat)).status).toBe(403);
  });
});
