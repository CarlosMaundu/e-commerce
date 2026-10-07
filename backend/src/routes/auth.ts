// src/routes/auth.ts — sign-up, sign-in (password and Google), sessions,
// password reset. Mounted at /api/rest (OpenCart route names).
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config';
import { query, transaction } from '../db';
import { audit } from '../lib/audit';
import { GoogleVerifier } from '../lib/google';
import { fail, handler, ok, parse } from '../lib/http';
import { sendPasswordResetEmail, sendVerificationEmail } from '../lib/mailer';
import { hashPassword, passwordSchema, randomToken, sha256, verifyPassword } from '../lib/security';
import { enforcePasswordPolicy, getSettings } from '../lib/settings';
import {
  clearRefreshCookie,
  findSessionByRefresh,
  REFRESH_COOKIE,
  revokeAllSessions,
  revokeSession,
  rotateSession,
  startSession,
} from '../lib/sessions';
import { findUserByEmail, findUserById, permissionsForRole, roleIdFor, toContractUser } from '../lib/users';
import { authenticate, requireAjaxHeader } from '../middleware/auth';

const WRONG_CREDENTIALS = 'The email or password is incorrect. Please try again.';
const SUSPENDED = 'This account has been suspended. Please contact support.';
const BAD_LINK = 'This link is invalid or has expired. Please request a new one.';
const REGISTRATION_CLOSED = 'We’re not taking new accounts right now. Please contact us if you need help.';

const email = z
  .string({ required_error: 'Please enter your email address.' })
  .trim()
  .toLowerCase()
  .email('Please enter a valid email address.');

const limiter = (max: number, message: string) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ success: 0, error: [message], data: {} }),
    skip: () => process.env.NODE_ENV === 'test',
  });

const loginLimiter = limiter(30, 'Too many sign-in attempts. Please wait a few minutes and try again.');
const emailLimiter = limiter(10, 'Too many requests. Please wait a few minutes and try again.');

/** Creates a single-use emailed token and returns the raw value. */
export const issueEmailToken = async (userId: number, purpose: 'reset' | 'setup' | 'verify') => {
  const token = randomToken();
  const minutes = purpose === 'reset' ? config.resetTokenMinutes : purpose === 'verify' ? 24 * 60 : config.setupTokenHours * 60;
  await query(
    `UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
    [userId, purpose]
  );
  await query(
    `INSERT INTO auth_tokens (user_id, token_hash, purpose, expires_at)
     VALUES ($1, $2, $3, now() + ($4 || ' minutes')::interval)`,
    [userId, sha256(token), purpose, String(minutes)]
  );
  return token;
};

export const resetLink = (token: string) =>
  `${config.frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;

const verifyLink = (token: string) =>
  `${config.frontendUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;

/** Emails a fresh "confirm your email" link. */
const sendVerification = async (user: { id: number; email: string; firstname: string }) => {
  const token = await issueEmailToken(user.id, 'verify');
  await sendVerificationEmail(user.email, user.firstname, verifyLink(token));
};

export const UNVERIFIED = 'Please confirm your email address first. We’ve sent you a new link; it expires in 24 hours.';

const findValidToken = async (token: string) =>
  (
    await query<{ id: number; user_id: number; purpose: string }>(
      `SELECT id, user_id, purpose FROM auth_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [sha256(token)]
    )
  ).rows[0];

export const authRoutes = ({ verifyGoogle }: { verifyGoogle: GoogleVerifier | null }) => {
  const router = Router();

  router.post(
    '/register',
    loginLimiter,
    handler(async (req, res) => {
      const body = parse(
        z.object({
          firstname: z.string().trim().min(1, 'Please enter your first name.').max(100),
          lastname: z.string().trim().min(1, 'Please enter your last name.').max(100),
          email,
          password: passwordSchema,
        }),
        req.body
      );
      if (!(await getSettings()).accounts.allow_registration) fail(403, REGISTRATION_CLOSED);
      if (await findUserByEmail(body.email)) {
        fail(409, 'An account with this email already exists. Please sign in instead.');
      }
      await enforcePasswordPolicy(body.password);
      const roleId = await roleIdFor('customer');
      const { rows } = await query<{ id: number }>(
        `INSERT INTO users (email, password_hash, firstname, lastname, role_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [body.email, await hashPassword(body.password), body.firstname, body.lastname, roleId]
      );
      const user = await findUserById(rows[0].id);
      audit(req, 'auth.register', `user:${user.id}`, {}, user.id);
      // When the shop requires it, the account works once the email is confirmed.
      if ((await getSettings()).accounts.require_email_verification) {
        await sendVerification(user);
        return ok(res, { verification_required: true, email: user.email }, 201);
      }
      ok(res, await startSession(req, res, user), 201);
    })
  );

  router.post(
    '/login',
    loginLimiter,
    handler(async (req, res) => {
      const body = parse(
        z.object({
          email,
          password: z.string({ required_error: 'Please enter your password.' }).min(1, 'Please enter your password.'),
          remember_me: z.boolean().optional(),
        }),
        req.body
      );
      const user = await findUserByEmail(body.email);
      if (user?.locked_until && user.locked_until > new Date()) {
        const minutes = Math.ceil((user.locked_until.getTime() - Date.now()) / 60000);
        fail(423, `Too many failed attempts. Please wait ${minutes} minute${minutes === 1 ? '' : 's'} or reset your password.`);
      }
      if (!user || !(await verifyPassword(body.password, user.password_hash))) {
        if (user) {
          const { lockout } = await getSettings();
          const attempts = user.failed_login_attempts + 1;
          const lock = attempts >= lockout.max_attempts;
          await query(
            `UPDATE users SET failed_login_attempts = $2,
               locked_until = CASE WHEN $3 THEN now() + ($4 || ' minutes')::interval ELSE NULL END
             WHERE id = $1`,
            [user.id, lock ? 0 : attempts, lock, String(lockout.minutes)]
          );
          audit(req, lock ? 'auth.locked' : 'auth.login_failed', `user:${user.id}`, {}, user.id);
        }
        fail(401, WRONG_CREDENTIALS);
      }
      if (user!.status !== 'active') fail(403, SUSPENDED);
      if (!user!.email_verified_at && (await getSettings()).accounts.require_email_verification) {
        await sendVerification(user!);
        audit(req, 'auth.login_unverified', `user:${user!.id}`, {}, user!.id);
        fail(403, UNVERIFIED);
      }
      audit(req, 'auth.login', `user:${user!.id}`, { method: 'password' }, user!.id);
      ok(res, await startSession(req, res, user!, { rememberMe: body.remember_me }));
    })
  );

  // OpenCart's /sociallogin, with a Google ID token instead of an access token.
  router.post(
    '/sociallogin',
    loginLimiter,
    handler(async (req, res) => {
      const body = parse(
        z.object({
          provider: z.literal('google', { errorMap: () => ({ message: 'Only Google sign-in is supported.' }) }),
          id_token: z.string().min(1, 'Google sign-in didn’t complete. Please try again.'),
        }),
        req.body
      );
      if (!verifyGoogle) fail(503, 'Google sign-in isn’t available right now.');
      let identity;
      try {
        identity = await verifyGoogle!(body.id_token);
      } catch {
        fail(401, 'Google sign-in didn’t complete. Please try again.');
      }
      if (!identity!.emailVerified) {
        fail(401, 'Your Google email address isn’t verified. Please verify it with Google and try again.');
      }
      const user = await transaction(async (client) => {
        const bySub = (await client.query('SELECT id FROM users WHERE google_sub = $1', [identity!.sub])).rows[0];
        if (bySub) return bySub.id as number;
        const byEmail = (
          await client.query('SELECT id FROM users WHERE lower(email) = lower($1)', [identity!.email])
        ).rows[0];
        if (byEmail) {
          // Same verified email: link Google to the existing account.
          await client.query(
            'UPDATE users SET google_sub = $1, email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $2',
            [identity!.sub, byEmail.id]
          );
          return byEmail.id as number;
        }
        if (!(await getSettings()).accounts.allow_registration) fail(403, REGISTRATION_CLOSED);
        const roleId = (await client.query("SELECT id FROM roles WHERE code = 'customer'")).rows[0].id;
        const created = await client.query(
          `INSERT INTO users (email, google_sub, firstname, lastname, avatar, role_id, email_verified_at)
           VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING id`,
          [identity!.email.toLowerCase(), identity!.sub, identity!.givenName, identity!.familyName, identity!.picture, roleId]
        );
        return created.rows[0].id as number;
      }).then(findUserById);
      if (user.status !== 'active') fail(403, SUSPENDED);
      audit(req, 'auth.login', `user:${user.id}`, { method: 'google' }, user.id);
      ok(res, await startSession(req, res, user));
    })
  );

  router.post(
    '/refresh',
    requireAjaxHeader,
    handler(async (req, res) => {
      const token = req.cookies?.[REFRESH_COOKIE];
      const session = token && (await findSessionByRefresh(token));
      if (!session) {
        clearRefreshCookie(res);
        fail(401, 'Please sign in to continue.');
      }
      const user = await findUserById(session.user_id);
      if (!user || user.status !== 'active') {
        await revokeSession(session.id);
        clearRefreshCookie(res);
        fail(user ? 403 : 401, user ? SUSPENDED : 'Please sign in to continue.');
      }
      // Back-office sessions end after a period without activity.
      if (!session.impersonator_id && (await permissionsForRole(user.role_id)).length) {
        const { staff_sessions: limits } = await getSettings();
        if (Date.now() - new Date(session.last_activity_at).getTime() > limits.idle_minutes * 60000) {
          await revokeSession(session.id);
          clearRefreshCookie(res);
          fail(401, `You were signed out after ${limits.idle_minutes} minutes without activity. Please sign in again.`);
        }
      }
      ok(res, await rotateSession(res, token, user, session.id, session.expires_at));
    })
  );

  // Ends "acting as a customer" and returns to the staff member's own session.
  router.post(
    '/impersonation/stop',
    authenticate,
    handler(async (req, res) => {
      const { impersonatorId, parentSessionId, sessionId, userId } = req.auth!;
      if (!impersonatorId) fail(400, 'You’re not acting as a customer.');
      await revokeSession(sessionId);
      audit(req, 'admin.impersonation_ended', `user:${userId}`, {}, impersonatorId);
      const parent = parentSessionId
        ? (
            await query(
              `SELECT id, expires_at FROM sessions
               WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()`,
              [parentSessionId, impersonatorId]
            )
          ).rows[0]
        : null;
      const staff = await findUserById(impersonatorId!);
      if (!parent || !staff || staff.status !== 'active') {
        clearRefreshCookie(res);
        return ok(res, { restored: false });
      }
      ok(res, { restored: true, ...(await rotateSession(res, '', staff, parent.id, parent.expires_at)) });
    })
  );

  router.post(
    '/logout',
    requireAjaxHeader,
    handler(async (req, res) => {
      const token = req.cookies?.[REFRESH_COOKIE];
      const session = token && (await findSessionByRefresh(token));
      if (session) {
        await revokeSession(session.id);
        audit(req, 'auth.logout', `user:${session.user_id}`, {}, session.user_id);
      }
      clearRefreshCookie(res);
      ok(res, { signed_out: true });
    })
  );

  router.post(
    '/forgotten',
    emailLimiter,
    handler(async (req, res) => {
      const body = parse(z.object({ email }), req.body);
      const user = await findUserByEmail(body.email);
      if (user && user.status === 'active') {
        const token = await issueEmailToken(user.id, 'reset');
        await sendPasswordResetEmail(user.email, resetLink(token));
        audit(req, 'auth.reset_requested', `user:${user.id}`, {}, user.id);
      }
      // Same answer either way, so this can't be used to find accounts.
      ok(res, { sent: true });
    })
  );

  // Confirms an email address from the emailed link.
  router.post(
    '/verify-email',
    emailLimiter,
    handler(async (req, res) => {
      const body = parse(z.object({ token: z.string().min(1, BAD_LINK) }), req.body);
      const row = await findValidToken(body.token);
      if (!row || row.purpose !== 'verify') fail(400, BAD_LINK);
      await query('UPDATE auth_tokens SET used_at = now() WHERE id = $1', [row.id]);
      await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [row.user_id]);
      audit(req, 'auth.email_verified', `user:${row.user_id}`, {}, row.user_id);
      const user = await findUserById(row.user_id);
      ok(res, { verified: true, email: user.email });
    })
  );

  router.post(
    '/verify-email/resend',
    emailLimiter,
    handler(async (req, res) => {
      const body = parse(z.object({ email }), req.body);
      const user = await findUserByEmail(body.email);
      if (user && user.status === 'active' && !user.email_verified_at) await sendVerification(user);
      // Same answer either way, so this can't be used to find accounts.
      ok(res, { sent: true });
    })
  );

  // Lets the reset page say up front whether a link still works.
  router.get(
    '/reset-password',
    handler(async (req, res) => {
      const token = String(req.query.token || '');
      const row = token ? await findValidToken(token) : undefined;
      if (!row) return fail(400, BAD_LINK);
      const user = await findUserById(row.user_id);
      ok(res, { valid: true, purpose: row.purpose, email: user.email });
    })
  );

  router.post(
    '/reset-password',
    emailLimiter,
    handler(async (req, res) => {
      const body = parse(
        z.object({ token: z.string().min(1, BAD_LINK), password: passwordSchema }),
        req.body
      );
      const row = await findValidToken(body.token);
      if (!row) fail(400, BAD_LINK);
      await enforcePasswordPolicy(body.password);
      await query('UPDATE auth_tokens SET used_at = now() WHERE id = $1', [row.id]);
      await query(
        `UPDATE users SET password_hash = $2, failed_login_attempts = 0, locked_until = NULL, updated_at = now(),
           email_verified_at = COALESCE(email_verified_at, now())
         WHERE id = $1`,
        [row.user_id, await hashPassword(body.password)]
      );
      await revokeAllSessions(row.user_id);
      audit(req, row.purpose === 'setup' ? 'auth.account_setup' : 'auth.password_reset', `user:${row.user_id}`, {}, row.user_id);
      const user = await findUserById(row.user_id);
      ok(res, { reset: true, user: toContractUser(user) });
    })
  );

  return router;
};
