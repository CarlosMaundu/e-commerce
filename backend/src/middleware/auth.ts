// src/middleware/auth.ts
//
// authenticate: requires a valid access token whose session is still active
// (so revoking a session or suspending a user takes effect immediately).
// requirePermission: RBAC check, as in the portal's requirePermission().
import { NextFunction, Request, Response } from 'express';
import { query } from '../db';
import { fail, HttpError } from '../lib/http';
import { verifyAccessToken } from '../lib/security';
import { findUserById, hasPermission, permissionsForRole, UserRow } from '../lib/users';

export interface AuthContext {
  userId: number;
  sessionId: string;
  user: UserRow;
  permissions: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const resolve = async (req: Request): Promise<AuthContext | null> => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  let claims;
  try {
    claims = verifyAccessToken(header.slice(7));
  } catch {
    throw new HttpError(401, ['Your session has expired. Please sign in again.']);
  }
  const session = (
    await query(
      'SELECT id FROM sessions WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()',
      [claims.sid]
    )
  ).rows[0];
  if (!session) throw new HttpError(401, ['Your session has expired. Please sign in again.']);
  const user = await findUserById(claims.sub);
  if (!user) throw new HttpError(401, ['Your session has expired. Please sign in again.']);
  if (user.status !== 'active') {
    throw new HttpError(403, ['This account has been suspended. Please contact support.']);
  }
  query('UPDATE sessions SET last_activity_at = now() WHERE id = $1', [claims.sid]).catch(() => {});
  return {
    userId: user.id,
    sessionId: claims.sid,
    user,
    permissions: await permissionsForRole(user.role_id),
  };
};

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  resolve(req)
    .then((auth) => {
      if (!auth) fail(401, 'Please sign in to continue.');
      req.auth = auth!;
      next();
    })
    .catch(next);
};

/** Attaches req.auth when a token is present; guests pass through. */
export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  resolve(req)
    .then((auth) => {
      if (auth) req.auth = auth;
      next();
    })
    .catch(next);
};

export const requirePermission =
  (permission: string) => (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new HttpError(401, ['Please sign in to continue.']));
    if (!hasPermission(req.auth.permissions, permission)) {
      return next(new HttpError(403, ['You don’t have permission to do that.']));
    }
    next();
  };

/**
 * Cookie-authenticated endpoints (refresh, logout) also require a custom
 * header. Browsers can't add one cross-site without a CORS preflight, which
 * our CORS policy refuses for unknown origins — a cheap CSRF guard.
 */
export const requireAjaxHeader = (req: Request, _res: Response, next: NextFunction) => {
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return next(new HttpError(403, ['This request was blocked for your security.']));
  }
  next();
};
