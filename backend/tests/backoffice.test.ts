import request from 'supertest';
import { query } from '../src/db';
import { ajax, app, bearer, closePool, createUser, PASSWORD, resetDatabase, signIn } from './helpers';

jest.mock('../src/lib/mailer', () => require('./mailerMock').mailerMock());

beforeEach(async () => {
  await resetDatabase();
  await query('UPDATE products SET quantity = 50 WHERE name = $1', ['Canvas tote bag']);
});
afterAll(closePool);

const tote = async () => (await query("SELECT id FROM products WHERE name = 'Canvas tote bag'")).rows[0].id as number;

describe('staff and customers', () => {
  test('back-office accounts can’t shop; customers can', async () => {
    await createUser('ops@example.com', 'order_manager');
    await createUser('jane@example.com');
    const staff = await signIn('ops@example.com');
    const customer = await signIn('jane@example.com');
    const productId = await tote();

    const blocked = await request(app).post('/api/rest/cart').set(bearer(staff.token)).send({ product_id: productId });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error[0]).toMatch(/Back-office accounts can’t shop/);
    expect((await request(app).get('/api/rest/customerorders').set(bearer(staff.token))).status).toBe(403);
    expect((await request(app).get('/api/rest/wishlist').set(bearer(staff.token))).status).toBe(403);

    await request(app).post('/api/rest/cart').set(bearer(customer.token)).send({ product_id: productId }).expect(200);
  });
});

describe('acting as a customer', () => {
  const setup = async () => {
    await createUser('boss@example.com', 'admin');
    const customerId = await createUser('jane@example.com');
    const admin = await signIn('boss@example.com');
    return { admin, customerId };
  };

  test('staff act as a customer, shop for them, and return to their own session', async () => {
    const { admin, customerId } = await setup();
    const res = await request(app).post(`/api/admin/users/${customerId}/impersonate`).set(bearer(admin.token));
    expect(res.status).toBe(200);
    const act = res.body.data;
    expect(act.user).toMatchObject({ email: 'jane@example.com', permissions: [], impersonator: { email: 'boss@example.com' } });
    expect(act.expires_in_minutes).toBe(30);
    const actingCookie = res.headers['set-cookie'][0].split(';')[0];

    // Shops as the customer; the order records who placed it.
    await request(app).post('/api/rest/cart').set(bearer(act.access_token)).send({ product_id: await tote() }).expect(200);
    await request(app).post('/api/rest/shippingaddress').set(bearer(act.access_token)).send({
      firstname: 'Jane', lastname: 'Doe', address_1: '1 Market St', city: 'Nairobi', country: 'ke',
    }).expect(201);
    await request(app).post('/api/rest/shippingmethods').set(bearer(act.access_token)).send({ shipping_method: 'standard' }).expect(200);
    await request(app).post('/api/rest/paymentmethods').set(bearer(act.access_token)).send({ payment_method: 'cod', agree: true }).expect(200);
    await request(app).post('/api/rest/confirm').set(bearer(act.access_token)).expect(200);
    const placed = await request(app).put('/api/rest/confirm').set(bearer(act.access_token));
    expect(placed.status).toBe(200);
    const order = (await query('SELECT placed_by, user_id FROM orders WHERE id = $1', [placed.body.data.order_id])).rows[0];
    expect(order).toEqual({ placed_by: expect.any(Number), user_id: customerId });

    // Some things stay with the real customer.
    const pw = await request(app).put('/api/rest/account/password').set(bearer(act.access_token))
      .send({ current_password: PASSWORD, password: 'N3w!Password' });
    expect(pw.body.error).toEqual(['Passwords can’t be changed while acting as a customer.']);
    const review = await request(app).post(`/api/rest/products/${await tote()}/review`).set(bearer(act.access_token))
      .send({ rating: 5, text: 'Great bag, very sturdy.' });
    expect(review.body.error).toEqual(['Reviews must come from the customer themselves.']);
    expect((await request(app).get('/api/admin/orders').set(bearer(act.access_token))).status).toBe(403);

    // Actions are recorded against the customer, with the staff member alongside.
    const logged = (await query(
      `SELECT a.action, u.email AS impersonator FROM audit_logs a JOIN users u ON u.id = a.impersonator_id
       WHERE a.action = 'order.placed'`
    )).rows;
    expect(logged).toEqual([{ action: 'order.placed', impersonator: 'boss@example.com' }]);

    // Stop: the acting session ends and the staff session comes back.
    const stop = await request(app).post('/api/rest/impersonation/stop').set(bearer(act.access_token)).set('Cookie', actingCookie);
    expect(stop.body.data).toMatchObject({ restored: true, user: { email: 'boss@example.com', impersonator: null } });
    expect((await request(app).get('/api/rest/cart').set(bearer(act.access_token))).status).toBe(401);
    const back = await request(app).get('/api/admin/orders').set(bearer(stop.body.data.access_token));
    expect(back.status).toBe(200);
  });

  test('only customers, only with permission, never while already acting', async () => {
    const { admin, customerId } = await setup();
    const staffId = await createUser('cat@example.com', 'catalog_manager');
    const staff = await request(app).post(`/api/admin/users/${staffId}/impersonate`).set(bearer(admin.token));
    expect(staff.body.error).toEqual(['You can only act as customers, not back-office accounts.']);

    await createUser('help@example.com', 'support');
    const support = await signIn('help@example.com');
    expect((await request(app).post(`/api/admin/users/${customerId}/impersonate`).set(bearer(support.token))).status).toBe(403);

    await query("UPDATE users SET status = 'suspended' WHERE id = $1", [customerId]);
    const suspended = await request(app).post(`/api/admin/users/${customerId}/impersonate`).set(bearer(admin.token));
    expect(suspended.body.error).toEqual(['This customer is suspended. Reactivate them first.']);
  });
});

describe('blocked accounts and sessions', () => {
  test('staff unlock a locked account and sign a user out everywhere', async () => {
    await createUser('boss@example.com', 'admin');
    const janeId = await createUser('jane@example.com');
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/rest/login').send({ email: 'jane@example.com', password: 'wrong-password' });
    }
    expect((await request(app).post('/api/rest/login').send({ email: 'jane@example.com', password: PASSWORD })).status).toBe(423);
    const admin = await signIn('boss@example.com');
    const users = await request(app).get('/api/admin/users').set(bearer(admin.token)).query({ email: 'jane@example.com' });
    expect(users.body.data[0].locked_until).toEqual(expect.any(String));

    await request(app).post(`/api/admin/users/${janeId}/unlock`).set(bearer(admin.token)).expect(200);
    const jane = await signIn('jane@example.com');

    const out = await request(app).post(`/api/admin/users/${janeId}/signout`).set(bearer(admin.token));
    expect(out.body.data.signed_out).toBe(1);
    expect((await request(app).get('/api/rest/account').set(bearer(jane.token))).status).toBe(401);

    const activity = await request(app).get(`/api/admin/users/${janeId}/activity`).set(bearer(admin.token));
    const actions = activity.body.data.activity.map((a: any) => a.description);
    expect(actions).toEqual(expect.arrayContaining(['Account locked after failed sign-ins', 'Unlocked an account', 'Signed in']));
  });

  test('you see and end your own sessions; admins see everyone’s', async () => {
    await createUser('boss@example.com', 'admin');
    const laptop = await signIn('boss@example.com');
    const phone = await request(app).post('/api/rest/login')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari')
      .send({ email: 'boss@example.com', password: PASSWORD });
    const mine = await request(app).get('/api/rest/account/sessions').set(bearer(laptop.token));
    expect(mine.body.data).toHaveLength(2);
    expect(mine.body.data[0].current).toBe(true);
    const phoneSession = mine.body.data.find((s: any) => s.device === 'mobile');
    expect(phoneSession).toMatchObject({ browser: 'Safari', os: 'iOS', current: false });

    await request(app).delete(`/api/rest/account/sessions/${phoneSession.session_id}`).set(bearer(laptop.token)).expect(200);
    expect((await request(app).get('/api/rest/account').set(bearer(phone.body.data.access_token))).status).toBe(401);

    await createUser('jane@example.com');
    await signIn('jane@example.com');
    const all = await request(app).get('/api/admin/security/sessions').set(bearer(laptop.token));
    expect(all.body.data.stats).toMatchObject({ active: 2, staff: 1, customers: 1 });
    const janeSession = all.body.data.sessions.find((s: any) => s.user.email === 'jane@example.com');
    await request(app).delete(`/api/admin/security/sessions/${janeSession.session_id}`).set(bearer(laptop.token)).expect(200);

    await createUser('cat@example.com', 'catalog_manager');
    const cat = await signIn('cat@example.com');
    expect((await request(app).get('/api/admin/security/sessions').set(bearer(cat.token))).status).toBe(403);
  });
});

describe('security settings', () => {
  test('password policy, lockout and registration settings take effect', async () => {
    await createUser('boss@example.com', 'admin');
    const admin = await signIn('boss@example.com');
    const current = await request(app).get('/api/admin/security/settings').set(bearer(admin.token));
    expect(current.body.data.settings.lockout).toEqual({ max_attempts: 5, minutes: 15 });

    const bad = await request(app).put('/api/admin/security/settings').set(bearer(admin.token)).send({ password: { min_length: 4 } });
    expect(bad.body.error).toEqual(['Passwords must be at least 8 characters.']);
    const saved = await request(app).put('/api/admin/security/settings').set(bearer(admin.token))
      .send({ password: { min_length: 12, require_symbol: true }, lockout: { max_attempts: 3 } });
    expect(saved.body.data.settings).toMatchObject({ password: { min_length: 12, require_symbol: true }, lockout: { max_attempts: 3, minutes: 15 } });

    const shortPw = await request(app).post('/api/rest/register')
      .send({ firstname: 'A', lastname: 'B', email: 'a@example.com', password: 'Abcdefgh1' });
    expect(shortPw.body.error).toEqual(['Use at least 12 characters for your password.']);
    const noSymbol = await request(app).post('/api/rest/register')
      .send({ firstname: 'A', lastname: 'B', email: 'a@example.com', password: 'Abcdefgh12345' });
    expect(noSymbol.body.error).toEqual(['Your password needs a symbol, such as ! or #.']);

    await createUser('jane@example.com');
    for (let i = 0; i < 3; i += 1) {
      await request(app).post('/api/rest/login').send({ email: 'jane@example.com', password: 'nope' });
    }
    expect((await request(app).post('/api/rest/login').send({ email: 'jane@example.com', password: PASSWORD })).status).toBe(423);

    await request(app).put('/api/admin/security/settings').set(bearer(admin.token)).send({ accounts: { allow_registration: false } }).expect(200);
    const closed = await request(app).post('/api/rest/register')
      .send({ firstname: 'A', lastname: 'B', email: 'b@example.com', password: 'Abcdefgh12345!' });
    expect(closed.status).toBe(403);
  });

  test('store settings: public read, admin-only edits, validated links', async () => {
    const defaults = await request(app).get('/api/rest/store');
    expect(defaults.body.data).toMatchObject({ name: 'Carlos Shop', logo: '', social: { instagram: '' } });

    await createUser('jane@example.com');
    const jane = await signIn('jane@example.com');
    expect((await request(app).put('/api/admin/store-settings').set(bearer(jane.token)).send({ name: 'Mine' })).status).toBe(403);

    await createUser('boss@example.com', 'admin');
    const admin = await signIn('boss@example.com');
    const bad = await request(app).put('/api/admin/store-settings').set(bearer(admin.token))
      .send({ logo: 'javascript:alert(1)', social: { x: 'http://x.com/a' } });
    expect(bad.status).toBe(400);
    expect(bad.body.field_errors).toMatchObject({ logo: expect.any(String), 'social.x': expect.any(String) });

    await request(app).put('/api/admin/store-settings').set(bearer(admin.token))
      .send({ name: 'Nyota Market', social: { instagram: 'https://instagram.com/nyota' } }).expect(200);
    await request(app).put('/api/admin/store-settings').set(bearer(admin.token))
      .send({ social: { x: 'https://x.com/nyota' } }).expect(200);
    const after = await request(app).get('/api/rest/store');
    expect(after.body.data).toMatchObject({
      name: 'Nyota Market',
      tagline: 'Everyday things, chosen with care.',
      social: { instagram: 'https://instagram.com/nyota', x: 'https://x.com/nyota' },
    });
    const log = await query("SELECT action FROM audit_logs WHERE action = 'admin.store_settings_updated'");
    expect(log.rowCount).toBe(2);
  });

  test('back-office sessions end after the idle timeout; customers’ don’t', async () => {
    await createUser('boss@example.com', 'admin');
    await createUser('jane@example.com');
    const admin = await signIn('boss@example.com');
    const jane = await signIn('jane@example.com');
    await query("UPDATE sessions SET last_activity_at = now() - interval '2 hours'");
    const staffRefresh = await request(app).post('/api/rest/refresh').set(ajax).set('Cookie', admin.cookie);
    expect(staffRefresh.status).toBe(401);
    expect(staffRefresh.body.error[0]).toMatch(/signed out after 60 minutes without activity/);
    const customerRefresh = await request(app).post('/api/rest/refresh').set(ajax).set('Cookie', jane.cookie);
    expect(customerRefresh.status).toBe(200);

    const settings = await request(app).get('/api/admin/security/settings').set(bearer(admin.token));
    expect(settings.status).toBe(401); // that session has ended
  });

  test('idle back-office sessions end on any request; background polling isn’t activity', async () => {
    await createUser('boss@example.com', 'admin');
    await createUser('jane@example.com');
    const admin = await signIn('boss@example.com');
    const jane = await signIn('jane@example.com');
    // Sign-in tells the browser the limits it should warn about.
    expect(admin.user).toBeDefined();
    const login = await request(app).post('/api/rest/login').send({ email: 'boss@example.com', password: PASSWORD });
    expect(login.body.data.session).toMatchObject({ idle_minutes: 60, expires_at: expect.any(String) });
    const shopper = await request(app).post('/api/rest/login').send({ email: 'jane@example.com', password: PASSWORD });
    expect(shopper.body.data.session.idle_minutes).toBeNull();

    // The bell polling doesn't keep a session alive.
    await query("UPDATE sessions SET last_activity_at = now() - interval '30 minutes'");
    await request(app).get('/api/admin/notifications').set(bearer(admin.token)).set('X-Background', '1').expect(200);
    const after = (await query('SELECT last_activity_at FROM sessions ORDER BY created_at LIMIT 1')).rows[0];
    expect(Date.now() - new Date(after.last_activity_at).getTime()).toBeGreaterThan(29 * 60000);

    // "Stay signed in" does.
    const keep = await request(app).post('/api/rest/session/keepalive').set(bearer(admin.token));
    expect(keep.body.data).toMatchObject({ idle_minutes: 60 });

    // Past the timeout, the very next request is refused (not just a refresh).
    await query("UPDATE sessions SET last_activity_at = now() - interval '61 minutes'");
    const late = await request(app).get('/api/admin/orders').set(bearer(admin.token));
    expect(late.status).toBe(401);
    expect(late.body.error[0]).toMatch(/signed out after 60 minutes without activity/);
    expect((await request(app).get('/api/rest/customerorders').set(bearer(jane.token))).status).toBe(200);
  });

  test('session length and the number of back-office devices follow the settings', async () => {
    await createUser('boss@example.com', 'super_admin');
    const boss = await signIn('boss@example.com');
    await request(app).put('/api/admin/security/settings').set(bearer(boss.token))
      .send({ staff_sessions: { max_hours: 2, max_concurrent: 2, idle_minutes: 15 } }).expect(200);

    await createUser('ops@example.com', 'order_manager');
    const first = await signIn('ops@example.com');
    const second = await signIn('ops@example.com');
    const third = await request(app).post('/api/rest/login').send({ email: 'ops@example.com', password: PASSWORD });
    const hours = (new Date(third.body.data.session.expires_at).getTime() - Date.now()) / 3600000;
    expect(hours).toBeGreaterThan(1.9);
    expect(hours).toBeLessThanOrEqual(2);
    expect(third.body.data.session.idle_minutes).toBe(15);
    // Only the newest two stay signed in.
    expect((await request(app).get('/api/admin/orders').set(bearer(first.token))).status).toBe(401);
    expect((await request(app).get('/api/admin/orders').set(bearer(second.token))).status).toBe(200);
  });

  test('the password policy also applies when changing a password', async () => {
    await createUser('boss@example.com', 'admin');
    const boss = await signIn('boss@example.com');
    await request(app).put('/api/admin/security/settings').set(bearer(boss.token))
      .send({ password: { min_length: 14, require_symbol: true } }).expect(200);
    await createUser('jane@example.com');
    const jane = await signIn('jane@example.com');
    const short = await request(app).put('/api/rest/account/password').set(bearer(jane.token))
      .send({ current_password: PASSWORD, password: 'Abcdefgh123' });
    expect(short.body.error).toEqual(['Use at least 14 characters for your password.']);
    const good = await request(app).put('/api/rest/account/password').set(bearer(jane.token))
      .send({ current_password: PASSWORD, password: 'Abcdefgh12345!' });
    expect(good.status).toBe(200);
  });

  test('lockout lasts the set number of minutes', async () => {
    await createUser('boss@example.com', 'admin');
    const boss = await signIn('boss@example.com');
    await request(app).put('/api/admin/security/settings').set(bearer(boss.token))
      .send({ lockout: { max_attempts: 3, minutes: 30 } }).expect(200);
    await createUser('jane@example.com');
    for (let i = 0; i < 3; i += 1) {
      await request(app).post('/api/rest/login').send({ email: 'jane@example.com', password: 'nope' });
    }
    const locked = await request(app).post('/api/rest/login').send({ email: 'jane@example.com', password: PASSWORD });
    expect(locked.status).toBe(423);
    expect(locked.body.error[0]).toMatch(/wait 30 minutes/);
    await query("UPDATE users SET locked_until = now() - interval '1 minute' WHERE email = 'jane@example.com'");
    expect((await request(app).post('/api/rest/login').send({ email: 'jane@example.com', password: PASSWORD })).status).toBe(200);
  });

  test('legal pages: full defaults with settings filled in, edited safely by admins, reset to default', async () => {
    const terms = (await request(app).get('/api/rest/legal/terms')).body.data;
    expect(terms.title).toBe('Terms and Conditions');
    expect(terms.body).toContain('Limitation of liability');
    expect(terms.body).toContain('Carlos Shop');
    expect(terms.body).not.toMatch(/\{\{/);
    const refunds = (await request(app).get('/api/rest/legal/refunds')).body.data;
    expect(refunds.body).toContain('within <strong>14 days</strong>');
    expect((await request(app).get('/api/rest/legal/cookies')).status).toBe(404);

    await createUser('jane@example.com');
    const jane = await signIn('jane@example.com');
    expect((await request(app).put('/api/admin/legal/terms').set(bearer(jane.token)).send({ title: 'x', body: 'y' })).status).toBe(403);

    await createUser('boss@example.com', 'admin');
    const admin = await signIn('boss@example.com');
    const page = (await request(app).get('/api/admin/legal/privacy').set(bearer(admin.token))).body.data;
    expect(page).toMatchObject({ customised: false, title: 'Privacy Policy' });
    expect(page.body).toContain('{{store_name}}');
    expect(page.tokens.find((t: any) => t.token === 'return_window_days').value).toBe('14');

    const empty = await request(app).put('/api/admin/legal/privacy').set(bearer(admin.token)).send({ title: 'Privacy', body: '<p></p>' });
    expect(empty.status).toBe(400);
    const saved = await request(app).put('/api/admin/legal/privacy').set(bearer(admin.token)).send({
      title: 'Privacy notice',
      body: '<h2>Who we are</h2><p><strong>{{store_name}}</strong> keeps your data safe. <em>Really.</em> '
        + '<a href="/policies/terms" target="_blank">Terms</a> <a href="https://odpc.go.ke">ODPC</a></p>'
        + '<script>alert(1)</script><p onclick="x()">Returns within {{return_window_days}} days.</p>',
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({ customised: true, title: 'Privacy notice', updated_by: 'Test User' });
    const pub = (await request(app).get('/api/rest/legal/privacy')).body.data;
    expect(pub.title).toBe('Privacy notice');
    expect(pub.body).toContain('<h2>Who we are</h2><p><strong>Carlos Shop</strong> keeps your data safe. <em>Really.</em>');
    expect(pub.body).toContain('<a href="/policies/terms">Terms</a>');
    expect(pub.body).toContain('<a href="https://odpc.go.ke" target="_blank" rel="noopener noreferrer">ODPC</a>');
    expect(pub.body).not.toMatch(/script|onclick/);
    expect(pub.body).toContain('Returns within 14 days.');

    await request(app).post('/api/admin/legal/privacy/reset').set(bearer(admin.token)).expect(200);
    expect((await request(app).get('/api/rest/legal/privacy')).body.data.title).toBe('Privacy Policy');
  });

  test('the audit log is searchable and shows who acted for whom', async () => {
    await createUser('boss@example.com', 'super_admin');
    await createUser('jane@example.com');
    const admin = await signIn('boss@example.com');
    await signIn('jane@example.com');
    const log = await request(app).get('/api/admin/audit').set(bearer(admin.token)).query({ search: 'jane', action: 'auth.' });
    expect(log.body.data.activity.map((a: any) => [a.description, a.user.email])).toEqual([['Signed in', 'jane@example.com']]);
    await createUser('ops@example.com', 'order_manager');
    const ops = await signIn('ops@example.com');
    expect((await request(app).get('/api/admin/audit').set(bearer(ops.token))).status).toBe(403);
  });
});

describe('viewing accounts and fine-grained permissions', () => {
  test('staff view a customer’s account without acting as them', async () => {
    await createUser('help@example.com', 'support');
    const janeId = await createUser('jane@example.com');
    const jane = await signIn('jane@example.com');
    await request(app).post('/api/rest/account/address').set(bearer(jane.token)).send({
      firstname: 'Jane', lastname: 'Doe', address_1: '1 Market St', city: 'Nairobi', country: 'ke',
    }).expect(201);
    await request(app).post('/api/rest/cart').set(bearer(jane.token)).send({ product_id: await tote(), quantity: 2 }).expect(200);

    const support = await signIn('help@example.com');
    const res = await request(app).get(`/api/admin/users/${janeId}/account`).set(bearer(support.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      user: { email: 'jane@example.com' },
      staff: false,
      stats: { orders: 0, cart: 2, sessions: 1 },
      addresses: [{ city: 'Nairobi' }],
      orders: [],
    });
    // Nothing was started in Jane's name.
    expect((await query('SELECT count(*)::int AS n FROM sessions WHERE impersonator_id IS NOT NULL')).rows[0].n).toBe(0);

    await createUser('cat@example.com', 'catalog_manager');
    const cat = await signIn('cat@example.com');
    expect((await request(app).get(`/api/admin/users/${janeId}/account`).set(bearer(cat.token))).status).toBe(403);
  });

  test('suspending and refunding need their own permissions', async () => {
    const roleId = (await query(
      `INSERT INTO roles (code, name, is_system) VALUES ('editor', 'Editor', false) RETURNING id`
    )).rows[0].id;
    await query(
      `INSERT INTO role_permissions (role_id, permission_id) SELECT $1, id FROM permissions WHERE code = ANY($2)`,
      [roleId, ['admin.users.view', 'admin.users.update']]
    );
    await createUser('ed@example.com', 'editor');
    const janeId = await createUser('jane@example.com');
    const ed = await signIn('ed@example.com');
    await request(app).put(`/api/admin/users/${janeId}`).set(bearer(ed.token)).send({ firstname: 'Janet' }).expect(200);
    const suspend = await request(app).put(`/api/admin/users/${janeId}`).set(bearer(ed.token)).send({ status: 'suspended' });
    expect(suspend.body.error).toEqual(['You don’t have permission to suspend or reactivate users.']);
  });

  test('custom roles made before a permission existed receive it', async () => {
    const roleId = (await query(
      `INSERT INTO roles (code, name, is_system) VALUES ('old_ops', 'Old ops', false) RETURNING id`
    )).rows[0].id;
    await query(
      `INSERT INTO role_permissions (role_id, permission_id) SELECT $1, id FROM permissions WHERE code = 'orders.orders.update'`,
      [roleId]
    );
    // Pretend refunds are a brand-new permission, then re-run the seed.
    await query("DELETE FROM permissions WHERE code = 'orders.orders.refund'");
    const { runSeed } = await import('../src/seed');
    await runSeed();
    const codes = (await query(
      `SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = $1 ORDER BY 1`,
      [roleId]
    )).rows.map((r) => r.code);
    expect(codes).toEqual(['orders.orders.refund', 'orders.orders.update']);
  });

  test('built-in roles receive new permissions from their defaults, even after edits', async () => {
    // An older Support role, edited down, from before support requests existed.
    await query(
      `DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE code = 'support')
         AND permission_id IN (SELECT id FROM permissions WHERE code <> 'orders.orders.view')`
    );
    await query("DELETE FROM permissions WHERE code LIKE 'support.tickets.%'");
    const { runSeed } = await import('../src/seed');
    await runSeed();
    const codes = (await query(
      `SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
       JOIN roles r ON r.id = rp.role_id WHERE r.code = 'support' ORDER BY 1`
    )).rows.map((r) => r.code);
    expect(codes).toEqual(['orders.orders.view', 'support.tickets.reply', 'support.tickets.view']);
  });
});
