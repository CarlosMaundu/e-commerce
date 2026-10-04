// src/routes/account.ts — the signed-in user's own profile and password.
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { hashPassword, passwordSchema, verifyPassword } from '../lib/security';
import { impersonatorOf, revokeAllSessions } from '../lib/sessions';
import { enforcePasswordPolicy } from '../lib/settings';
import { findUserById, toContractUser } from '../lib/users';
import { singleImage, uploadedUrl } from '../lib/uploads';
import { authenticate, notWhileImpersonating } from '../middleware/auth';
import { toContractActivity, toContractSession } from './adminSecurity';

export const accountRoutes = () => {
  const router = Router();
  router.use(authenticate);

  router.get(
    '/',
    handler(async (req, res) => {
      ok(res, {
        ...toContractUser(req.auth!.user, req.auth!.permissions),
        impersonator: await impersonatorOf(req.auth!.sessionId),
      });
    })
  );

  router.put(
    '/',
    handler(async (req, res) => {
      const body = parse(
        z.object({
          firstname: z.string().trim().min(1, 'Please enter your first name.').max(100).optional(),
          lastname: z.string().trim().max(100).optional(),
          avatar: z.string().trim().max(2000).optional(),
          telephone: z
            .string()
            .trim()
            .max(30)
            .regex(/^[+0-9 ()-]*$/, 'Please enter a phone number using digits, spaces and +.')
            .optional(),
        }),
        req.body
      );
      await query(
        `UPDATE users SET
           firstname = COALESCE($2, firstname),
           lastname  = COALESCE($3, lastname),
           avatar    = COALESCE($4, avatar),
           phone     = COALESCE($5, phone),
           updated_at = now()
         WHERE id = $1`,
        [req.auth!.userId, body.firstname ?? null, body.lastname ?? null, body.avatar ?? null, body.telephone ?? null]
      );
      const user = await findUserById(req.auth!.userId);
      ok(res, toContractUser(user, req.auth!.permissions));
    })
  );

  // OpenCart: PUT /account/password. We also require the current password.
  router.put(
    '/password',
    handler(async (req, res) => {
      const body = parse(
        z.object({
          current_password: z.string().optional(),
          password: passwordSchema,
        }),
        req.body
      );
      const user = req.auth!.user;
      if (req.auth!.impersonatorId) fail(403, 'Passwords can’t be changed while acting as a customer.');
      if (!user.password_hash) {
        fail(
          400,
          'You sign in with Google, so there’s no password to change. Use “Forgot password” on the sign-in page to add one.'
        );
      }
      if (!body.current_password) fail(400, 'Enter your current password to set a new one.');
      if (!(await verifyPassword(body.current_password!, user.password_hash))) {
        fail(400, 'Your current password is incorrect.');
      }
      await enforcePasswordPolicy(body.password);
      await query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [
        user.id,
        await hashPassword(body.password),
      ]);
      // Sign out every other device; keep this one signed in.
      await revokeAllSessions(user.id, req.auth!.sessionId);
      audit(req, 'account.password_changed', `user:${user.id}`);
      ok(res, { changed: true });
    })
  );

  // ---------- avatar ----------
  router.post(
    '/avatar',
    singleImage,
    handler(async (req, res) => {
      if (!req.file) fail(400, 'Please choose a photo to upload.');
      const url = uploadedUrl(req.file!);
      await query('UPDATE users SET avatar = $2, updated_at = now() WHERE id = $1', [req.auth!.userId, url]);
      audit(req, 'account.updated', `user:${req.auth!.userId}`, { fields: ['avatar'] });
      ok(res, toContractUser(await findUserById(req.auth!.userId), req.auth!.permissions), 201);
    })
  );

  // ---------- where you're signed in ----------
  const noImpersonation = notWhileImpersonating('Sign-in sessions can only be managed by the account holder.');

  router.get(
    '/sessions',
    noImpersonation,
    handler(async (req, res) => {
      const rows = (
        await query(
          `SELECT s.*, NULLIF(trim(i.firstname || ' ' || i.lastname), '') AS impersonator_name
           FROM sessions s LEFT JOIN users i ON i.id = s.impersonator_id
           WHERE s.user_id = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
           ORDER BY (s.id = $2) DESC, s.last_activity_at DESC`,
          [req.auth!.userId, req.auth!.sessionId]
        )
      ).rows;
      ok(res, rows.map((s) => toContractSession(s, req.auth!.sessionId)));
    })
  );

  router.delete(
    '/sessions/:id',
    noImpersonation,
    handler(async (req, res) => {
      const id = String(req.params.id);
      if (id === req.auth!.sessionId) fail(400, 'That’s this device. Use Sign out instead.');
      const { rowCount } = await query(
        `UPDATE sessions SET revoked_at = now() WHERE id::text = $1 AND user_id = $2 AND revoked_at IS NULL`,
        [id, req.auth!.userId]
      );
      if (!rowCount) fail(404, 'That session has already ended.');
      audit(req, 'account.session_revoked', `session:${id}`);
      ok(res, { revoked: true });
    })
  );

  router.delete(
    '/sessions',
    noImpersonation,
    handler(async (req, res) => {
      const { rowCount } = await revokeAllSessions(req.auth!.userId, req.auth!.sessionId);
      audit(req, 'account.session_revoked', 'all-other-devices', { sessions: rowCount });
      ok(res, { revoked: rowCount });
    })
  );

  router.get(
    '/activity',
    handler(async (req, res) => {
      const rows = (
        await query(
          `SELECT a.*, NULLIF(trim(i.firstname || ' ' || i.lastname), '') AS impersonator_name
           FROM audit_logs a LEFT JOIN users i ON i.id = a.impersonator_id
           WHERE a.user_id = $1 ORDER BY a.created_at DESC LIMIT 50`,
          [req.auth!.userId]
        )
      ).rows;
      ok(res, rows.map(toContractActivity));
    })
  );

  return router;
};
