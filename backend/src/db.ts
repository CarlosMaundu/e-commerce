// src/db.ts
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { config } from './config';

// Every connection works in the shop's time zone, so current_date, day
// buckets and ::date conversions all mean the shop's day.
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  options: `-c timezone=${config.shopTimezone}`,
});

export const query = <T extends QueryResultRow = any>(text: string, params: unknown[] = []) =>
  pool.query<T>(text, params);

/** Runs `fn` inside a transaction, rolling back on error. */
export const transaction = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
