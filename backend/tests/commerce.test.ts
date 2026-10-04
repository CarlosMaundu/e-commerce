import request from 'supertest';
import { query } from '../src/db';
import { app, bearer, closePool, createUser, fakePayments, resetDatabase, sentEmails, signIn } from './helpers';

jest.mock('../src/lib/mailer', () => require('./mailerMock').mailerMock());

// Known stock: every variant 25, Wool overshirt Camel / M only 9.
beforeEach(async () => {
  await resetDatabase();
  await query('UPDATE product_variants SET quantity = 25');
  await query(`UPDATE product_variants SET quantity = 9 FROM products p
    WHERE p.id = product_id AND p.name = 'Wool overshirt' AND options = '{"Color":"Camel","Size":"M"}'`);
  await query(`UPDATE products p SET quantity = s.total FROM
    (SELECT product_id, sum(quantity)::int AS total FROM product_variants GROUP BY product_id) s WHERE s.product_id = p.id`);
});
afterAll(closePool);

const productId = async (name: string) =>
  (await query('SELECT id FROM products WHERE name = $1', [name])).rows[0].id as number;

const variantStock = async (name: string, options: Record<string, string>) =>
  (await query(
    'SELECT v.quantity FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.name = $1 AND v.options = $2',
    [name, JSON.stringify(options)]
  )).rows[0].quantity as number;

const M = { Size: 'M' };
const CAMEL_M = { Color: 'Camel', Size: 'M' };

const ADDRESS = {
  firstname: 'Jane', lastname: 'Doe', address_1: '1 Market St', city: 'Nairobi',
  postcode: '00100', country: 'ke', telephone: '+254700000000',
};

const shopper = async (email = 'jane@example.com') => {
  await createUser(email);
  return (await signIn(email)).token;
};

/** Adds items and completes every checkout step up to POST /confirm. */
type Item = [string, number, Record<string, string>?];
const prepareCheckout = async (token: string, { payment = 'cod', items = [['Denim jacket', 2, M]] as Item[] } = {}) => {
  for (const [name, quantity, option = {}] of items) {
    await request(app).post('/api/rest/cart').set(bearer(token)).send({ product_id: await productId(name), quantity, option }).expect(200);
  }
  await request(app).post('/api/rest/shippingaddress').set(bearer(token)).send(ADDRESS).expect(201);
  await request(app).post('/api/rest/shippingmethods').set(bearer(token)).send({ shipping_method: 'standard' }).expect(200);
  await request(app).post('/api/rest/paymentmethods').set(bearer(token)).send({ payment_method: payment, agree: true }).expect(200);
  return request(app).post('/api/rest/confirm').set(bearer(token));
};

const placeOrder = async (token: string, options?: Parameters<typeof prepareCheckout>[1]) => {
  await (await prepareCheckout(token, options)).body;
  const placed = await request(app).put('/api/rest/confirm').set(bearer(token));
  expect(placed.status).toBe(200);
  return placed.body.data;
};

describe('financial settings', () => {
  test('VAT included in prices, new delivery prices and currency take effect at once', async () => {
    const pub = await request(app).get('/api/rest/store');
    expect(pub.body.data.finance).toMatchObject({ currency: 'USD', tax_rate: 8, prices_include_tax: false });

    const token = await shopper();
    const manager = await (async () => { await createUser('cat@example.com', 'catalog_manager'); return (await signIn('cat@example.com')).token; })();
    expect((await request(app).put('/api/admin/finance-settings').set(bearer(manager)).send({ tax_rate: 1 })).status).toBe(403);

    await createUser('boss@example.com', 'admin');
    const admin = (await signIn('boss@example.com')).token;
    const bad = await request(app).put('/api/admin/finance-settings').set(bearer(admin)).send({ currency: 'shillings', tax_rate: 120 });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.field_errors)).toEqual(expect.arrayContaining(['currency', 'tax_rate']));

    const saved = await request(app).put('/api/admin/finance-settings').set(bearer(admin))
      .send({ currency: 'kes', tax_label: 'VAT', tax_rate: 16, prices_include_tax: true });
    expect(saved.body.data.settings).toMatchObject({ currency: 'KES', tax_rate: 16, prices_include_tax: true });

    // Delivery options: new prices, no free threshold, and a pick-up point.
    const noPickupPlace = await request(app).put('/api/admin/delivery-settings').set(bearer(admin))
      .send({ pickup: { enabled: true, location: '' } });
    expect(noPickupPlace.body.field_errors).toMatchObject({ 'pickup.location': expect.any(String) });
    await request(app).put('/api/admin/delivery-settings').set(bearer(admin))
      .send({ standard: { price: 300, free_over: 0 }, pickup: { enabled: true, location: 'Moi Avenue shop, Nairobi', price: 0 } })
      .expect(200);

    await request(app).post('/api/rest/cart').set(bearer(token)).send({ product_id: await productId('Denim jacket'), quantity: 2, option: M });
    await request(app).post('/api/rest/shippingaddress').set(bearer(token)).send(ADDRESS).expect(201);
    const methods = await request(app).get('/api/rest/shippingmethods').set(bearer(token));
    expect(methods.body.data.shipping_methods.find((m: any) => m.code === 'standard')).toMatchObject({ cost: 300, description: '3–5 business days.' });
    expect(methods.body.data.shipping_methods.find((m: any) => m.code === 'pickup')).toMatchObject({
      cost: 0, title: 'Pick up in store', pickup: { location: 'Moi Avenue shop, Nairobi' },
    });
    await request(app).post('/api/rest/shippingmethods').set(bearer(token)).send({ shipping_method: 'standard' }).expect(200);
    const cart = await request(app).get('/api/rest/cart').set(bearer(token));
    const lines = Object.fromEntries(cart.body.data.totals.map((t: any) => [t.code, t]));
    // 118 including 16% VAT: the VAT inside is 16.28 and the total doesn't grow.
    expect(lines.tax).toMatchObject({ title: 'Includes VAT (16%)', value: 16.28 });
    expect(lines.total.value).toBe(418);
    expect((await request(app).get('/api/rest/store')).body.data.finance.currency).toBe('KES');
  });
});

describe('cart', () => {
  test('server prices the cart and keeps option choices on separate lines', async () => {
    const token = await shopper();
    const jacket = await productId('Denim jacket'); // 79, sale 59
    await request(app).post('/api/rest/cart').set(bearer(token)).send({ product_id: jacket, quantity: 1, option: { size: 'M' } });
    const res = await request(app).post('/api/rest/cart').set(bearer(token)).send({ product_id: jacket, quantity: 2, option: { Size: 'L' } });
    expect(res.body.data.products).toHaveLength(2);
    // Option names match the product's attributes whatever their case.
    expect(res.body.data.products[0]).toMatchObject({ unit_price: 59, price: 79, special: 59, options: { Size: 'M' } });
    expect(res.body.data.products[0].variant_id).toEqual(expect.any(Number));
    expect(res.body.data.item_count).toBe(3);
    const totals = Object.fromEntries(res.body.data.totals.map((t: any) => [t.code, t.value]));
    expect(totals).toEqual({ sub_total: 177, tax: 14.16, total: 191.16 });
  });

  test('refuses more than the stock and out-of-stock items', async () => {
    const token = await shopper();
    const lamp = await productId('Ceramic table lamp'); // quantity 0
    const out = await request(app).post('/api/rest/cart').set(bearer(token)).send({ product_id: lamp });
    expect(out.status).toBe(409);
    expect(out.body.error[0]).toMatch(/out of stock/);
    const wool = await productId('Wool overshirt'); // 9 in stock
    const tooMany = await request(app).post('/api/rest/cart').set(bearer(token)).send({ product_id: wool, quantity: 10, option: CAMEL_M });
    expect(tooMany.body.error[0]).toMatch(/Only 9 of “Wool overshirt \(Camel \/ M\)” left/);
  });

  test('variants: every option must be chosen from the list, and each has its own price', async () => {
    const token = await shopper();
    const wool = await productId('Wool overshirt');
    const none = await request(app).post('/api/rest/cart').set(bearer(token)).send({ product_id: wool });
    expect(none.body.error).toEqual(['Please choose a color.']);
    const wrong = await request(app).post('/api/rest/cart').set(bearer(token)).send({ product_id: wool, option: { Color: 'Pink', Size: 'M' } });
    expect(wrong.body.error[0]).toMatch(/“Pink” isn’t an available color/);
    // 50 ml has its own price (48); 30 ml uses the product's (32).
    const serum = await productId('Hydrating face serum');
    await request(app).post('/api/rest/cart').set(bearer(token)).send({ product_id: serum, option: { Size: '30 ml' } }).expect(200);
    const res = await request(app).post('/api/rest/cart').set(bearer(token)).send({ product_id: serum, option: { Size: '50 ml' } });
    expect(res.body.data.products.map((l: any) => [l.options.Size, l.unit_price])).toEqual([['30 ml', 32], ['50 ml', 48]]);
    // An own-priced variant keeps the sale ratio: merino knit 72, sale 57.
    const knit = await productId('Chunky knit sweater');
    const knitRes = await request(app).post('/api/rest/cart').set(bearer(token))
      .send({ product_id: knit, option: { Color: 'Cream', Material: 'Merino wool', Size: 'M' } });
    expect(knitRes.body.data.products[2]).toMatchObject({ price: 72, special: 57, unit_price: 57 });
  });

  test('update, remove and empty', async () => {
    const token = await shopper();
    const add = await request(app).post('/api/rest/cart').set(bearer(token)).send({ product_id: await productId('Canvas tote bag') });
    const key = add.body.data.products[0].key;
    const upd = await request(app).put('/api/rest/cart').set(bearer(token)).send({ key, quantity: 4 });
    expect(upd.body.data.products[0].quantity).toBe(4);
    const del = await request(app).delete(`/api/rest/cart/${key}`).set(bearer(token));
    expect(del.body.data.products).toHaveLength(0);
  });

  test('cart_bulk merges a guest cart and skips unavailable items', async () => {
    const token = await shopper();
    const res = await request(app).post('/api/rest/cart_bulk').set(bearer(token)).send([
      { product_id: await productId('Canvas tote bag'), quantity: 2 },
      { product_id: await productId('Ceramic table lamp'), quantity: 1 },
      { product_id: await productId('Wool overshirt'), quantity: 50, option: CAMEL_M },
      { product_id: await productId('Wool overshirt'), quantity: 1 }, // no options chosen: skipped
    ]);
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.data.products.map((p: any) => [p.name, p.quantity]));
    expect(byName).toEqual({ 'Canvas tote bag': 2, 'Wool overshirt': 9 });
  });

  test('promo codes: invalid, minimum spend, and applied discount', async () => {
    const token = await shopper();
    await request(app).post('/api/rest/cart').set(bearer(token)).send({ product_id: await productId('Canvas tote bag') }); // 15
    const bad = await request(app).post('/api/rest/coupon').set(bearer(token)).send({ coupon: 'NOPE' });
    expect(bad.body.error).toEqual(['That promo code isn’t valid.']);
    const min = await request(app).post('/api/rest/coupon').set(bearer(token)).send({ coupon: 'friday35' });
    expect(min.body.error[0]).toMatch(/at least \$50\.00/);
    const okRes = await request(app).post('/api/rest/coupon').set(bearer(token)).send({ coupon: 'welcome10' });
    expect(okRes.body.data.coupon).toMatchObject({ code: 'WELCOME10' });
    const totals = Object.fromEntries(okRes.body.data.totals.map((t: any) => [t.code, t.value]));
    expect(totals.coupon).toBe(-1.5);
  });

  test('carts are private and require sign-in', async () => {
    expect((await request(app).get('/api/rest/cart')).status).toBe(401);
  });
});

describe('wishlist and addresses', () => {
  test('wishlist add, list, remove', async () => {
    const token = await shopper();
    const id = await productId('Wireless earbuds');
    await request(app).post(`/api/rest/wishlist/${id}`).set(bearer(token)).expect(200);
    await request(app).post(`/api/rest/wishlist/${id}`).set(bearer(token)).expect(200); // idempotent
    const list = await request(app).get('/api/rest/wishlist').set(bearer(token));
    expect(list.body.data.map((p: any) => p.name)).toEqual(['Wireless earbuds']);
    await request(app).delete(`/api/rest/wishlist/${id}`).set(bearer(token)).expect(200);
    expect((await request(app).get('/api/rest/wishlist').set(bearer(token))).body.data).toEqual([]);
  });

  test('address book: first is default, validation, other users can’t see it', async () => {
    const token = await shopper();
    const first = await request(app).post('/api/rest/account/address').set(bearer(token)).send(ADDRESS);
    expect(first.body.data).toMatchObject({ default: true, country: 'KE' });
    const second = await request(app).post('/api/rest/account/address').set(bearer(token)).send({ ...ADDRESS, city: 'Mombasa', default: true });
    const list = await request(app).get('/api/rest/account/address').set(bearer(token));
    expect(list.body.data.map((a: any) => [a.city, a.default])).toEqual([['Mombasa', true], ['Nairobi', false]]);

    const bad = await request(app).post('/api/rest/account/address').set(bearer(token)).send({ firstname: 'X' });
    expect(bad.status).toBe(400);
    expect(bad.body.field_errors.city).toBe('Please enter a city.');

    const other = await shopper('other@example.com');
    const peek = await request(app).get(`/api/rest/account/address/${second.body.data.address_id}`).set(bearer(other));
    expect(peek.status).toBe(404);
  });
});

describe('checkout', () => {
  test('each step explains what is missing', async () => {
    const token = await shopper();
    expect((await request(app).post('/api/rest/confirm').set(bearer(token))).body.error).toEqual(['Your cart is empty.']);
    await request(app).post('/api/rest/cart').set(bearer(token)).send({ product_id: await productId('Canvas tote bag') });
    expect((await request(app).post('/api/rest/confirm').set(bearer(token))).body.error).toEqual(['Please choose a delivery address.']);
    expect((await request(app).get('/api/rest/shippingmethods').set(bearer(token))).body.error).toEqual(['Please choose a delivery address first.']);
    const terms = await request(app).post('/api/rest/paymentmethods').set(bearer(token)).send({ payment_method: 'cod' });
    expect(terms.body.error).toEqual(['Please accept the terms and conditions to continue.']);
  });

  test('cash on delivery: places the order, takes stock, clears the cart, emails the customer', async () => {
    const token = await shopper();
    const jacket = await productId('Denim jacket');
    const confirm = await prepareCheckout(token);
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.order.totals).toEqual({ subtotal: 118, discount: 0, shipping: 10, tax: 9.44, total: 137.44 });
    expect(confirm.body.data.payment).toEqual({ method: 'cod' });

    const placed = await request(app).put('/api/rest/confirm').set(bearer(token));
    expect(placed.body.data).toMatchObject({ status: 'pending', payment_status: 'pending', total: 137.44 });
    expect(placed.body.data.shipping_address).toMatchObject({ city: 'Nairobi', country: 'KE' });
    expect(await variantStock('Denim jacket', M)).toBe(23);
    // The product's stock is the sum of its variants (4 sizes × 25 − 2).
    expect((await query('SELECT quantity FROM products WHERE id = $1', [jacket])).rows[0].quantity).toBe(98);
    expect((await request(app).get('/api/rest/cart').set(bearer(token))).body.data.products).toEqual([]);
    expect(sentEmails.find((e) => e.kind === 'order')).toMatchObject({ to: 'jane@example.com' });

    const list = await request(app).get('/api/rest/customerorders').set(bearer(token));
    expect(list.headers['x-total-count']).toBe('1');
    expect(list.body.data[0]).toMatchObject({ order_id: placed.body.data.order_id, item_count: 2 });
  });

  test('free standard delivery above the threshold, and coupons on orders', async () => {
    const token = await shopper();
    await request(app).post('/api/rest/cart').set(bearer(token)).send({ product_id: await productId('Wool overshirt'), quantity: 2, option: CAMEL_M }); // 190
    await request(app).post('/api/rest/coupon').set(bearer(token)).send({ coupon: 'FRIDAY35' });
    const confirm = await prepareCheckout(token, { items: [] });
    expect(confirm.body.data.order.totals).toEqual({ subtotal: 190, discount: 66.5, shipping: 10, tax: 9.88, total: 143.38 });
    await request(app).put('/api/rest/confirm').set(bearer(token)).expect(200);
    expect((await query("SELECT uses_count FROM coupons WHERE code = 'FRIDAY35'")).rows[0].uses_count).toBe(1);
  });

  test('card payment: must be confirmed by Stripe before the order is placed', async () => {
    const token = await shopper();
    const confirm = await prepareCheckout(token, { payment: 'stripe' });
    expect(confirm.body.data.payment).toMatchObject({ method: 'stripe', publishable_key: 'pk_test_fake' });
    const intentId = confirm.body.data.payment.client_secret.replace(/_secret$/, '');
    expect(fakePayments.intents.get(intentId)!.amountCents).toBe(13744);

    const early = await request(app).put('/api/rest/confirm').set(bearer(token));
    expect(early.status).toBe(402);
    expect(early.body.error[0]).toMatch(/payment wasn’t completed/);

    fakePayments.intents.get(intentId)!.status = 'succeeded';
    const placed = await request(app).put('/api/rest/confirm').set(bearer(token));
    expect(placed.body.data).toMatchObject({ status: 'processing', payment_status: 'paid' });
  });

  test('stock is re-checked when placing the order', async () => {
    const token = await shopper();
    await prepareCheckout(token, { items: [['Wool overshirt', 9, CAMEL_M]] });
    await query(`UPDATE product_variants SET quantity = 3 WHERE options = '{"Color":"Camel","Size":"M"}'`);
    const placed = await request(app).put('/api/rest/confirm').set(bearer(token));
    expect(placed.status).toBe(409);
    expect(placed.body.error[0]).toMatch(/sold out while you were checking out/);
  });

  test('customers only see their own orders; reorder refills the cart', async () => {
    const token = await shopper();
    const order = await placeOrder(token);
    const other = await shopper('other@example.com');
    expect((await request(app).get(`/api/rest/customerorders/${order.order_id}`).set(bearer(other))).status).toBe(404);
    const reorder = await request(app).post(`/api/rest/customerorders/${order.order_id}/reorder`).set(bearer(token));
    expect(reorder.body.data.cart.item_count).toBe(2);
  });
});

describe('order management and returns', () => {
  const staff = async (role = 'order_manager', email = 'staff@example.com') => {
    await createUser(email, role);
    return (await signIn(email)).token;
  };

  test('status moves follow the allowed path, notify the customer, and cancellation restocks', async () => {
    const token = await shopper();
    const order = await placeOrder(token);
    const admin = await staff();

    const jump = await request(app).put(`/api/admin/orderhistory/${order.order_id}`).set(bearer(admin)).send({ order_status: 'delivered' });
    expect(jump.body.error[0]).toBe('An order that is pending can’t be moved to delivered.');

    const processing = await request(app).put(`/api/admin/orderhistory/${order.order_id}`).set(bearer(admin))
      .send({ order_status: 'processing', notify: true, comment: 'Packing your order now.' });
    expect(processing.body.data).toMatchObject({ status: 'processing', next_statuses: ['shipped', 'cancelled'] });
    expect(sentEmails.find((e) => e.kind === 'status:Processing')).toBeTruthy();

    const internal = await request(app).put(`/api/admin/orderhistory/${order.order_id}`).set(bearer(admin))
      .send({ order_status: 'processing', comment: 'Internal note' });
    expect(internal.status).toBe(200);
    const mine = await request(app).get(`/api/rest/customerorders/${order.order_id}`).set(bearer(token));
    expect(mine.body.data.history.map((h: any) => h.comment)).toEqual(['Order placed.', 'Packing your order now.', '']);

    await request(app).put(`/api/admin/orderhistory/${order.order_id}`).set(bearer(admin)).send({ order_status: 'cancelled' }).expect(200);
    expect(await variantStock('Denim jacket', M)).toBe(25);
  });

  test('cash orders become paid on delivery; card refunds go through Stripe', async () => {
    const token = await shopper();
    const cod = await placeOrder(token);
    const admin = await staff();
    for (const s of ['processing', 'shipped', 'delivered']) {
      await request(app).put(`/api/admin/orderhistory/${cod.order_id}`).set(bearer(admin)).send({ order_status: s }).expect(200);
    }
    expect((await request(app).get(`/api/admin/orders/${cod.order_id}`).set(bearer(admin))).body.data.payment_status).toBe('paid');

    const confirm = await prepareCheckout(token, { payment: 'stripe', items: [['Canvas tote bag', 1]] });
    const intentId = confirm.body.data.payment.client_secret.replace(/_secret$/, '');
    fakePayments.intents.get(intentId)!.status = 'succeeded';
    const card = (await request(app).put('/api/rest/confirm').set(bearer(token))).body.data;
    for (const s of ['shipped', 'delivered', 'refunded']) {
      await request(app).put(`/api/admin/orderhistory/${card.order_id}`).set(bearer(admin)).send({ order_status: s }).expect(200);
    }
    expect(fakePayments.refunds).toEqual([intentId]);
  });

  test('returns: only after delivery, within the ordered quantity, then approved by staff', async () => {
    const token = await shopper();
    const order = await placeOrder(token);
    const item = (await request(app).get(`/api/rest/customerorders/${order.order_id}`).set(bearer(token))).body.data.products[0];
    const early = await request(app).post('/api/rest/returns').set(bearer(token))
      .send({ order_id: order.order_id, order_product_id: item.order_product_id, quantity: 1, reason: 'damaged' });
    expect(early.body.error).toEqual(['You can return items once your order has been delivered.']);

    const admin = await staff('admin');
    for (const s of ['processing', 'shipped', 'delivered']) {
      await request(app).put(`/api/admin/orderhistory/${order.order_id}`).set(bearer(admin)).send({ order_status: s });
    }
    const tooMany = await request(app).post('/api/rest/returns').set(bearer(token))
      .send({ order_id: order.order_id, order_product_id: item.order_product_id, quantity: 3, reason: 'damaged' });
    expect(tooMany.body.error).toEqual(['You ordered 2 of this item.']);
    const ret = await request(app).post('/api/rest/returns').set(bearer(token))
      .send({ order_id: order.order_id, order_product_id: item.order_product_id, quantity: 1, reason: 'damaged', comment: 'Torn seam' });
    expect(ret.body.data).toMatchObject({ status: 'requested', reason_name: 'Arrived damaged', product: 'Denim jacket' });

    const approved = await request(app).put(`/api/admin/returns/${ret.body.data.return_id}`).set(bearer(admin)).send({ status: 'approved' });
    expect(approved.body.data.status).toBe('approved');
  });

  test('customers and catalog managers can’t see orders admin', async () => {
    const token = await shopper();
    expect((await request(app).get('/api/admin/orders').set(bearer(token))).status).toBe(403);
    const catalog = await staff('catalog_manager');
    expect((await request(app).get('/api/admin/dashboard').set(bearer(catalog))).status).toBe(403);
  });

  test('store overview reports the period’s real orders, compared with the one before', async () => {
    const token = await shopper();
    await placeOrder(token);
    const admin = await staff('admin');
    const bad = await request(app).get('/api/admin/dashboard?days=12').set(bearer(admin));
    expect(bad.status).toBe(400);
    const res = await request(app).get('/api/admin/dashboard?days=7').set(bearer(admin));
    const d = res.body.data;
    expect(d.kpis.revenue).toEqual({ value: 137.44, change: 100 });
    expect(d.kpis.orders).toMatchObject({ value: 1, awaiting: 1 });
    expect(d.kpis.new_customers).toMatchObject({ value: 1, first_time_share: 100 });
    expect(d.kpis.average_order.value).toBe(137.44);
    expect(d.series).toHaveLength(7);
    expect(d.series[6]).toMatchObject({ revenue: 137.44, orders: 1, last_year_revenue: 0 });
    expect(d.last_year).toMatchObject({ revenue: 0, revenue_change: 100 });
    const year = await request(app).get('/api/admin/dashboard?days=365').set(bearer(admin));
    expect(year.body.data.series).toHaveLength(12);
    expect(year.body.data.series_unit).toBe('month');
    expect(d.top_products[0]).toMatchObject({ name: 'Denim jacket', units: 2 });
    expect(d.categories.reduce((s: number, c: any) => s + c.share, 0)).toBe(100);
    expect(d.fulfilment).toMatchObject({ packing: 1, in_transit: 0, delayed: 0, total: 1 });
    expect(d.locations).toHaveLength(1);
    expect(d.recent_orders[0]).toMatchObject({ total: 137.44, status: 'pending', first_item: expect.any(String) });

    const bell = await request(app).get('/api/admin/notifications').set(bearer(admin));
    expect(bell.body.data).toMatchObject({ to_fulfil: 1, open_returns: 0 });
    const catalog = await staff('catalog_manager', 'stock@example.com');
    const theirs = await request(app).get('/api/admin/notifications').set(bearer(catalog));
    expect(theirs.body.data).toMatchObject({ to_fulfil: null, open_returns: null, low_stock: expect.any(Number) });
  });
});

describe('custom roles', () => {
  test('super admin creates a role whose users get exactly those permissions', async () => {
    await createUser('root@example.com', 'super_admin');
    const { token } = await signIn('root@example.com');
    const perms = await request(app).get('/api/admin/permissions').set(bearer(token));
    expect(perms.body.data.map((g: any) => g.name)).toEqual(['Administration', 'Catalog', 'Dashboard', 'Orders']);

    const created = await request(app).post('/api/admin/roles').set(bearer(token)).send({
      name: 'Stock Clerk', description: 'Keeps stock up to date', permissions: ['catalog.products.update'],
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ code: 'stock_clerk', is_system: false, permissions: ['catalog.products.update'] });

    const clerkId = await createUser('clerk@example.com');
    await request(app).put(`/api/admin/users/${clerkId}`).set(bearer(token)).send({ role: 'stock_clerk' }).expect(200);
    const clerk = await signIn('clerk@example.com');
    expect(clerk.user.permissions).toEqual(['catalog.products.update']);
    const del = await request(app).delete(`/api/admin/products/${await productId('Canvas tote bag')}`).set(bearer(clerk.token));
    expect(del.status).toBe(403);

    const inUse = await request(app).delete('/api/admin/roles/stock_clerk').set(bearer(token));
    expect(inUse.body.error[0]).toMatch(/1 user has this role/);
  });

  test('guards: system roles, everything-permission, and only grantable permissions', async () => {
    await createUser('root@example.com', 'super_admin');
    await createUser('boss@example.com', 'admin');
    const root = (await signIn('root@example.com')).token;
    const boss = (await signIn('boss@example.com')).token;

    expect((await request(app).put('/api/admin/roles/admin').set(bearer(root)).send({ name: 'X' })).status).toBe(403);
    expect((await request(app).delete('/api/admin/roles/customer').set(bearer(root))).status).toBe(403);
    const star = await request(app).post('/api/admin/roles').set(bearer(root)).send({ name: 'God', permissions: ['*'] });
    expect(star.status).toBe(403);
    // admin lacks admin.roles.manage
    expect((await request(app).post('/api/admin/roles').set(bearer(boss)).send({ name: 'Mine' })).status).toBe(403);

    const dup = await request(app).post('/api/admin/roles/support/duplicate').set(bearer(root)).send({ name: 'Senior support' });
    expect(dup.body.data).toMatchObject({ code: 'senior_support' });
    expect(dup.body.data.permissions).toEqual((await request(app).get('/api/admin/roles/support').set(bearer(root))).body.data.permissions);
    const clash = await request(app).post('/api/admin/roles').set(bearer(root)).send({ name: 'senior SUPPORT' });
    expect(clash.status).toBe(409);
  });
});
