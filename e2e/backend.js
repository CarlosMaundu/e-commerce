// e2e/backend.js — test helpers that talk to the e2e database and Mailpit.
const { Pool } = require('pg');

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ||
  'postgres://shop:shop@localhost:5433/carlos_shop_e2e';
const MAILPIT_URL = process.env.MAILPIT_URL || 'http://localhost:8025';
const API_URL = 'http://localhost:4100/api';
const PASSWORD = 'Str0ng!Pass1';

let pool;
const db = () => {
  if (!pool) pool = new Pool({ connectionString: E2E_DATABASE_URL, max: 2 });
  return pool;
};

/**
 * Removes all people, sessions and orders (CASCADE reaches carts, addresses,
 * orders and returns); keeps roles and the sample catalog.
 */
const resetUsers = async () => {
  await db().query(
    'TRUNCATE users, sessions, auth_tokens, audit_logs, newsletter_subscribers RESTART IDENTITY CASCADE'
  );
  await db().query('UPDATE coupons SET uses_count = 0');
  await db().query(
    "DELETE FROM roles WHERE code NOT IN ('super_admin', 'admin', 'catalog_manager', 'order_manager', 'support', 'customer')"
  );
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });
};

/** Creates a user through the real register endpoint, then sets their role. */
const createUser = async ({
  email,
  firstname = 'Test',
  lastname = 'User',
  role = 'customer',
  password = PASSWORD,
}) => {
  const res = await fetch(`${API_URL}/rest/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ firstname, lastname, email, password }),
  });
  if (!res.ok) throw new Error(`register failed: ${await res.text()}`);
  if (role !== 'customer') {
    await db().query(
      'UPDATE users SET role_id = (SELECT id FROM roles WHERE code = $2) WHERE lower(email) = lower($1)',
      [email, role]
    );
  }
};

const userRow = async (email) =>
  (
    await db().query(
      'SELECT u.*, r.code AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE lower(u.email) = lower($1)',
      [email]
    )
  ).rows[0];

/** Waits for an email to `to` and returns the first link in it. */
const linkFromLatestEmail = async (to, { timeout = 15000 } = {}) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`
    );
    const { messages = [] } = await res.json();
    if (messages.length) {
      const message = await (
        await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)
      ).json();
      const match = message.Text.match(/https?:\/\/\S+/);
      if (match) return { link: match[0], subject: message.Subject };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No email arrived for ${to}`);
};

module.exports = {
  E2E_DATABASE_URL,
  MAILPIT_URL,
  PASSWORD,
  resetUsers,
  createUser,
  userRow,
  linkFromLatestEmail,
};
