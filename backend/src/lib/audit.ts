// src/lib/audit.ts — who did what, for the admin audit log (phase 4 viewer).
import { Request } from 'express';
import { query } from '../db';

export const audit = (
  req: Request,
  action: string,
  target = '',
  details: Record<string, unknown> = {},
  userId: number | null = req.auth?.userId ?? null
) =>
  query(
    'INSERT INTO audit_logs (user_id, action, target, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
    [userId, action, target, JSON.stringify(details), String(req.ip || '')]
  ).catch((error) => console.error('Audit log failed:', error));
