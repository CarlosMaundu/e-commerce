// src/routes/account.ts — the signed-in user's own profile and password.
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { hashPassword, passwordSchema, verifyPassword } from '../lib/security';
import { revokeAllSessions } from '../lib/sessions';
import { findUserById, toContractUser } from '../lib/users';
import { authenticate } from '../middleware/auth';

export const accountRoutes = () => {
  const router = Router();
  router.use(authenticate);

  router.get(
    '/',
    handler(async (req, res) => {
      ok(res, toContractUser(req.auth!.user, req.auth!.permissions));
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
        }),
        req.body
      );
      await query(
        `UPDATE users SET
           firstname = COALESCE($2, firstname),
           lastname  = COALESCE($3, lastname),
           avatar    = COALESCE($4, avatar),
           updated_at = now()
         WHERE id = $1`,
        [req.auth!.userId, body.firstname ?? null, body.lastname ?? null, body.avatar ?? null]
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

  return router;
};
