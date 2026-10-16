// src/lib/rateLimitStore.ts — an express-rate-limit store backed by Postgres:
// one row per limiter and client, counting hits until the window resets.
// Shared by every API server, so limits hold however many servers run.
import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import { query } from '../db';

export class PgStore implements Store {
  prefix: string;
  localKeys = false;
  private windowMs = 60 * 1000;

  constructor(prefix: string) {
    this.prefix = `${prefix}:`;
  }

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    // A new window starts when the old one has ended.
    const row = (await query(
      `INSERT INTO rate_limits (key, hits, reset_at) VALUES ($1, 1, now() + make_interval(secs => $2))
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.hits + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
       RETURNING hits, reset_at`,
      [this.prefix + key, this.windowMs / 1000]
    )).rows[0];
    return { totalHits: row.hits, resetTime: new Date(row.reset_at) };
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const row = (await query('SELECT hits, reset_at FROM rate_limits WHERE key = $1 AND reset_at > now()', [
      this.prefix + key,
    ])).rows[0];
    return row ? { totalHits: row.hits, resetTime: new Date(row.reset_at) } : undefined;
  }

  async decrement(key: string) {
    await query('UPDATE rate_limits SET hits = GREATEST(hits - 1, 0) WHERE key = $1', [this.prefix + key]);
  }

  async resetKey(key: string) {
    await query('DELETE FROM rate_limits WHERE key = $1', [this.prefix + key]);
  }
}
