// src/lib/changes.ts — keeps settings the same on every API server. Settings
// are cached in each server's memory; when one server saves them it announces
// the change through Postgres (NOTIFY), and every server (itself included)
// reloads that part. One server or several, the shop behaves the same.
import { pool, query } from '../db';
import { loadDelivery } from './delivery';
import { loadFinance } from './finance';
import { loadProviders } from './paymentProviders';
import { clearSettingsCache } from './settings';
import { loadSla } from './sla';

const CHANNEL = 'settings_changed';
export type SettingsKind = 'finance' | 'delivery' | 'sla' | 'payments' | 'security';

const RELOAD: Record<SettingsKind, () => unknown> = {
  finance: loadFinance,
  delivery: loadDelivery,
  sla: loadSla,
  payments: loadProviders,
  security: clearSettingsCache,
};

/** Tells every API server that `kind` settings changed. */
export const announce = (kind: SettingsKind) =>
  query('SELECT pg_notify($1, $2)', [CHANNEL, kind]).catch((error) =>
    console.error('Settings change notice failed:', error)
  );

/**
 * Listens for changes from other servers; reconnects if the connection
 * drops. Returns a function that stops listening (tests, shutdown).
 */
export const listenForChanges = async () => {
  let client: import('pg').PoolClient | null = null;
  let stopped = false;
  const connect = async (): Promise<void> => {
    if (stopped) return;
    try {
      client = await pool.connect();
      client.on('notification', (msg) => {
        const reload = RELOAD[msg.payload as SettingsKind];
        if (reload) Promise.resolve(reload()).catch((e) => console.error(`Reloading ${msg.payload} failed:`, e));
      });
      client.on('error', () => {
        client?.release(true);
        client = null;
        setTimeout(connect, 5000);
      });
      await client.query(`LISTEN ${CHANNEL}`);
    } catch (error) {
      console.error('Listening for settings changes failed; retrying:', error);
      setTimeout(connect, 5000);
    }
  };
  await connect();
  return async () => {
    stopped = true;
    if (client) {
      await client.query(`UNLISTEN ${CHANNEL}`).catch(() => undefined);
      client.release();
      client = null;
    }
  };
};
