// src/lib/settings.ts — security settings managed in the back office, and the
// rules that use them (password policy, lockout, staff session limits).
import { z } from 'zod';
import { query } from '../db';
import { fail } from './http';

export const settingsSchema = z.object({
  password: z.object({
    // 8 is the floor; the base password rules always apply.
    min_length: z.coerce.number().int().min(8, 'Passwords must be at least 8 characters.').max(64),
    require_symbol: z.boolean(),
  }),
  lockout: z.object({
    max_attempts: z.coerce.number().int().min(3, 'Allow at least 3 attempts.').max(20),
    minutes: z.coerce.number().int().min(1).max(1440),
  }),
  staff_sessions: z.object({
    max_hours: z.coerce.number().int().min(1).max(24 * 30),
    idle_minutes: z.coerce.number().int().min(5, 'The idle timeout must be at least 5 minutes.').max(24 * 60),
    max_concurrent: z.coerce.number().int().min(1).max(50),
  }),
  accounts: z.object({ allow_registration: z.boolean() }),
});

export type SecuritySettings = z.output<typeof settingsSchema>;

export const DEFAULT_SETTINGS: SecuritySettings = {
  password: { min_length: 8, require_symbol: false },
  lockout: { max_attempts: 5, minutes: 15 },
  staff_sessions: { max_hours: 12, idle_minutes: 60, max_concurrent: 5 },
  accounts: { allow_registration: true },
};

export const getSettings = async (): Promise<SecuritySettings> => {
  const row = (await query('SELECT settings FROM security_settings WHERE id = 1')).rows[0];
  const parsed = settingsSchema.safeParse(row?.settings);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
};

export const saveSettings = async (settings: SecuritySettings, userId: number) => {
  await query(
    `INSERT INTO security_settings (id, settings, updated_by, updated_at) VALUES (1, $1, $2, now())
     ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(settings), userId]
  );
};

/** Extra password rules from the settings, on top of passwordSchema. */
export const enforcePasswordPolicy = async (password: string) => {
  const { password: policy } = await getSettings();
  if (password.length < policy.min_length) {
    fail(400, `Use at least ${policy.min_length} characters for your password.`);
  }
  if (policy.require_symbol && !/[^A-Za-z0-9]/.test(password)) {
    fail(400, 'Your password needs a symbol, such as ! or #.');
  }
};
