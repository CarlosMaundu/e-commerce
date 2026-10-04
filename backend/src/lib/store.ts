// src/lib/store.ts — the shop's own details (name, logo, favicon, contact,
// social links), edited in the back office and served to every page.
import { z } from 'zod';
import { config } from '../config';
import { query } from '../db';

const image = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === '' || /^https:\/\/\S+$/i.test(v) || v.startsWith(`${config.publicUploadsPath}/`), {
    message: 'Please use an uploaded image or a full https:// link.',
  });

const link = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https:\/\/\S+$/i.test(v), { message: 'Please enter a full https:// link.' });

export const storeSchema = z.object({
  name: z.string().trim().min(1, 'Please enter the shop’s name.').max(80),
  tagline: z.string().trim().max(160).default(''),
  logo: image.default(''),
  favicon: image.default(''),
  email: z.union([z.literal(''), z.string().trim().email('Please enter a valid email address.')]).default(''),
  phone: z.string().trim().max(40).default(''),
  address: z.string().trim().max(300).default(''),
  footer_text: z.string().trim().max(200).default(''),
  announcement: z.string().trim().max(160).default(''),
  social: z
    .object({ facebook: link.default(''), instagram: link.default(''), x: link.default(''), tiktok: link.default('') })
    .default({}),
});

export type StoreSettings = z.output<typeof storeSchema>;

export const DEFAULT_STORE: StoreSettings = {
  name: 'Carlos Shop',
  tagline: 'Everyday things, chosen with care.',
  logo: '',
  favicon: '',
  email: '',
  phone: '',
  address: '',
  footer_text: '',
  announcement: '',
  social: { facebook: '', instagram: '', x: '', tiktok: '' },
};

export const getStore = async (): Promise<StoreSettings> => {
  const row = (await query('SELECT settings FROM store_settings WHERE id = 1')).rows[0];
  const parsed = storeSchema.safeParse({ ...DEFAULT_STORE, ...(row?.settings || {}) });
  return parsed.success ? parsed.data : DEFAULT_STORE;
};

export const saveStore = async (settings: StoreSettings, userId: number) => {
  await query(
    `INSERT INTO store_settings (id, settings, updated_by, updated_at) VALUES (1, $1, $2, now())
     ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(settings), userId]
  );
};
