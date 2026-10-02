// src/routes/adminRoles.ts — permissions catalogue and custom roles.
// Rules (portal administration spec): system roles can't be edited or
// deleted, roles in use can't be deleted, and nobody can hand out a
// permission they don't hold themselves.
import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { hasPermission } from '../lib/users';
import { authenticate, requirePermission } from '../middleware/auth';

const MODULE_NAMES: Record<string, string> = {
  catalog: 'Catalog',
  orders: 'Orders',
  admin: 'Administration',
};

const loadRole = async (code: string) => {
  const role = (await query('SELECT * FROM roles WHERE code = $1', [code])).rows[0];
  if (!role) return null;
  const permissions = (
    await query(
      `SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1 ORDER BY p.code`,
      [role.id]
    )
  ).rows.map((r) => r.code);
  const userCount = (await query('SELECT count(*)::int AS n FROM users WHERE role_id = $1', [role.id])).rows[0].n;
  return {
    id: role.id,
    contract: {
      code: role.code,
      name: role.name,
      description: role.description,
      is_system: role.is_system,
      user_count: userCount,
      permissions,
    },
  };
};

const slugify = (name: string) =>
  name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

const roleBody = z.object({
  name: z.string().trim().min(2, 'Please enter a role name.').max(60, 'Use at most 60 characters.'),
  description: z.string().trim().max(255).default(''),
  permissions: z.array(z.string()).max(100).default([]),
});

export const adminRoleRoutes = () => {
  const router = Router();
  router.use(['/permissions', '/roles'], authenticate);

  const checkGrantable = async (actorPermissions: string[], wanted: string[]) => {
    if (wanted.includes('*')) fail(403, 'Custom roles can’t be given every permission. Pick the permissions they need.');
    const known = new Set((await query('SELECT code FROM permissions')).rows.map((r) => r.code));
    const unknown = wanted.filter((p) => !known.has(p));
    if (unknown.length) fail(400, `Unknown permission: ${unknown.join(', ')}.`);
    const notHeld = wanted.filter((p) => !hasPermission(actorPermissions, p));
    if (notHeld.length) fail(403, 'You can only grant permissions you have yourself.');
  };

  const savePermissions = (roleId: number, permissions: string[]) =>
    transaction(async (db) => {
      await db.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
      await db.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, id FROM permissions WHERE code = ANY($2::text[])`,
        [roleId, permissions]
      );
    });

  router.get('/permissions', requirePermission('admin.users.view'), handler(async (_req, res) => {
    const { rows } = await query("SELECT code, module, description FROM permissions WHERE code <> '*' ORDER BY module, code");
    const groups = new Map<string, { code: string; description: string }[]>();
    for (const r of rows) {
      if (!groups.has(r.module)) groups.set(r.module, []);
      groups.get(r.module)!.push({ code: r.code, description: r.description });
    }
    ok(res, [...groups].map(([module, permissions]) => ({
      module, name: MODULE_NAMES[module] || module, permissions,
    })));
  }));

  router.get('/roles/:code', requirePermission('admin.users.view'), handler(async (req, res) => {
    const role = await loadRole(req.params.code);
    if (!role) fail(404, 'Role not found.');
    ok(res, role!.contract);
  }));

  router.post('/roles', requirePermission('admin.roles.manage'), handler(async (req, res) => {
    const b = parse(roleBody, req.body);
    const code = slugify(b.name);
    if (!code) fail(400, 'Please use letters or numbers in the role name.');
    if ((await query('SELECT 1 FROM roles WHERE code = $1 OR lower(name) = lower($2)', [code, b.name])).rows[0]) {
      fail(409, 'A role with this name already exists.');
    }
    await checkGrantable(req.auth!.permissions, b.permissions);
    const { rows } = await query(
      'INSERT INTO roles (code, name, description, is_system) VALUES ($1, $2, $3, false) RETURNING id',
      [code, b.name, b.description]
    );
    await savePermissions(rows[0].id, b.permissions);
    audit(req, 'admin.role_created', `role:${code}`, { permissions: b.permissions });
    ok(res, (await loadRole(code))!.contract, 201);
  }));

  router.put('/roles/:code', requirePermission('admin.roles.manage'), handler(async (req, res) => {
    const role = await loadRole(req.params.code);
    if (!role) fail(404, 'Role not found.');
    if (role!.contract.is_system) fail(403, 'Built-in roles can’t be changed. Duplicate it to make a custom version.');
    const b = parse(roleBody.partial(), req.body);
    if (b.name && b.name.toLowerCase() !== role!.contract.name.toLowerCase()) {
      if ((await query('SELECT 1 FROM roles WHERE lower(name) = lower($1)', [b.name])).rows[0]) {
        fail(409, 'A role with this name already exists.');
      }
    }
    if (b.permissions) {
      await checkGrantable(req.auth!.permissions, b.permissions);
      // Removing permissions you don't hold would also be an escalation path.
      const removed = role!.contract.permissions.filter((p) => !b.permissions!.includes(p));
      if (removed.some((p) => !hasPermission(req.auth!.permissions, p))) {
        fail(403, 'You can only change permissions you have yourself.');
      }
      await savePermissions(role!.id, b.permissions);
    }
    await query(
      'UPDATE roles SET name = COALESCE($2, name), description = COALESCE($3, description), updated_at = now() WHERE id = $1',
      [role!.id, b.name ?? null, b.description ?? null]
    );
    audit(req, 'admin.role_updated', `role:${req.params.code}`, { fields: Object.keys(req.body || {}) });
    ok(res, (await loadRole(req.params.code))!.contract);
  }));

  router.post('/roles/:code/duplicate', requirePermission('admin.roles.manage'), handler(async (req, res) => {
    const source = await loadRole(req.params.code);
    if (!source) fail(404, 'Role not found.');
    const { name } = parse(z.object({ name: roleBody.shape.name }), req.body);
    const code = slugify(name);
    if ((await query('SELECT 1 FROM roles WHERE code = $1 OR lower(name) = lower($2)', [code, name])).rows[0]) {
      fail(409, 'A role with this name already exists.');
    }
    const permissions = source!.contract.permissions.filter((p) => p !== '*');
    await checkGrantable(req.auth!.permissions, permissions);
    const { rows } = await query(
      'INSERT INTO roles (code, name, description, is_system) VALUES ($1, $2, $3, false) RETURNING id',
      [code, name, source!.contract.description]
    );
    await savePermissions(rows[0].id, permissions);
    audit(req, 'admin.role_created', `role:${code}`, { duplicated_from: req.params.code });
    ok(res, (await loadRole(code))!.contract, 201);
  }));

  router.delete('/roles/:code', requirePermission('admin.roles.manage'), handler(async (req, res) => {
    const role = await loadRole(req.params.code);
    if (!role) fail(404, 'Role not found.');
    if (role!.contract.is_system) fail(403, 'Built-in roles can’t be deleted.');
    if (role!.contract.user_count) {
      fail(409, `${role!.contract.user_count} user${role!.contract.user_count === 1 ? ' has' : 's have'} this role. Give them another role first.`);
    }
    await query('DELETE FROM roles WHERE id = $1', [role!.id]);
    audit(req, 'admin.role_deleted', `role:${req.params.code}`);
    ok(res, true);
  }));

  return router;
};
