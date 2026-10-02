// src/seed.ts — idempotent: roles/permissions every start, first super admin
// from ADMIN_EMAIL/ADMIN_PASSWORD, sample catalog only into an empty shop.
import { config } from './config';
import { query, transaction } from './db';
import { seedDemoCatalog } from './demoCatalog';
import { hashPassword } from './lib/security';

export const PERMISSIONS: Record<string, string> = {
  'catalog.products.create': 'Add products',
  'catalog.products.update': 'Edit products',
  'catalog.products.delete': 'Delete products',
  'catalog.categories.create': 'Add categories and brands',
  'catalog.categories.update': 'Edit categories and brands',
  'catalog.categories.delete': 'Delete categories and brands',
  'catalog.files.upload': 'Upload product and category images',
  'orders.orders.view': 'View all orders',
  'orders.orders.update': 'Change order status',
  'orders.returns.update': 'Process returns',
  'admin.users.view': 'View users and roles',
  'admin.users.create': 'Add users',
  'admin.users.update': 'Edit users, roles and status',
  'admin.users.reset_password': 'Send password reset emails',
  'admin.users.impersonate': 'View the shop as a customer',
  'admin.roles.manage': 'Create and edit roles',
  'admin.security.manage': 'Manage security settings and sign-in sessions',
  'admin.audit.view': 'View the audit log',
};

const all = Object.keys(PERMISSIONS);
const startsWith = (...prefixes: string[]) => all.filter((p) => prefixes.some((x) => p.startsWith(x)));

export const ROLES: { code: string; name: string; description: string; system: boolean; permissions: string[] }[] = [
  { code: 'super_admin', name: 'Super admin', description: 'Everything, including roles', system: true, permissions: ['*'] },
  { code: 'admin', name: 'Admin', description: 'Runs the shop; cannot manage roles', system: true, permissions: all.filter((p) => p !== 'admin.roles.manage') },
  { code: 'catalog_manager', name: 'Catalog manager', description: 'Products and categories', system: false, permissions: startsWith('catalog.') },
  { code: 'order_manager', name: 'Order manager', description: 'Orders and returns', system: false, permissions: startsWith('orders.') },
  { code: 'support', name: 'Support', description: 'Helps customers', system: false, permissions: ['admin.users.view', 'orders.orders.view'] },
  { code: 'customer', name: 'Customer', description: 'Shops in the store', system: true, permissions: [] },
];

const seedRoles = () =>
  transaction(async (client) => {
    for (const [code, description] of Object.entries({ '*': 'Everything', ...PERMISSIONS })) {
      await client.query(
        `INSERT INTO permissions (code, module, description) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description`,
        [code, code === '*' ? 'all' : code.split('.')[0], description]
      );
    }
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
  await query(
    `INSERT INTO coupons (code, description, type, value, min_total) VALUES
       ('WELCOME10', '10% off your order', 'percent', 10, 0),
       ('FRIDAY35', '35% off orders over $50', 'percent', 35, 50),
       ('SAVE5', '$5 off any order', 'fixed', 5, 0)`
  );
  console.log('Seeded sample promo codes');
};

export const runSeed = async () => {
  await seedRoles();
  await seedSuperAdmin();
  await seedSampleCoupons(); // first: promotions refer to coupons
  await seedSampleCatalog();
};
