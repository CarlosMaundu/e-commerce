import request from 'supertest';
import { query } from '../src/db';
import {
  ajax, app, bearer, closePool, createUser, googleIdentities, PASSWORD,
  resetDatabase, sentEmails, signIn,
} from './helpers';
import { tokenFrom } from './mailerMock';

jest.mock('../src/lib/mailer', () => require('./mailerMock').mailerMock());

beforeEach(resetDatabase);
afterAll(closePool);

describe('register and sign in', () => {
  test('register creates a customer and signs them in', async () => {
    const res = await request(app).post('/api/rest/register').send({
      firstname: 'Grace', lastname: 'Hopper', email: 'Grace@Example.com', password: PASSWORD,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      email: 'grace@example.com', firstname: 'Grace', role: 'customer', permissions: [],
    });
    expect(res.body.data.access_token).toBeTruthy();
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^cs_refresh=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\/api\/rest/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  test('register rejects weak passwords and duplicates with friendly messages', async () => {
    const weak = await request(app).post('/api/rest/register').send({
      firstname: 'A', lastname: 'B', email: 'a@example.com', password: 'short',
    });
    expect(weak.status).toBe(400);
    expect(weak.body.error).toContain('Use at least 8 characters for your password.');

    await createUser('taken@example.com');
    const dup = await request(app).post('/api/rest/register').send({
      firstname: 'A', lastname: 'B', email: 'TAKEN@example.com', password: PASSWORD,
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error[0]).toMatch(/already exists/);
  });

  test('wrong password and unknown email get the same answer', async () => {
    await createUser('jane@example.com');
    const wrong = await request(app).post('/api/rest/login').send({ email: 'jane@example.com', password: 'nope' });
    const unknown = await request(app).post('/api/rest/login').send({ email: 'nobody@example.com', password: 'nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.body.error).toEqual(wrong.body.error);
    expect(wrong.body.error[0]).toBe('The email or password is incorrect. Please try again.');
  });

  test('locks the account after repeated failures', async () => {
    await createUser('jane@example.com');
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/rest/login').send({ email: 'jane@example.com', password: 'nope' });
    }
    const locked = await request(app).post('/api/rest/login').send({ email: 'jane@example.com', password: PASSWORD });
    expect(locked.status).toBe(423);
    expect(locked.body.error[0]).toMatch(/Too many failed attempts/);
  });

  test('suspended users cannot sign in', async () => {
    const id = await createUser('jane@example.com');
    await query("UPDATE users SET status = 'suspended' WHERE id = $1", [id]);
    const res = await request(app).post('/api/rest/login').send({ email: 'jane@example.com', password: PASSWORD });
    expect(res.status).toBe(403);
  });
});

describe('sessions', () => {
  test('refresh rotates the cookie and the old one stops working', async () => {
    await createUser('jane@example.com');
    const { cookie } = await signIn('jane@example.com');
    const first = await request(app).post('/api/rest/refresh').set('Cookie', cookie).set(ajax);
    expect(first.status).toBe(200);
    expect(first.body.data.access_token).toBeTruthy();
    const replay = await request(app).post('/api/rest/refresh').set('Cookie', cookie).set(ajax);
    expect(replay.status).toBe(401);
  });

  test('refresh requires the X-Requested-With header (CSRF guard)', async () => {
    await createUser('jane@example.com');
    const { cookie } = await signIn('jane@example.com');
    const res = await request(app).post('/api/rest/refresh').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  test('logout revokes the session, including its access token', async () => {
    await createUser('jane@example.com');
    const { token, cookie } = await signIn('jane@example.com');
    const out = await request(app).post('/api/rest/logout').set('Cookie', cookie).set(ajax);
    expect(out.status).toBe(200);
    const after = await request(app).get('/api/rest/account').set(bearer(token));
    expect(after.status).toBe(401);
  });

  test('suspending a user cuts off their current access token immediately', async () => {
    const id = await createUser('jane@example.com');
    const { token } = await signIn('jane@example.com');
    await query("UPDATE users SET status = 'suspended' WHERE id = $1", [id]);
    const res = await request(app).get('/api/rest/account').set(bearer(token));
    expect(res.status).toBe(403);
  });

  test('a tampered access token is rejected', async () => {
    const res = await request(app).get('/api/rest/account').set(bearer('abc.def.ghi'));
    expect(res.status).toBe(401);
    expect(res.body.error[0]).toBe('Your session has expired. Please sign in again.');
  });
});

describe('password reset and change', () => {
  test('forgotten password emails a single-use link that works once', async () => {
    await createUser('jane@example.com');
    const res = await request(app).post('/api/rest/forgotten').send({ email: 'jane@example.com' });
    expect(res.body.data).toEqual({ sent: true });
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].link.startsWith('http://shop.test/reset-password?token=')).toBe(true);
    const token = tokenFrom(sentEmails[0].link);

    const check = await request(app).get('/api/rest/reset-password').query({ token });
    expect(check.body.data).toMatchObject({ valid: true, purpose: 'reset', email: 'jane@example.com' });

    const newPassword = 'N3w!Password';
    const done = await request(app).post('/api/rest/reset-password').send({ token, password: newPassword });
    expect(done.status).toBe(200);
    await signIn('jane@example.com', newPassword);

    const again = await request(app).post('/api/rest/reset-password').send({ token, password: newPassword });
    expect(again.status).toBe(400);
    expect(again.body.error[0]).toMatch(/invalid or has expired/);
  });

  test('forgotten password answers the same for unknown emails and sends nothing', async () => {
    const res = await request(app).post('/api/rest/forgotten').send({ email: 'ghost@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ sent: true });
    expect(sentEmails).toHaveLength(0);
  });

  test('changing password needs the current one and signs out other devices', async () => {
    await createUser('jane@example.com');
    const laptop = await signIn('jane@example.com');
    const phone = await signIn('jane@example.com');

    const wrong = await request(app).put('/api/rest/account/password').set(bearer(laptop.token))
      .send({ current_password: 'nope', password: 'An0ther!Pass' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error[0]).toBe('Your current password is incorrect.');

    const ok = await request(app).put('/api/rest/account/password').set(bearer(laptop.token))
      .send({ current_password: PASSWORD, password: 'An0ther!Pass' });
    expect(ok.status).toBe(200);

    expect((await request(app).get('/api/rest/account').set(bearer(laptop.token))).status).toBe(200);
    expect((await request(app).get('/api/rest/account').set(bearer(phone.token))).status).toBe(401);
    await signIn('jane@example.com', 'An0ther!Pass');
  });
});

describe('Google sign-in', () => {
  const identity = (overrides = {}) => ({
    sub: 'google-123', email: 'gina@example.com', emailVerified: true,
    givenName: 'Gina', familyName: 'Google', picture: 'https://example.com/g.png', ...overrides,
  });

  test('creates a customer on first sign-in', async () => {
    googleIdentities.tok1 = identity();
    const res = await request(app).post('/api/rest/sociallogin').send({ provider: 'google', id_token: 'tok1' });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      email: 'gina@example.com', firstname: 'Gina', role: 'customer', has_password: false,
    });
  });

  test('links Google to an existing account with the same verified email', async () => {
    const id = await createUser('gina@example.com');
    googleIdentities.tok2 = identity();
    const res = await request(app).post('/api/rest/sociallogin').send({ provider: 'google', id_token: 'tok2' });
    expect(res.body.data.user.customer_id).toBe(id);
    expect((await query('SELECT google_sub FROM users WHERE id = $1', [id])).rows[0].google_sub).toBe('google-123');
  });

  test('refuses unverified Google emails and bad tokens', async () => {
    googleIdentities.tok3 = identity({ emailVerified: false });
    const unverified = await request(app).post('/api/rest/sociallogin').send({ provider: 'google', id_token: 'tok3' });
    expect(unverified.status).toBe(401);
    const bad = await request(app).post('/api/rest/sociallogin').send({ provider: 'google', id_token: 'forged' });
    expect(bad.status).toBe(401);
  });

  test('Google-only users are told how to add a password', async () => {
    googleIdentities.tok4 = identity();
    const { body } = await request(app).post('/api/rest/sociallogin').send({ provider: 'google', id_token: 'tok4' });
    const res = await request(app).put('/api/rest/account/password').set(bearer(body.data.access_token))
      .send({ password: 'An0ther!Pass' });
    expect(res.status).toBe(400);
    expect(res.body.error[0]).toMatch(/sign in with Google/);
  });
});
