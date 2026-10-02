import request from 'supertest';
import { app, bearer, closePool, createUser, resetDatabase, sentEmails, signIn } from './helpers';
import { tokenFrom } from './mailerMock';

jest.mock('../src/lib/mailer', () => require('./mailerMock').mailerMock());

beforeEach(resetDatabase);
afterAll(closePool);

describe('storefront catalog', () => {
  test('lists, searches, filters by category tree and paginates', async () => {
    const all = await request(app).get('/api/rest/products');
    expect(all.body.success).toBe(1);
    expect(all.body.data.length).toBe(12);
    expect(all.headers['x-total-count']).toBe('12');

    const dresses = await request(app).get('/api/rest/products').query({ search: 'dress' });
    expect(dresses.body.data.map((p: { name: string }) => p.name).sort()).toEqual(['Linen summer dress', 'Wrap midi dress']);

    const page2 = await request(app).get('/api/rest/products').query({ limit: 5, page: 2 });
    expect(page2.body.data.length).toBe(5);
    expect(page2.headers['x-total-count']).toBe('12');

    const cats = await request(app).get('/api/rest/categories');
    const men = cats.body.data.find((c: { name: string }) => c.name === 'Men');
    const menProducts = await request(app).get('/api/rest/products').query({ category: men.category_id });
    expect(menProducts.body.data.every((p: { category: { name: string }[] }) => p.category[0].name === 'Men')).toBe(true);
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
      options: { sizes: ['M'], colors: ['Navy'] },
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ name: 'Rain jacket', price: 100, special: 80, quantity: 3 });

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
    expect(login.user.permissions).toEqual(['admin.users.view', 'orders.orders.view']);
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
