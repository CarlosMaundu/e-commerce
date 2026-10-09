// src/middleware/auth.ts
//
// authenticate: requires a valid access token whose session is still active
// (so revoking a session or suspending a user takes effect immediately).
// requirePermission: RBAC check, as in the portal's requirePermission().
import { getSettings, idleMessage } from '../lib/settings';
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
  /** Set when a staff member is acting as this customer. */
  impersonatorId: number | null;
  parentSessionId: string | null;
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
      `SELECT id, impersonator_id, parent_session_id, last_activity_at FROM sessions
       WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [claims.sid]
    )
  ).rows[0];
  if (!session) throw new HttpError(401, ['Your session has expired. Please sign in again.']);
  const user = await findUserById(claims.sub);
  if (!user) throw new HttpError(401, ['Your session has expired. Please sign in again.']);
  if (user.status !== 'active') {
    throw new HttpError(403, ['This account has been suspended. Please contact support.']);
  }
  const permissions = await permissionsForRole(user.role_id);
  // Back-office sessions end after the idle timeout on any request, not
  // only when the session is refreshed.
  if (permissions.length && !session.impersonator_id) {
    const { staff_sessions: limits } = await getSettings();
    if (Date.now() - new Date(session.last_activity_at).getTime() > limits.idle_minutes * 60000) {
      await query('UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [claims.sid]);
      throw new HttpError(401, [idleMessage(limits.idle_minutes)]);
    }
  }
  // Background polling (the notification bell) isn't activity.
  if (!req.headers['x-background']) {
    query('UPDATE sessions SET last_activity_at = now() WHERE id = $1', [claims.sid]).catch(() => {});
  }
  return {
    userId: user.id,
    sessionId: claims.sid,
    user,
    permissions,
    impersonatorId: session.impersonator_id ?? null,
    parentSessionId: session.parent_session_id ?? null,
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
 * Shopping is for customers. Back-office accounts (any permission) are turned
 * away unless a staff member is acting as a customer.
 */
export const customersOnly = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth) return next(new HttpError(401, ['Please sign in to continue.']));
  if (req.auth.permissions.length && !req.auth.impersonatorId) {
    return next(new HttpError(403, [
      'Back-office accounts can’t shop. To help a customer, open them in Users and choose “View as customer”.',
    ]));
  }
  next();
};

/** Some things only the real account holder may do. */
export const notWhileImpersonating = (message: string) => (req: Request, _res: Response, next: NextFunction) => {
  if (req.auth?.impersonatorId) return next(new HttpError(403, [message]));
  next();
};

/** Passes when the user has at least one of the permissions. */
export const requireAnyPermission =
  (...permissions: string[]) => (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new HttpError(401, ['Please sign in to continue.']));
    if (!permissions.some((p) => hasPermission(req.auth!.permissions, p))) {
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
