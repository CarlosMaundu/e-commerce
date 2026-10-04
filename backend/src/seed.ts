// src/seed.ts — idempotent: roles/permissions every start, first super admin
// from ADMIN_EMAIL/ADMIN_PASSWORD, sample catalog only into an empty shop.
import { config } from './config';
import { demoAmount, demoMoney } from './lib/demoMoney';
import { query, transaction } from './db';
import { seedDemoCatalog } from './demoCatalog';
import { hashPassword } from './lib/security';

/**
 * Every permission the API checks. `implied` lists older permissions that
 * already covered it: when a new permission appears, roles holding any of
 * those get it automatically, so existing custom roles keep working.
 */
export const PERMISSION_CATALOG: { code: string; description: string; implied?: string[] }[] = [
  { code: 'dashboard.overview.view', description: 'See the dashboard and sales figures', implied: ['orders.orders.view'] },

  { code: 'orders.orders.view', description: 'View orders' },
  { code: 'orders.orders.update', description: 'Change order status (process, ship, deliver, cancel)' },
  { code: 'orders.orders.refund', description: 'Refund orders', implied: ['orders.orders.update'] },
  { code: 'orders.returns.view', description: 'View return requests', implied: ['orders.orders.view'] },
  { code: 'orders.returns.update', description: 'Approve, reject and refund returns' },

  { code: 'catalog.products.view', description: 'View products, including drafts', implied: ['catalog.products.create', 'catalog.products.update', 'catalog.products.delete'] },
  { code: 'catalog.products.create', description: 'Add products' },
  { code: 'catalog.products.update', description: 'Edit products, prices, variants and stock' },
  { code: 'catalog.products.delete', description: 'Delete products' },
  { code: 'catalog.categories.create', description: 'Add categories' },
  { code: 'catalog.categories.update', description: 'Edit categories' },
  { code: 'catalog.categories.delete', description: 'Delete categories' },
  { code: 'catalog.brands.create', description: 'Add brands', implied: ['catalog.categories.create'] },
  { code: 'catalog.brands.update', description: 'Edit brands and logos', implied: ['catalog.categories.update'] },
  { code: 'catalog.brands.delete', description: 'Delete brands', implied: ['catalog.categories.delete'] },
  { code: 'catalog.files.upload', description: 'Upload product, category and brand images' },

  { code: 'admin.users.view', description: 'View users and their accounts' },
  { code: 'admin.users.create', description: 'Add users' },
  { code: 'admin.users.update', description: 'Edit users’ names and roles' },
  { code: 'admin.users.suspend', description: 'Suspend and reactivate users', implied: ['admin.users.update'] },
  { code: 'admin.users.unlock', description: 'Unlock accounts locked after failed sign-ins', implied: ['admin.users.update'] },
  { code: 'admin.users.signout', description: 'Sign users out of every device', implied: ['admin.users.update'] },
  { code: 'admin.users.reset_password', description: 'Send password reset emails' },
  { code: 'admin.users.impersonate', description: 'View the shop as a customer' },
  { code: 'admin.roles.view', description: 'View roles and permissions', implied: ['admin.users.view'] },
  { code: 'admin.roles.manage', description: 'Create, edit and delete roles' },
  { code: 'admin.security.view', description: 'View sign-in sessions and security settings', implied: ['admin.security.manage'] },
  { code: 'admin.security.manage', description: 'Change security settings and end sessions' },
  { code: 'admin.audit.view', description: 'View the audit log' },
  { code: 'admin.settings.manage', description: 'Change the shop’s name, logo, favicon and contact details', implied: ['admin.security.manage'] },
  { code: 'admin.finance.manage', description: 'Change the currency and tax', implied: ['admin.settings.manage'] },
  { code: 'admin.delivery.manage', description: 'Change delivery options, prices and the pick-up point', implied: ['admin.finance.manage'] },
];

export const PERMISSIONS: Record<string, string> = Object.fromEntries(
  PERMISSION_CATALOG.map((p) => [p.code, p.description])
);

const all = Object.keys(PERMISSIONS);
const startsWith = (...prefixes: string[]) => all.filter((p) => prefixes.some((x) => p.startsWith(x)));

export const ROLES: { code: string; name: string; description: string; system: boolean; permissions: string[] }[] = [
  { code: 'super_admin', name: 'Super admin', description: 'Everything, including roles', system: true, permissions: ['*'] },
  { code: 'admin', name: 'Admin', description: 'Runs the shop; cannot manage roles', system: true, permissions: all.filter((p) => p !== 'admin.roles.manage') },
  { code: 'catalog_manager', name: 'Catalog manager', description: 'Products, categories and brands', system: false, permissions: startsWith('catalog.') },
  { code: 'order_manager', name: 'Order manager', description: 'Orders and returns', system: false, permissions: startsWith('orders.', 'dashboard.') },
  {
    code: 'support', name: 'Support', description: 'Helps customers', system: false,
    permissions: ['admin.users.view', 'admin.roles.view', 'admin.users.reset_password', 'admin.users.unlock', 'orders.orders.view', 'orders.returns.view', 'dashboard.overview.view'],
  },
  { code: 'customer', name: 'Customer', description: 'Shops in the store', system: true, permissions: [] },
];

const seedRoles = () =>
  transaction(async (client) => {
    const added: string[] = [];
    for (const [code, description] of Object.entries({ '*': 'Everything', ...PERMISSIONS })) {
      const { rows } = await client.query(
        `INSERT INTO permissions (code, module, description) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description
         RETURNING (xmax = 0) AS inserted`,
        [code, code === '*' ? 'all' : code.split('.')[0], description]
      );
      if (rows[0].inserted) added.push(code);
    }
    // Permissions no longer in the catalogue disappear from every role.
    await client.query("DELETE FROM permissions WHERE code <> '*' AND NOT (code = ANY($1::text[]))", [all]);

    for (const role of ROLES) {
      const { rows } = await client.query(
        `INSERT INTO roles (code, name, description, is_system) VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
           is_system = EXCLUDED.is_system, updated_at = now()
         RETURNING id`,
        [role.code, role.name, role.description, role.system]
      );
      // System roles are reset to their defaults; custom roles keep edits.
      const existing = await client.query('SELECT 1 FROM role_permissions WHERE role_id = $1 LIMIT 1', [rows[0].id]);
      if (role.system || !existing.rows[0]) {
        await client.query('DELETE FROM role_permissions WHERE role_id = $1', [rows[0].id]);
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT $1, id FROM permissions WHERE code = ANY($2::text[])`,
          [rows[0].id, role.permissions]
        );
      }
    }

    // New, finer permissions go to roles that held what used to cover them.
    for (const p of PERMISSION_CATALOG.filter((x) => added.includes(x.code) && x.implied)) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT DISTINCT rp.role_id, (SELECT id FROM permissions WHERE code = $1)
         FROM role_permissions rp JOIN permissions src ON src.id = rp.permission_id
         JOIN roles r ON r.id = rp.role_id
         WHERE src.code = ANY($2::text[]) AND NOT r.is_system
         ON CONFLICT DO NOTHING`,
        [p.code, p.implied]
      );
    }
  });

const seedSuperAdmin = async () => {
  const { adminEmail, adminPassword } = config.seed;
  const existing = (
    await query(`SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'super_admin' LIMIT 1`)
  ).rows[0];
  if (existing || !adminEmail) return;
  if (adminPassword.length < 12) {
    console.warn('ADMIN_PASSWORD must be at least 12 characters; first super admin not created.');
    return;
  }
  await query(
    `INSERT INTO users (email, password_hash, firstname, lastname, role_id)
     SELECT lower($1), $2, 'Shop', 'Admin', id FROM roles WHERE code = 'super_admin'
     ON CONFLICT DO NOTHING`,
    [adminEmail, await hashPassword(adminPassword)]
  );
  console.log(`Created first super admin ${adminEmail}`);
};

// Demo catalog (seed/catalog.json), only when sample data is on and the shop is empty.
const seedSampleCatalog = async () => {
  if (!config.seed.sampleCatalog) return;
  if ((await query('SELECT 1 FROM products LIMIT 1')).rows[0]) return;
  if ((await query('SELECT 1 FROM categories LIMIT 1')).rows[0]) return;
  await seedDemoCatalog();
};

// Sample promo codes, only when sample data is on and no coupons exist yet.
const seedSampleCoupons = async () => {
  if (!config.seed.sampleCatalog) return;
  if ((await query('SELECT 1 FROM coupons LIMIT 1')).rows[0]) return;
  // Written in dollars; converted when the shop uses another currency.
  await query(
    `INSERT INTO coupons (code, description, type, value, min_total) VALUES
       ('WELCOME10', '10% off your order', 'percent', 10, 0),
       ('FRIDAY35', $1, 'percent', 35, $2),
       ('SAVE5', $3, 'fixed', $4, 0)`,
    [`35% off orders over ${demoMoney(50)}`, demoAmount(50), `${demoMoney(5)} off any order`, demoAmount(5)]
  );
  console.log('Seeded sample promo codes');
};

export const runSeed = async () => {
  await seedRoles();
  await seedSuperAdmin();
  await seedSampleCoupons(); // first: promotions refer to coupons
  await seedSampleCatalog();
};
