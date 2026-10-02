// src/lib/http.ts — the OpenCart response envelope and typed HTTP errors.
import { Response, Request, NextFunction, RequestHandler } from 'express';
import { z, ZodError, ZodTypeAny } from 'zod';

/** Error whose messages are safe to show to users. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public messages: string[],
    public fieldErrors: Record<string, string> = {}
  ) {
    super(messages[0]);
  }
}

export const fail = (status: number, ...messages: string[]): never => {
  throw new HttpError(status, messages);
};

export const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: 1, error: [], data });

/** Wraps async handlers so rejected promises reach the error handler. */
export const handler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/** Parses a request body with zod, turning issues into a friendly 400. */
export const parse = <S extends ZodTypeAny>(schema: S, input: unknown): z.output<S> => {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      const messages: string[] = [];
      for (const issue of error.issues) {
        const field = issue.path.join('.');
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
        if (!messages.includes(issue.message)) messages.push(issue.message);
      }
      throw new HttpError(400, messages, fieldErrors);
    }
    throw error;
  }
};

export const errorHandler = (error: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({
      success: 0,
      error: error.messages,
      field_errors: error.fieldErrors,
      data: {},
    });
    return;
  }
  // Body too large / malformed JSON from express itself.
  const status = (error as { status?: number }).status;
  if (status === 400 || status === 413) {
    res.status(status).json({
      success: 0,
      error: [status === 413 ? 'That request is too large.' : 'The request could not be read.'],
      data: {},
    });
    return;
  }
  console.error(`[${req.method} ${req.path}]`, error);
  res.status(500).json({
    success: 0,
    error: ['Something went wrong on our side. Please try again.'],
    data: {},
  });
};
