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

// A link inside the shop ("/products?on_sale=1") or a full https:// URL.
const target = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^\/(?!\/)\S*$/.test(v) || /^https:\/\/\S+$/i.test(v), {
    message: 'Please use a shop link starting with / or a full https:// link.',
  });
const text = (max: number) => z.string().trim().max(max).default('');

const heroSchema = z
  .object({
    main: z
      .object({
        eyebrow: text(60),
        title: text(80),
        text: text(200),
        cta_label: text(40),
        link: target.default(''),
        image: image.default(''),
      })
      .default({}),
    side: z
      .object({ eyebrow: text(60), title: text(60), link: target.default(''), image: image.default('') })
      .default({}),
    member: z
      .object({ eyebrow: text(60), title: text(60), text: text(160), link: target.default('') })
      .default({}),
  })
  .default({});

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
  hero: heroSchema,
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
  // Home-page hero; empty images fall back to the app's own photos.
  hero: {
    main: {
      eyebrow: 'Weekend drop · 20% off',
      title: 'Finds that feel like you.',
      text: 'Fresh tech, everyday essentials and standout style — all in one place, picked for real life.',
      cta_label: 'Shop today’s edit',
      link: '/products?on_sale=1',
      image: '',
    },
    side: { eyebrow: 'Sound, upgraded', title: 'Your new favourite headphones', link: '/products?search=headphones', image: '' },
    member: {
      eyebrow: 'Member perks',
      title: 'More perks. Zero fuss.',
      text: 'Early access, member pricing and free express delivery.',
      link: '/signup',
    },
  },
};

/** Section-by-section merge, so saving one hero field keeps the others. */
export const mergeHero = (base: StoreSettings['hero'], patch?: Partial<Record<keyof StoreSettings['hero'], object>>) => ({
  main: { ...base.main, ...(patch?.main || {}) },
  side: { ...base.side, ...(patch?.side || {}) },
  member: { ...base.member, ...(patch?.member || {}) },
});

export const getStore = async (): Promise<StoreSettings> => {
  const row = (await query('SELECT settings FROM store_settings WHERE id = 1')).rows[0];
  const saved = row?.settings || {};
  const parsed = storeSchema.safeParse({ ...DEFAULT_STORE, ...saved, hero: mergeHero(DEFAULT_STORE.hero, saved.hero) });
  return parsed.success ? parsed.data : DEFAULT_STORE;
};

export const saveStore = async (settings: StoreSettings, userId: number) => {
  await query(
    `INSERT INTO store_settings (id, settings, updated_by, updated_at) VALUES (1, $1, $2, now())
     ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(settings), userId]
  );
};
