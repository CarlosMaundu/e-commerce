// src/lib/sessions.ts
//
// Access token: short-lived JWT returned in the response body; the browser
// keeps it in memory only. Refresh token: random value in an httpOnly cookie
// scoped to /api/rest, stored hashed and rotated on every refresh.
import { Request, Response } from 'express';
import { config } from '../config';
import { query } from '../db';
import { randomToken, sha256, signAccessToken } from './security';
import { permissionsForRole, toContractUser, UserRow } from './users';

export const REFRESH_COOKIE = 'cs_refresh';
const COOKIE_PATH = '/api/rest';

const clientInfo = (req: Request) => ({
  userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
  ip: String(req.ip || ''),
});

const setRefreshCookie = (res: Response, token: string, expires: Date) =>
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: COOKIE_PATH,
    expires,
  });

export const clearRefreshCookie = (res: Response) =>
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: COOKIE_PATH,
  });

/** Response body for every successful sign-in or refresh. */
const sessionPayload = async (user: UserRow, sessionId: string) => {
  const permissions = await permissionsForRole(user.role_id);
  return {
    access_token: signAccessToken({ sub: String(user.id), sid: sessionId }),
    expires_in: config.accessTokenMinutes * 60,
    user: toContractUser(user, permissions),
  };
};

export const startSession = async (
  req: Request,
  res: Response,
  user: UserRow,
  { rememberMe = false } = {}
) => {
  const refreshToken = randomToken();
  const days = rememberMe ? config.rememberMeDays : config.sessionDays;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const { userAgent, ip } = clientInfo(req);
  const { rows } = await query<{ id: string }>(
    `INSERT INTO sessions (user_id, refresh_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [user.id, sha256(refreshToken), userAgent, ip, expires]
  );
  await query(
    'UPDATE users SET last_login_at = now(), failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
    [user.id]
  );
  setRefreshCookie(res, refreshToken, expires);
  return sessionPayload(user, rows[0].id);
};

/** Swaps a valid refresh cookie for a new access token and refresh cookie. */
export const rotateSession = async (res: Response, refreshToken: string, user: UserRow, sessionId: string, expires: Date) => {
  const next = randomToken();
  await query(
    'UPDATE sessions SET refresh_hash = $1, last_activity_at = now() WHERE id = $2',
    [sha256(next), sessionId]
  );
  setRefreshCookie(res, next, expires);
  return sessionPayload(user, sessionId);
};

export const findSessionByRefresh = async (refreshToken: string) =>
  (
    await query<{ id: string; user_id: number; expires_at: Date }>(
      `SELECT id, user_id, expires_at FROM sessions
       WHERE refresh_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [sha256(refreshToken)]
    )
  ).rows[0];

export const revokeSession = (sessionId: string) =>
  query('UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [sessionId]);

export const revokeAllSessions = (userId: number, exceptSessionId?: string) =>
  query(
    `UPDATE sessions SET revoked_at = now()
     WHERE user_id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR id <> $2::uuid)`,
    [userId, exceptSessionId ?? null]
  );
