import request from 'supertest';
import { query } from '../src/db';
import { app, bearer, closePool, createUser, resetDatabase, signIn } from './helpers';

jest.mock('../src/lib/mailer', () => require('./mailerMock').mailerMock());

beforeEach(async () => {
  await resetDatabase();
  await query('UPDATE product_variants SET quantity = 25');
  await query(`UPDATE products p SET quantity = s.total FROM
    (SELECT product_id, sum(quantity)::int AS total FROM product_variants GROUP BY product_id) s WHERE s.product_id = p.id`);
});
afterAll(closePool);

const productId = async (name: string) =>
  (await query('SELECT id FROM products WHERE name = $1', [name])).rows[0].id as number;
const ADDRESS = {
  firstname: 'Jane', lastname: 'Doe', address_1: '1 Market St', city: 'Nairobi',
  postcode: '00100', country: 'ke', telephone: '+254700000000',
};

describe('ticking cart items to check out', () => {
  test('only ticked items are priced and ordered; the rest stay in the cart', async () => {
    await createUser('jane@example.com');
    const { token } = await signIn('jane@example.com');
    const add = (name: string, option: Record<string, string> = {}) =>
      request(app).post('/api/rest/cart').set(bearer(token))
        .send({ product_id: name, quantity: 1, option }).expect(200);
    await add(String(await productId('Denim jacket')), { Size: 'M' });
    const both = (await add(String(await productId('Canvas tote bag')))).body.data;
    expect(both.products.every((p: any) => p.selected)).toBe(true); // new items start ticked
    const [jacket, tote] = both.products;

    // Untick the tote: the totals are the jacket's alone.
    const one = (await request(app).put('/api/rest/cart/selection').set(bearer(token))
      .send({ keys: [tote.key], selected: false }).expect(200)).body.data;
    expect(one.selected_count).toBe(1);
    expect(one.item_count).toBe(2);
    const subtotal = one.totals.find((t: any) => t.code === 'sub_total').value;
    expect(subtotal).toBeCloseTo(jacket.total, 2);

    // Nothing ticked: checkout says so.
    await request(app).put('/api/rest/cart/selection').set(bearer(token)).send({ keys: 'all', selected: false }).expect(200);
    await request(app).post('/api/rest/shippingaddress').set(bearer(token)).send(ADDRESS).expect(201);
    await request(app).post('/api/rest/shippingmethods').set(bearer(token)).send({ shipping_method: 'standard' }).expect(200);
    await request(app).post('/api/rest/paymentmethods').set(bearer(token)).send({ payment_method: 'cod', agree: true }).expect(200);
    const none = await request(app).post('/api/rest/confirm').set(bearer(token));
    expect(none.status).toBe(400);
    expect(none.body.error[0]).toBe('Tick at least one item to check out.');

    // Tick the jacket and order it: the tote waits in the cart.
    await request(app).put('/api/rest/cart/selection').set(bearer(token)).send({ keys: [jacket.key], selected: true }).expect(200);
    await request(app).post('/api/rest/confirm').set(bearer(token)).expect(200);
    const placed = (await request(app).put('/api/rest/confirm').set(bearer(token)).expect(200)).body.data;
    const ordered = (await query('SELECT name FROM order_items WHERE order_id = $1', [placed.order_id])).rows;
    expect(ordered.map((r) => r.name)).toEqual(['Denim jacket']);
    const left = (await request(app).get('/api/rest/cart').set(bearer(token))).body.data;
    expect(left.products.map((p: any) => p.name)).toEqual(['Canvas tote bag']);
    expect(left.products[0].selected).toBe(false);

    // Adding it again ticks it again.
    const again = (await add(String(await productId('Canvas tote bag')))).body.data;
    expect(again.products[0].selected).toBe(true);
  });
});
