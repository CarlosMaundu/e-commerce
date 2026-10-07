import request from 'supertest';
import { query } from '../src/db';
import { app, bearer, closePool, createUser, resetDatabase, sentEmails, signIn } from './helpers';
import { tokenFrom } from './mailerMock';

jest.mock('../src/lib/mailer', () => require('./mailerMock').mailerMock());

beforeEach(resetDatabase);
afterAll(closePool);

describe('storefront catalog', () => {
  test('lists, searches, filters by category tree and paginates', async () => {
    const all = await request(app).get('/api/rest/products');
    expect(all.body.success).toBe(1);
    expect(all.body.data.length).toBe(33);
    expect(all.headers['x-total-count']).toBe('33');

    const dresses = await request(app).get('/api/rest/products').query({ search: 'dress' });
    expect(dresses.body.data.map((p: { name: string }) => p.name).sort()).toEqual(['Linen summer dress', 'Wrap midi dress']);

    const page2 = await request(app).get('/api/rest/products').query({ limit: 5, page: 2 });
    expect(page2.body.data.length).toBe(5);
    expect(page2.headers['x-total-count']).toBe('33');

    const cats = await request(app).get('/api/rest/categories');
    const men = cats.body.data.find((c: { name: string }) => c.name === 'Men');
    const menProducts = await request(app).get('/api/rest/products').query({ category: men.category_id });
    const names = new Set(menProducts.body.data.map((p: { category: { name: string }[] }) => p.category[0].name));
    expect([...names].sort()).toEqual(['Jackets & coats', 'Shirts & tees']);
  });

  test('filters: brand, sale, stock, rating, tag, attributes; sorting', async () => {
    const get = (query: Record<string, unknown>) => request(app).get('/api/rest/products').query(query);
    const facets = (await request(app).get('/api/rest/product_filters')).body.data;
    const ikea = facets.brands.find((b: any) => b.name === 'IKEA');
    expect(ikea).toMatchObject({ count: 3, logo: expect.stringMatching(/^\/uploads\/demo-brand-/) });
    // Only browsing attributes are filters; product-page choices aren't.
    expect(facets.attributes.map((a: any) => a.name).sort()).toEqual(['Color', 'Material', 'Size']);
    expect(facets.price).toEqual({ min: 15, max: 799 });
    expect(facets.attributes.find((a: any) => a.name === 'Size').values.map((v: any) => v.value)).toEqual(
      expect.arrayContaining(['S', 'M', '30 ml', '42'])
    );

    const byBrand = await get({ brand: String(ikea.brand_id) });
    expect(byBrand.body.data.map((p: any) => p.brand.name)).toEqual(['IKEA', 'IKEA', 'IKEA']);
    const cats = (await request(app).get('/api/rest/categories')).body.data;
    const shoes = cats.find((c: any) => c.name === 'Shoes').category_id;
    const beauty = cats.find((c: any) => c.name === 'Beauty').category_id;
    const two = await get({ category: `${shoes},${beauty}` });
    expect(new Set(two.body.data.map((p: any) => p.category[0].name))).toEqual(new Set(['Shoes', 'Beauty']));
    const sale = await get({ on_sale: 1 });
    expect(sale.body.data.every((p: any) => p.special !== null)).toBe(true);
    const inStock = await get({ in_stock: 1 });
    expect(inStock.body.data.map((p: any) => p.name)).not.toContain('Ceramic table lamp');
    const tagged = await get({ tag: 'New-Season' });
    expect(tagged.body.data.length).toBeGreaterThan(2);
    expect(tagged.body.data.every((p: any) => p.tags.includes('new-season'))).toBe(true);
    const rose = await get({ 'attr[color]': 'Rose' });
    expect(rose.body.data.map((p: any) => p.name)).toEqual(['Over-ear headphones']);
    const rated = await get({ rating: 4.5 });
    expect(rated.body.data.every((p: any) => p.rating >= 4.5)).toBe(true);

    const cheap = await get({ sort: 'price_asc', limit: 3 });
    expect(cheap.body.data.map((p: any) => p.special ?? p.price)).toEqual([15, 18, 19]);
    const bad = await get({ sort: 'random' });
    expect(bad.body.error).toEqual(['Please choose a valid sort order.']);
  });

  test('product views feed the weekly popular list', async () => {
    const lamp = (await request(app).get('/api/rest/products').query({ search: 'lamp' })).body.data[0];
    for (let i = 0; i < 400; i += 1) {
      await query(
        `INSERT INTO product_views (product_id, day, views) VALUES ($1, current_date, 1)
         ON CONFLICT (product_id, day) DO UPDATE SET views = product_views.views + 1`, [lamp.product_id]);
    }
    await request(app).get(`/api/rest/products/${lamp.product_id}`).expect(200);
    const views = (await query('SELECT views FROM product_views WHERE product_id = $1 AND day = current_date', [lamp.product_id])).rows[0].views;
    expect(views).toBeGreaterThan(400);
    const popular = await request(app).get('/api/rest/products').query({ sort: 'popular', limit: 1 });
    expect(popular.body.data[0].name).toBe('Ceramic table lamp');
  });

  test('variants carry their own price, stock and images', async () => {
    const list = await request(app).get('/api/rest/products').query({ search: 'Hydrating' });
    const serum = list.body.data[0];
    expect(serum.attributes).toEqual([{ name: 'Size', values: ['30 ml', '50 ml'] }]);
    expect(serum.variants.map((v: any) => [v.options.Size, v.price, v.own_price])).toEqual([['30 ml', 32, false], ['50 ml', 48, true]]);
    const tee = (await request(app).get('/api/rest/products').query({ search: 'crew-neck' })).body.data[0];
    const black = tee.variants.find((v: any) => v.options.Color === 'Black');
    expect(black.images[0]).toMatch(/demo-tee-black\.jpg$/);
    expect(tee.quantity).toBe(tee.variants.reduce((s: number, v: any) => s + v.quantity, 0));
  });

  test('phones: each model, colour and storage has its own price and photos', async () => {
    const phone = (await request(app).get('/api/rest/products').query({ search: 'iPhone 14' })).body.data[0];
    const pick = (o: Record<string, string>) =>
      phone.variants.find((v: any) => Object.entries(o).every(([k, val]) => v.options[k] === val));
    expect(pick({ Model: 'iPhone 14', Color: 'Blue', Storage: '128GB' }).price).toBe(799);
    expect(pick({ Model: 'iPhone 14 Pro', Color: 'Gold', Storage: '256GB' }).price).toBe(1099);
    const goldMax = pick({ Model: 'iPhone 14 Pro Max', Color: 'Gold', Storage: '512GB' });
    expect(goldMax.price).toBe(1399);
    expect(goldMax.images).toEqual(['/uploads/demo-iphone14promax-gold-1.jpg']);
    // The base model doesn't come in Gold, and the Pro models aren't Blue.
    expect(pick({ Model: 'iPhone 14', Color: 'Gold' })).toBeUndefined();
    expect(pick({ Model: 'iPhone 14 Pro', Color: 'Blue' })).toBeUndefined();
    expect(new Set(phone.variants.map((v: any) => v.sku)).size).toBe(phone.variants.length);
  });

  test('a subcategory shows only its own products', async () => {
    const cats = (await request(app).get('/api/rest/categories')).body.data;
    const electronics = cats.find((c: any) => c.name === 'Electronics');
    const phones = electronics.categories.find((c: any) => c.name === 'Phones');
    const res = await request(app).get('/api/rest/products').query({ category: phones.category_id });
    expect(res.body.data.map((p: any) => p.name).sort()).toEqual(['Apple iPhone 14', 'Samsung Galaxy S23']);
  });

  test('reviews: summary, sign-in to write, one each, rating kept up to date', async () => {
    const product = (await request(app).get('/api/rest/products').query({ search: 'Canvas tote' })).body.data[0];
    const before = await request(app).get(`/api/rest/products/${product.product_id}/reviews`);
    expect(before.body.data.summary.count).toBe(product.reviews);
    expect(before.body.data.reviews.length).toBe(product.reviews);

    const guest = await request(app).post(`/api/rest/products/${product.product_id}/review`).send({ rating: 5, text: 'Lovely bag indeed.' });
    expect(guest.status).toBe(401);

    await createUser('rev@example.com');
    const { token } = await signIn('rev@example.com');
    const short = await request(app).post(`/api/rest/products/${product.product_id}/review`).set(bearer(token)).send({ rating: 5, text: 'Nice' });
    expect(short.body.error).toEqual(['Please write at least a sentence (10 characters or more).']);
    const noStars = await request(app).post(`/api/rest/products/${product.product_id}/review`).set(bearer(token)).send({ text: 'Really sturdy and roomy.' });
    expect(noStars.body.error).toEqual(['Please choose a star rating.']);
    const okRes = await request(app).post(`/api/rest/products/${product.product_id}/review`).set(bearer(token))
      .send({ rating: 1, title: 'Strap broke', text: 'The strap came loose after a week.' });
    expect(okRes.status).toBe(201);
    expect(okRes.body.data.verified).toBe(false); // never bought it
    const again = await request(app).post(`/api/rest/products/${product.product_id}/review`).set(bearer(token))
      .send({ rating: 5, text: 'Changed my mind, love it.' });
    expect(again.status).toBe(409);

    const after = await request(app).get(`/api/rest/products/${product.product_id}`);
    expect(after.body.data.reviews).toBe(product.reviews + 1);
    expect(after.body.data.rating).toBeLessThan(product.rating);
    const latest = (await request(app).get(`/api/rest/products/${product.product_id}/reviews`)).body.data.reviews[0];
    expect(latest).toMatchObject({ author: 'Test U.', rating: 1, title: 'Strap broke' });
  });

  test('brands and promotions for the storefront', async () => {
    const brands = await request(app).get('/api/rest/manufacturers');
    expect(brands.body.data.length).toBeGreaterThan(20);
    expect(brands.body.data.find((b: any) => b.name === 'Nike')).toMatchObject({ product_count: 1, image: expect.stringMatching(/nike\.svg$/) });
    const promos = await request(app).get('/api/rest/promotions');
    expect(promos.body.data.map((p: any) => p.code)).toEqual(['FRIDAY35', null, 'WELCOME10']);
    expect(promos.body.data[0]).toMatchObject({ daily: true, link: "/products?on_sale=1", image: expect.stringMatching(/^\/uploads\/demo-/) });
    expect(new Date(promos.body.data[0].ends_at).getTime()).toBeGreaterThan(Date.now());
    await query("UPDATE promotions SET ends_at = now() - interval '1 minute' WHERE code = 'WELCOME10'");
    expect((await request(app).get('/api/rest/promotions')).body.data).toHaveLength(2);
  });

  test('price filters use the sale price', async () => {
    const res = await request(app).get('/api/rest/products').query({ price_max: 60, search: 'jacket' });
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual(['Denim jacket']);
  });

  test('product details and friendly 404', async () => {
    const list = await request(app).get('/api/rest/products').query({ search: 'Denim' });
    const id = list.body.data[0].product_id;
    const one = await request(app).get(`/api/rest/products/${id}`);
    expect(one.body.data).toMatchObject({ name: 'Denim jacket', price: 79, special: 59 });
    const missing = await request(app).get('/api/rest/products/99999');
    expect(missing.status).toBe(404);
    expect(missing.body.error).toEqual(['Product not found.']);
  });

  test('newsletter validates, de-duplicates and accepts guests', async () => {
    const bad = await request(app).put('/api/rest/newsletter/subscribe').send({ email: 'nope' });
    expect(bad.body.error).toEqual(['Please enter a valid email address.']);
    const okRes = await request(app).put('/api/rest/newsletter/subscribe').send({ email: 'Fan@Example.com' });
    expect(okRes.body.data).toEqual({ email: 'fan@example.com', subscribed: true });
    const again = await request(app).put('/api/rest/newsletter/subscribe').send({ email: 'fan@example.com' });
    expect(again.status).toBe(200);
  });
});

describe('admin catalog permissions', () => {
  test('customers get 403; catalog managers can manage products but not users', async () => {
    await createUser('cus@example.com', 'customer');
    await createUser('cat@example.com', 'catalog_manager');
    const customer = await signIn('cus@example.com');
    const manager = await signIn('cat@example.com');

    const denied = await request(app).post('/api/admin/products').set(bearer(customer.token)).send({ name: 'X', price: 1 });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toEqual(['You don’t have permission to do that.']);

    const created = await request(app).post('/api/admin/products').set(bearer(manager.token)).send({
      name: 'Rain jacket', price: 100, special: 80, quantity: 3, images: ['https://example.com/r.png'],
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ name: 'Rain jacket', price: 100, special: 80, quantity: 3, status: 'published' });

    // Formatted description (unsafe parts removed) and product information.
    const detailed = await request(app).post('/api/admin/products').set(bearer(manager.token)).send({
      name: 'Desk lamp', price: 40,
      description: '<p style="text-align:center"><strong>Warm</strong> light<script>alert(1)</script></p><a href="javascript:x()">x</a><ul><li>LED</li></ul>',
      manufacturer: 'Lumo Works', barcode_type: 'EAN', barcode: '4006381333931', mfr_part_number: 'LW-200',
      length: 30, width: '12.5', height: 45, dimension_unit: 'cm', weight: 1.2, weight_unit: 'kg',
      specs: [{ label: 'Bulb', value: 'E27 LED, 9 W' }],
    });
    expect(detailed.status).toBe(201);
    expect(detailed.body.data.description).toBe('<p style="text-align:center"><strong>Warm</strong> light</p><a target="_blank" rel="noopener noreferrer">x</a><ul><li>LED</li></ul>');
    expect(detailed.body.data).toMatchObject({
      manufacturer: 'Lumo Works',
      barcode: { type: 'EAN', value: '4006381333931' },
      mfr_part_number: 'LW-200',
      dimensions: { length: 30, width: 12.5, height: 45, unit: 'cm' },
      weight: { value: 1.2, unit: 'kg' },
      specs: [{ label: 'Bulb', value: 'E27 LED, 9 W' }],
    });
    // Variant-specific content: each variant can carry its own description
    // and spec rows, but only while the product switches it on.
    const phone = await request(app).post('/api/admin/products').set(bearer(manager.token)).send({
      name: 'Pocket phone', price: 500, description: '<p>All models</p>', variant_content: true,
      attributes: [{ name: 'Model', values: ['Base', 'Pro'] }],
      variants: [
        { options: { Model: 'Base' }, quantity: 1 },
        { options: { Model: 'Pro' }, quantity: 1, price: 700, description: '<p><b>Pro</b> camera</p>', specs: [{ label: 'Camera', value: '48 MP' }] },
      ],
    });
    expect(phone.status).toBe(201);
    const pro = phone.body.data.variants.find((v: any) => v.options.Model === 'Pro');
    const base = phone.body.data.variants.find((v: any) => v.options.Model === 'Base');
    expect(pro).toMatchObject({ description: '<p><b>Pro</b> camera</p>', specs: [{ label: 'Camera', value: '48 MP' }] });
    expect(base).toMatchObject({ description: null, specs: [] });
    const off = await request(app).put(`/api/admin/products/${phone.body.data.product_id}`).set(bearer(manager.token)).send({ variant_content: false });
    expect(off.body.data.variants.find((v: any) => v.options.Model === 'Pro')).toMatchObject({ description: null, specs: [] });

    // A partial edit keeps the product information.
    const renamed = await request(app).put(`/api/admin/products/${detailed.body.data.product_id}`).set(bearer(manager.token)).send({ name: 'Desk lamp 2' });
    expect(renamed.body.data).toMatchObject({ name: 'Desk lamp 2', manufacturer: 'Lumo Works', weight: { value: 1.2, unit: 'kg' } });

    const users = await request(app).get('/api/admin/users').set(bearer(manager.token));
    expect(users.status).toBe(403);
  });

  test('validates products: sale price, images and every field problem at once', async () => {
    await createUser('cat@example.com', 'catalog_manager');
    const { token } = await signIn('cat@example.com');
    const bad = await request(app).post('/api/admin/products').set(bearer(token)).send({ name: '', price: 0 });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toEqual(['Please enter a product name.', 'Please enter a price greater than zero.']);

    const special = await request(app).post('/api/admin/products').set(bearer(token)).send({ name: 'X', price: 10, special: 12 });
    expect(special.body.error).toEqual(['The sale price must be lower than the regular price.']);

    const image = await request(app).post('/api/admin/products').set(bearer(token)).send({ name: 'X', price: 10, images: ['javascript:alert(1)'] });
    expect(image.status).toBe(400);
  });

  test('variants: validated, stock summed, ids kept across edits', async () => {
    await createUser('cat@example.com', 'catalog_manager');
    const { token } = await signIn('cat@example.com');
    const base = {
      name: 'Trail jacket', price: 120, sku: 'TRL-1', tags: ['outdoor', 'Outdoor', 'rain'],
      attributes: [{ name: 'Color', values: ['Red', 'Blue'] }, { name: 'Size', values: ['M', 'L'] }],
    };
    const missing = await request(app).post('/api/admin/products').set(bearer(token))
      .send({ ...base, variants: [{ options: { Color: 'Red' }, quantity: 1 }] });
    expect(missing.body.error).toEqual(['Every variant needs a size from the list.']);
    const twice = await request(app).post('/api/admin/products').set(bearer(token)).send({
      ...base, variants: [{ options: { Color: 'Red', Size: 'M' } }, { options: { color: 'Red', size: 'M' } }],
    });
    expect(twice.body.error).toEqual(['Red / M is listed twice.']);
    const cheap = await request(app).post('/api/admin/products').set(bearer(token)).send({
      ...base, variants: [{ options: { Color: 'Red', Size: 'M' }, price: 50, special: 60 }],
    });
    expect(cheap.body.error).toEqual(['The sale price for Red / M must be lower than the regular price.']);

    const created = await request(app).post('/api/admin/products').set(bearer(token)).send({
      ...base,
      variants: [
        { options: { Color: 'Red', Size: 'M' }, quantity: 4, sku: 'TRL-1-RM', images: ['https://example.com/red.png'] },
        { options: { Color: 'Blue', Size: 'L' }, quantity: 6, price: 130 },
      ],
    });
    expect(created.status).toBe(201);
    const p = created.body.data;
    expect(p).toMatchObject({ quantity: 10, tags: ['outdoor', 'rain'], sku: 'TRL-1' });
    expect(p.variants.map((v: any) => [v.options, v.price, v.quantity])).toEqual([
      [{ Color: 'Red', Size: 'M' }, 120, 4],
      [{ Color: 'Blue', Size: 'L' }, 130, 6],
    ]);

    // Editing keeps the id of a combination that stays.
    const edited = await request(app).put(`/api/admin/products/${p.product_id}`).set(bearer(token)).send({
      variants: [{ options: { Color: 'Red', Size: 'M' }, quantity: 9 }],
    });
    expect(edited.body.data.variants).toHaveLength(1);
    expect(edited.body.data.variants[0]).toMatchObject({ variant_id: p.variants[0].variant_id, quantity: 9 });
    expect(edited.body.data.quantity).toBe(9);

    const dupSku = await request(app).post('/api/admin/products').set(bearer(token)).send({ name: 'Copy', price: 5, sku: 'trl-1' });
    expect(dupSku.status).toBe(409);
    expect(dupSku.body.error).toEqual(['Another product already uses that SKU.']);
  });

  test('drafts stay off the storefront; the admin list counts and filters', async () => {
    await createUser('cat@example.com', 'catalog_manager');
    const { token } = await signIn('cat@example.com');
    const draft = await request(app).post('/api/admin/products').set(bearer(token)).send({ name: 'Secret launch', price: 10, status: 'draft' });
    expect((await request(app).get(`/api/rest/products/${draft.body.data.product_id}`)).status).toBe(404);
    expect((await request(app).get('/api/rest/products').query({ search: 'Secret' })).body.data).toEqual([]);

    const list = await request(app).get('/api/admin/products').set(bearer(token)).query({ status: 'draft' });
    expect(list.body.data.products.map((p: any) => p.name)).toEqual(['Secret launch']);
    expect(list.body.data.counts).toMatchObject({ all: 34, published: 33, draft: 1, out: 2 });
    const out = await request(app).get('/api/admin/products').set(bearer(token)).query({ stock: 'out' });
    expect(out.body.data.products.map((p: any) => p.name)).toContain('Ceramic table lamp');
    const tags = await request(app).get('/api/admin/product_tags').set(bearer(token));
    expect(tags.body.data[0]).toMatchObject({ tag: expect.any(String), count: expect.any(Number) });

    await createUser('cus@example.com');
    const customer = await signIn('cus@example.com');
    expect((await request(app).get('/api/admin/products').set(bearer(customer.token))).status).toBe(403);
  });

  test('brands: managed with category permissions, unique names, logos as images', async () => {
    await createUser('cat@example.com', 'catalog_manager');
    await createUser('ops@example.com', 'order_manager');
    const { token } = await signIn('cat@example.com');
    const ops = await signIn('ops@example.com');
    expect((await request(app).post('/api/admin/brands').set(bearer(ops.token)).send({ name: 'Nope' })).status).toBe(403);

    const created = await request(app).post('/api/admin/brands').set(bearer(token)).send({ name: 'Oak & Iron', logo: '/uploads/oak.png' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ name: 'Oak & Iron', logo: '/uploads/oak.png', product_count: 0 });
    const dup = await request(app).post('/api/admin/brands').set(bearer(token)).send({ name: 'oak & iron' });
    expect(dup.body.error).toEqual(['A brand with that name already exists.']);
    const badLogo = await request(app).post('/api/admin/brands').set(bearer(token)).send({ name: 'X', logo: 'javascript:alert(1)' });
    expect(badLogo.status).toBe(400);

    const product = await request(app).post('/api/admin/products').set(bearer(token))
      .send({ name: 'Oak stool', price: 80, brand_id: created.body.data.brand_id });
    expect(product.body.data.brand).toMatchObject({ name: 'Oak & Iron' });
    await request(app).delete(`/api/admin/brands/${created.body.data.brand_id}`).set(bearer(token)).expect(200);
    const after = await request(app).get(`/api/admin/products/${product.body.data.product_id}`).set(bearer(token));
    expect(after.body.data.brand).toBeNull();
  });

  test('categories with products cannot be deleted', async () => {
    await createUser('cat@example.com', 'catalog_manager');
    const { token } = await signIn('cat@example.com');
    const cats = await request(app).get('/api/rest/categories');
    const res = await request(app).delete(`/api/admin/categories/${cats.body.data[0].category_id}`).set(bearer(token));
    expect(res.status).toBe(409);
  });

  test('uploads accept images only', async () => {
    await createUser('cat@example.com', 'catalog_manager');
    const { token } = await signIn('cat@example.com');
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const okUpload = await request(app).post('/api/admin/files').set(bearer(token)).attach('file', png, { filename: 'a.png', contentType: 'image/png' });
    expect(okUpload.status).toBe(201);
    expect(okUpload.body.data.url).toMatch(/^\/uploads\/.+\.png$/);
    const served = await request(app).get(okUpload.body.data.url);
    expect(served.status).toBe(200);

    const exe = await request(app).post('/api/admin/files').set(bearer(token)).attach('file', Buffer.from('MZ'), { filename: 'a.exe', contentType: 'application/octet-stream' });
    expect(exe.status).toBe(400);
    expect(exe.body.error).toEqual(['Please upload a JPG, PNG, WebP or GIF image.']);
  });
});

describe('admin users', () => {
  test('admin creates a user who sets their password from the emailed link', async () => {
    await createUser('boss@example.com', 'admin');
    const { token } = await signIn('boss@example.com');
    const res = await request(app).post('/api/admin/users').set(bearer(token)).send({
      firstname: 'New', lastname: 'Hire', email: 'hire@example.com', role: 'support',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email: 'hire@example.com', role: 'support', has_password: false });
    expect(sentEmails[0]).toMatchObject({ to: 'hire@example.com', kind: 'setup' });

    const setup = await request(app).post('/api/rest/reset-password').send({ token: tokenFrom(sentEmails[0].link), password: 'F1rst!Login' });
    expect(setup.status).toBe(200);
    const login = await signIn('hire@example.com', 'F1rst!Login');
    expect(login.user.permissions).toEqual(expect.arrayContaining(['admin.users.view', 'orders.orders.view', 'admin.users.unlock']));
    expect(login.user.permissions).not.toContain('admin.users.update');
  });

  test('role rules: no self-change, only super admins grant super admin', async () => {
    await createUser('boss@example.com', 'admin');
    const targetId = await createUser('target@example.com', 'customer');
    const { token, user } = await signIn('boss@example.com');

    const self = await request(app).put(`/api/admin/users/${user.customer_id}`).set(bearer(token)).send({ role: 'customer' });
    expect(self.body.error).toEqual(['You can’t change your own role.']);

    const grant = await request(app).put(`/api/admin/users/${targetId}`).set(bearer(token)).send({ role: 'super_admin' });
    expect(grant.status).toBe(403);

    const promote = await request(app).put(`/api/admin/users/${targetId}`).set(bearer(token)).send({ role: 'catalog_manager' });
    expect(promote.body.data.role).toBe('catalog_manager');
  });

  test('super admins are protected from admins and from themselves', async () => {
    await createUser('root@example.com', 'super_admin');
    const otherRoot = await createUser('root2@example.com', 'super_admin');
    const root = await signIn('root@example.com');

    const demote = await request(app).put(`/api/admin/users/${otherRoot}`).set(bearer(root.token)).send({ role: 'admin' });
    expect(demote.body.data.role).toBe('admin');

    const nowAdmin = await signIn('root2@example.com');
    const touchRoot = await request(app)
      .put(`/api/admin/users/${root.user.customer_id}`)
      .set(bearer(nowAdmin.token))
      .send({ status: 'suspended' });
    expect(touchRoot.body.error).toEqual(['Only a super admin can change another super admin.']);

    const selfSuspend = await request(app)
      .put(`/api/admin/users/${root.user.customer_id}`)
      .set(bearer(root.token))
      .send({ status: 'suspended' });
    expect(selfSuspend.body.error).toEqual(['You can’t suspend your own account.']);
  });

  test('admin reset sends a setup link to users without a password', async () => {
    await createUser('boss@example.com', 'admin');
    const noPass = await createUser('nopass@example.com', 'customer', null);
    const { token } = await signIn('boss@example.com');
    const res = await request(app).post(`/api/admin/users/${noPass}/reset-password`).set(bearer(token));
    expect(res.body.data).toEqual({ sent: true, purpose: 'setup' });
    expect(sentEmails[0]).toMatchObject({ to: 'nopass@example.com', kind: 'setup' });
  });

  test('roles list includes user counts', async () => {
    await createUser('boss@example.com', 'admin');
    const { token } = await signIn('boss@example.com');
    const res = await request(app).get('/api/admin/roles').set(bearer(token));
    expect(res.body.data.map((r: { code: string }) => r.code)).toEqual([
      'super_admin', 'admin', 'catalog_manager', 'order_manager', 'support', 'customer',
    ]);
  });
});
