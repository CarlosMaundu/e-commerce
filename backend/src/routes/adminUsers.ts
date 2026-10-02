// src/routes/adminUsers.ts — /api/admin/users and /api/admin/roles
// Rules from the portal's administration spec: no changing your own role or
// status, only super admins manage super admins, at least one super admin.
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { sendAccountSetupEmail, sendPasswordResetEmail } from '../lib/mailer';
import { revokeAllSessions } from '../lib/sessions';
import { findUserByEmail, findUserById, roleIdFor, toContractUser, UserRow } from '../lib/users';
import { authenticate, requirePermission } from '../middleware/auth';
import { issueEmailToken, resetLink } from './auth';

const isSuperAdmin = (u: UserRow) => u.role === 'super_admin';

const guardTarget = (actor: UserRow, target: UserRow) => {
  if (isSuperAdmin(target) && !isSuperAdmin(actor)) {
    fail(403, 'Only a super admin can change another super admin.');
  }
};

const ensureAnotherSuperAdmin = async (target: UserRow) => {
  if (!isSuperAdmin(target)) return;
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM users u JOIN roles r ON r.id = u.role_id
     WHERE r.code = 'super_admin' AND u.status = 'active' AND u.id <> $1`,
    [target.id]
  );
  if (rows[0].n === 0) fail(409, 'There must always be at least one active super admin.');
};

export const adminUserRoutes = () => {
  const router = Router();
  router.use(authenticate);

  router.get(
    '/roles',
    requirePermission('admin.users.view'),
    handler(async (_req, res) => {
      const { rows } = await query(
        `SELECT r.code, r.name, r.description, r.is_system,
                (SELECT count(*)::int FROM users u WHERE u.role_id = r.id) AS user_count,
                EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id) AS is_staff
         FROM roles r ORDER BY r.id`
      );
      ok(res, rows);
    })
  );

  router.get(
    '/users',
    requirePermission('admin.users.view'),
    handler(async (req, res) => {
      const q = parse(
        z.object({
          email: z.string().trim().toLowerCase().optional(),
          search: z.string().trim().max(100).optional(),
          limit: z.coerce.number().int().min(1).max(200).default(200),
          page: z.coerce.number().int().min(1).default(1),
        }),
        req.query
      );
      const params: unknown[] = [];
      const where: string[] = [];
      if (q.email) {
        params.push(q.email);
        where.push(`lower(u.email) = $${params.length}`);
      }
      if (q.search) {
        params.push(`%${q.search}%`);
        where.push(`(u.email ILIKE $${params.length} OR (u.firstname || ' ' || u.lastname) ILIKE $${params.length})`);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = (await query(`SELECT count(*)::int AS n FROM users u ${whereSql}`, params)).rows[0].n;
      params.push(q.limit, (q.page - 1) * q.limit);
      const { rows } = await query<UserRow>(
        `SELECT u.*, r.code AS role FROM users u JOIN roles r ON r.id = u.role_id ${whereSql}
         ORDER BY u.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      res.set('X-Total-Count', String(total));
      ok(res, rows.map((u) => toContractUser(u)));
    })
  );

  const roleCode = z.string().trim().min(1);

  router.post(
    '/users',
    requirePermission('admin.users.create'),
    handler(async (req, res) => {
      const b = parse(
        z.object({
          firstname: z.string().trim().min(1, 'Please enter a name.').max(100),
          lastname: z.string().trim().max(100).default(''),
          email: z.string().trim().toLowerCase().email('Please enter a valid email address.'),
          role: roleCode.default('customer'),
          avatar: z.string().trim().max(2000).default(''),
        }),
        req.body
      );
      if (b.role === 'super_admin' && !isSuperAdmin(req.auth!.user)) {
        fail(403, 'Only a super admin can create another super admin.');
      }
      const roleId = await roleIdFor(b.role);
      if (!roleId) fail(400, 'Please choose a valid role.');
      if (await findUserByEmail(b.email)) fail(409, 'A user with this email already exists.');
      const { rows } = await query<{ id: number }>(
        `INSERT INTO users (email, firstname, lastname, avatar, role_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [b.email, b.firstname, b.lastname, b.avatar, roleId]
      );
      const user = await findUserById(rows[0].id);
      const token = await issueEmailToken(user.id, 'setup');
      await sendAccountSetupEmail(user.email, user.firstname, resetLink(token));
      audit(req, 'admin.user_created', `user:${user.id}`, { role: b.role });
      ok(res, toContractUser(user), 201);
    })
  );

  router.put(
    '/users/:id',
    requirePermission('admin.users.update'),
    handler(async (req, res) => {
      const target = await findUserById(Number(req.params.id));
      if (!target) fail(404, 'User not found.');
      const actor = req.auth!.user;
      guardTarget(actor, target);
      const b = parse(
        z.object({
          firstname: z.string().trim().min(1, 'Please enter a name.').max(100).optional(),
          lastname: z.string().trim().max(100).optional(),
          avatar: z.string().trim().max(2000).optional(),
          role: roleCode.optional(),
          status: z.enum(['active', 'suspended'], { errorMap: () => ({ message: 'Please choose a valid status.' }) }).optional(),
        }),
        req.body
      );
      let roleId: number | undefined;
      if (b.role !== undefined && b.role !== target.role) {
        if (target.id === actor.id) fail(403, 'You can’t change your own role.');
        if (b.role === 'super_admin' && !isSuperAdmin(actor)) fail(403, 'Only a super admin can grant the super admin role.');
        roleId = await roleIdFor(b.role);
        if (!roleId) fail(400, 'Please choose a valid role.');
        await ensureAnotherSuperAdmin(target);
      }
      if (b.status !== undefined && b.status !== target.status) {
        if (target.id === actor.id) fail(403, 'You can’t suspend your own account.');
        if (b.status === 'suspended') await ensureAnotherSuperAdmin(target);
      }
      await query(
        `UPDATE users SET firstname = COALESCE($2, firstname), lastname = COALESCE($3, lastname),
           avatar = COALESCE($4, avatar), role_id = COALESCE($5, role_id), status = COALESCE($6, status),
           updated_at = now()
         WHERE id = $1`,
        [target.id, b.firstname ?? null, b.lastname ?? null, b.avatar ?? null, roleId ?? null, b.status ?? null]
      );
      if (b.status === 'suspended') await revokeAllSessions(target.id);
      audit(req, 'admin.user_updated', `user:${target.id}`, { fields: Object.keys(req.body || {}) });
      ok(res, toContractUser(await findUserById(target.id)));
    })
  );

  router.post(
    '/users/:id/reset-password',
    requirePermission('admin.users.reset_password'),
    handler(async (req, res) => {
      const target = await findUserById(Number(req.params.id));
      if (!target) fail(404, 'User not found.');
      guardTarget(req.auth!.user, target);
      const purpose = target.password_hash ? 'reset' : 'setup';
      const token = await issueEmailToken(target.id, purpose);
      if (purpose === 'reset') await sendPasswordResetEmail(target.email, resetLink(token));
      else await sendAccountSetupEmail(target.email, target.firstname, resetLink(token));
      audit(req, 'admin.password_reset_sent', `user:${target.id}`, { purpose });
      ok(res, { sent: true, purpose });
    })
  );

  return router;
};
