// src/routes/adminSecurity.ts — back-office tools adapted from the portal's
// administration and security modules: act as a customer, unlock accounts,
// sign users out, user activity, the audit log, sign-in sessions and the
// security settings.
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { IMPERSONATION_MINUTES, revokeAllSessions, revokeSession, startImpersonation } from '../lib/sessions';
import { getSettings, saveSettings, settingsSchema } from '../lib/settings';
import { getStore, saveStore, storeSchema } from '../lib/store';
import { findUserById, permissionsForRole, UserRow } from '../lib/users';
import { authenticate, notWhileImpersonating, requirePermission } from '../middleware/auth';

const isSuperAdmin = (u: UserRow) => u.role === 'super_admin';

/** Sessions for display: device and browser from the user agent. */
export const describeAgent = (ua: string) => {
  const s = ua.toLowerCase();
  const device = /ipad|tablet/.test(s) ? 'tablet' : /mobile|iphone|android/.test(s) ? 'mobile' : 'desktop';
  const browser = s.includes('edg/')
    ? 'Edge'
    : s.includes('chrome')
      ? 'Chrome'
      : s.includes('firefox')
        ? 'Firefox'
        : s.includes('safari')
          ? 'Safari'
          : ua
            ? 'Other'
            : 'Unknown';
  // iPhones also say "like Mac OS X", so check iOS first.
  const os = /iphone|ipad/.test(s) ? 'iOS' : /android/.test(s) ? 'Android' : /windows/.test(s) ? 'Windows'
    : /mac os|macintosh/.test(s) ? 'macOS' : /linux/.test(s) ? 'Linux' : '';
  return { device, browser, os };
};

export const toContractSession = (s: any, currentId?: string) => ({
  session_id: s.id,
  ...describeAgent(s.user_agent || ''),
  ip_address: (s.ip_address || '').replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1'),
  created_at: s.created_at,
  last_active: s.last_activity_at,
  expires_at: s.expires_at,
  current: s.id === currentId,
  impersonated_by: s.impersonator_name || null,
  ...(s.email ? { user: { customer_id: s.user_id, name: `${s.firstname} ${s.lastname}`.trim(), email: s.email, role: s.role } } : {}),
});

const ACTION_NAMES: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.login_failed': 'Failed sign-in',
  'auth.locked': 'Account locked after failed sign-ins',
  'auth.logout': 'Signed out',
  'auth.register': 'Created an account',
  'auth.password_reset': 'Reset password',
  'auth.account_setup': 'Set up account',
  'account.updated': 'Updated profile',
  'account.password_changed': 'Changed password',
  'account.session_revoked': 'Signed out a device',
  'admin.user_created': 'Added a user',
  'admin.user_updated': 'Updated a user',
  'admin.password_reset_sent': 'Sent a password reset email',
  'admin.user_unlocked': 'Unlocked an account',
  'admin.user_signed_out': 'Signed a user out everywhere',
  'admin.impersonation_started': 'Started acting as a customer',
  'admin.impersonation_ended': 'Stopped acting as a customer',
  'admin.security_settings_updated': 'Changed security settings',
  'admin.store_settings_updated': 'Changed store settings',
  'admin.session_revoked': 'Ended a sign-in session',
  'admin.role_created': 'Created a role',
  'admin.role_updated': 'Changed a role',
  'admin.role_deleted': 'Deleted a role',
  'auth.reset_requested': 'Asked for a password reset link',
  'catalog.product_created': 'Added a product',
  'catalog.product_updated': 'Edited a product',
  'catalog.product_deleted': 'Deleted a product',
  'catalog.category_created': 'Added a category',
  'catalog.category_updated': 'Edited a category',
  'catalog.category_deleted': 'Deleted a category',
  'catalog.brand_created': 'Added a brand',
  'catalog.brand_updated': 'Edited a brand',
  'catalog.brand_deleted': 'Deleted a brand',
  'catalog.file_uploaded': 'Uploaded an image',
  'order.placed': 'Placed an order',
  'order.status_changed': 'Changed an order’s status',
  'order.return_requested': 'Requested a return',
  'order.return_updated': 'Processed a return',
};

export const toContractActivity = (r: any) => ({
  activity_id: Number(r.id),
  action: r.action,
  description: ACTION_NAMES[r.action] || r.action.replace(/[._]/g, ' '),
  target: r.target,
  details: r.details,
  ip_address: (r.ip_address || '').replace(/^::ffff:/, ''),
  date_added: r.created_at,
  ...(r.email !== undefined ? { user: r.email ? { customer_id: r.user_id, name: `${r.firstname} ${r.lastname}`.trim(), email: r.email } : null } : {}),
  impersonated_by: r.impersonator_name || null,
});

const ACTIVITY_SELECT = `
  SELECT a.*, u.email, u.firstname, u.lastname,
         NULLIF(trim(i.firstname || ' ' || i.lastname), '') AS impersonator_name
  FROM audit_logs a
  LEFT JOIN users u ON u.id = a.user_id
  LEFT JOIN users i ON i.id = a.impersonator_id`;

export const adminSecurityRoutes = () => {
  const router = Router();
  router.use(['/users', '/security', '/audit'], authenticate);

  const loadTarget = async (id: number, actor: UserRow) => {
    const target = await findUserById(id);
    if (!target) fail(404, 'User not found.');
    if (isSuperAdmin(target!) && !isSuperAdmin(actor)) fail(403, 'Only a super admin can change another super admin.');
    return target!;
  };

  // ---------- act as a customer ----------
  router.post(
    '/users/:id/impersonate',
    requirePermission('admin.users.impersonate'),
    notWhileImpersonating('You’re already acting as a customer.'),
    handler(async (req, res) => {
      const target = await findUserById(Number(req.params.id));
      if (!target) fail(404, 'User not found.');
      if ((await permissionsForRole(target!.role_id)).length) {
        fail(403, 'You can only act as customers, not back-office accounts.');
      }
      if (target!.status !== 'active') fail(409, 'This customer is suspended. Reactivate them first.');
      const payload = await startImpersonation(req, res, target!);
      audit(req, 'admin.impersonation_started', `user:${target!.id}`, { minutes: IMPERSONATION_MINUTES });
      ok(res, { ...payload, expires_in_minutes: IMPERSONATION_MINUTES });
    })
  );

  // ---------- fix blocked accounts ----------
  router.post(
    '/users/:id/unlock',
    requirePermission('admin.users.unlock'),
    handler(async (req, res) => {
      const target = await loadTarget(Number(req.params.id), req.auth!.user);
      await query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = now() WHERE id = $1', [target.id]);
      audit(req, 'admin.user_unlocked', `user:${target.id}`);
      ok(res, { unlocked: true });
    })
  );

  router.post(
    '/users/:id/signout',
    requirePermission('admin.users.signout'),
    handler(async (req, res) => {
      const target = await loadTarget(Number(req.params.id), req.auth!.user);
      if (target.id === req.auth!.userId) fail(400, 'To sign yourself out of other devices, use your profile page.');
      const { rowCount } = await revokeAllSessions(target.id);
      audit(req, 'admin.user_signed_out', `user:${target.id}`, { sessions: rowCount });
      ok(res, { signed_out: rowCount });
    })
  );

  router.get(
    '/users/:id/activity',
    requirePermission('admin.users.view'),
    handler(async (req, res) => {
      const id = Number(req.params.id);
      if (!(await findUserById(id))) fail(404, 'User not found.');
      const rows = (
        await query(`${ACTIVITY_SELECT} WHERE a.user_id = $1 OR a.target = $2 ORDER BY a.created_at DESC LIMIT 100`, [
          id, `user:${id}`,
        ])
      ).rows;
      const sessions = (
        await query(
          `SELECT s.*, NULLIF(trim(i.firstname || ' ' || i.lastname), '') AS impersonator_name
           FROM sessions s LEFT JOIN users i ON i.id = s.impersonator_id
           WHERE s.user_id = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
           ORDER BY s.last_activity_at DESC`,
          [id]
        )
      ).rows;
      ok(res, { activity: rows.map(toContractActivity), sessions: sessions.map((s) => toContractSession(s)) });
    })
  );

  // ---------- audit log ----------
  router.get(
    '/audit',
    requirePermission('admin.audit.view'),
    handler(async (req, res) => {
      const q = parse(
        z.object({
          search: z.string().trim().max(100).optional(),
          action: z.string().trim().max(60).optional(),
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
          page: z.coerce.number().int().min(1).default(1),
        }),
        req.query
      );
      const params: unknown[] = [];
      const where: string[] = [];
      const bind = (v: unknown) => {
        params.push(v);
        return `$${params.length}`;
      };
      if (q.search) {
        const s = bind(`%${q.search}%`);
        where.push(`(u.email ILIKE ${s} OR (u.firstname || ' ' || u.lastname) ILIKE ${s} OR a.target ILIKE ${s})`);
      }
      if (q.action) where.push(`a.action LIKE ${bind(`${q.action}%`)}`);
      if (q.from) where.push(`a.created_at >= ${bind(q.from)}`);
      if (q.to) where.push(`a.created_at < ${bind(q.to)}::date + 1`);
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = (
        await query(`SELECT count(*)::int AS n FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ${whereSql}`, params)
      ).rows[0].n;
      const rows = (
        await query(
          `${ACTIVITY_SELECT} ${whereSql} ORDER BY a.created_at DESC, a.id DESC LIMIT ${bind(q.limit)} OFFSET ${bind((q.page - 1) * q.limit)}`,
          params
        )
      ).rows;
      res.set('X-Total-Count', String(total));
      ok(res, { total, activity: rows.map(toContractActivity), actions: ACTION_NAMES });
    })
  );

  // ---------- sign-in sessions across the shop ----------
  router.get(
    '/security/sessions',
    requirePermission('admin.security.view'),
    handler(async (req, res) => {
      const { staff } = parse(z.object({ staff: z.enum(['1', '0']).optional() }), req.query);
      const rows = (
        await query(
          `SELECT s.*, u.email, u.firstname, u.lastname, r.code AS role,
                  NULLIF(trim(i.firstname || ' ' || i.lastname), '') AS impersonator_name,
                  EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = u.role_id) AS staff
           FROM sessions s JOIN users u ON u.id = s.user_id JOIN roles r ON r.id = u.role_id
           LEFT JOIN users i ON i.id = s.impersonator_id
           WHERE s.revoked_at IS NULL AND s.expires_at > now()
           ORDER BY s.last_activity_at DESC LIMIT 500`
        )
      ).rows.filter((s) => (staff === undefined ? true : s.staff === (staff === '1')));
      const day = Date.now() - 24 * 3600000;
      ok(res, {
        stats: {
          active: rows.length,
          staff: rows.filter((s) => s.staff).length,
          customers: rows.filter((s) => !s.staff).length,
          active_today: rows.filter((s) => new Date(s.last_activity_at).getTime() > day).length,
        },
        sessions: rows.map((s) => ({ ...toContractSession(s, req.auth!.sessionId), staff: s.staff })),
      });
    })
  );

  router.delete(
    '/security/sessions/:id',
    requirePermission('admin.security.manage'),
    handler(async (req, res) => {
      const id = String(req.params.id);
      if (!/^[0-9a-f-]{36}$/i.test(id)) fail(404, 'Session not found.');
      if (id === req.auth!.sessionId) fail(400, 'That’s your current session. Use Sign out instead.');
      const { rowCount } = await revokeSession(id);
      if (!rowCount) fail(404, 'That session has already ended.');
      audit(req, 'admin.session_revoked', `session:${id}`);
      ok(res, { revoked: true });
    })
  );

  // ---------- security settings ----------
  router.get(
    '/security/settings',
    requirePermission('admin.security.view'),
    handler(async (_req, res) => {
      const row = (
        await query(
          `SELECT s.updated_at, u.firstname, u.lastname FROM security_settings s
           LEFT JOIN users u ON u.id = s.updated_by WHERE s.id = 1`
        )
      ).rows[0];
      ok(res, {
        settings: await getSettings(),
        updated_at: row?.updated_at ?? null,
        updated_by: row?.firstname ? `${row.firstname} ${row.lastname}`.trim() : null,
      });
    })
  );

  router.put(
    '/security/settings',
    requirePermission('admin.security.manage'),
    handler(async (req, res) => {
      const current = await getSettings();
      const body = req.body || {};
      // Each section may be sent on its own.
      const merged = parse(settingsSchema, {
        password: { ...current.password, ...body.password },
        lockout: { ...current.lockout, ...body.lockout },
        staff_sessions: { ...current.staff_sessions, ...body.staff_sessions },
        accounts: { ...current.accounts, ...body.accounts },
      });
      await saveSettings(merged, req.auth!.userId);
      audit(req, 'admin.security_settings_updated', 'security_settings', { sections: Object.keys(body) });
      ok(res, { settings: merged });
    })
  );

  // ---------- store settings (Pages settings) ----------
  router.get(
    '/store-settings',
    authenticate,
    requirePermission('admin.settings.manage'),
    handler(async (_req, res) => {
      const row = (
        await query(
          `SELECT s.updated_at, u.firstname, u.lastname FROM store_settings s
           LEFT JOIN users u ON u.id = s.updated_by WHERE s.id = 1`
        )
      ).rows[0];
      ok(res, {
        settings: await getStore(),
        updated_at: row?.updated_at ?? null,
        updated_by: row?.firstname ? `${row.firstname} ${row.lastname}`.trim() : null,
      });
    })
  );

  router.put(
    '/store-settings',
    authenticate,
    requirePermission('admin.settings.manage'),
    handler(async (req, res) => {
      const current = await getStore();
      const body = req.body || {};
      const merged = parse(storeSchema, { ...current, ...body, social: { ...current.social, ...(body.social || {}) } });
      await saveStore(merged, req.auth!.userId);
      audit(req, 'admin.store_settings_updated', 'store_settings', { fields: Object.keys(body) });
      ok(res, { settings: merged });
    })
  );

  return router;
};
