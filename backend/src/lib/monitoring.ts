// src/lib/monitoring.ts — what the API tells its operators: one JSON line per
// request (with a request id, also sent back as X-Request-Id), errors with
// that id, and, when SENTRY_DSN is set, unexpected errors reported to Sentry.
import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import * as Sentry from '@sentry/node';

const sentryOn = Boolean(process.env.SENTRY_DSN);
if (sentryOn) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0,
  });
}

declare module 'express-serve-static-core' {
  interface Request {
    id?: string;
  }
}

const quiet = process.env.NODE_ENV === 'test' || process.env.LOG_REQUESTS === 'false';

/** Gives each request an id and logs it as one JSON line when it finishes. */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const incoming = req.get('x-request-id');
  req.id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (quiet || req.path === '/api/health') return;
    console.log(
      JSON.stringify({
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        time: new Date().toISOString(),
        id: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Number((process.hrtime.bigint() - start) / 1000000n),
        user: req.auth?.userId ?? null,
      })
    );
  });
  next();
};

/** An unexpected error: logged with the request id, and sent to Sentry. */
export const reportError = (error: unknown, req: Request) => {
  console.error(
    JSON.stringify({
      level: 'error',
      time: new Date().toISOString(),
      id: req.id,
      method: req.method,
      path: req.path,
      message: (error as Error)?.message || String(error),
      stack: (error as Error)?.stack,
    })
  );
  if (sentryOn) {
    Sentry.withScope((scope) => {
      scope.setTag('request_id', req.id || '');
      scope.setContext('request', { method: req.method, path: req.path });
      if (req.auth?.userId) scope.setUser({ id: String(req.auth.userId) });
      Sentry.captureException(error);
    });
  }
};
