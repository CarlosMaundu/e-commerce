// src/lib/appIcon.ts — the installed app's icons, made from the shop's logo
// (Store settings → Logo, else its favicon). Each size is drawn on a white
// square; "maskable" icons leave the safe margin Android crops to a circle.
// With no logo set, a brand-blue square with a shopping bag stands in.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { config } from '../config';
import { getStore } from './store';

export const ICON_SIZES = [48, 64, 96, 144, 180, 192, 512];
const BRAND = '#2F7CF6';

/** A short fingerprint of what the icons are made from, for cache-busting. */
export const iconVersion = (logo: string) =>
  crypto.createHash('sha1').update(logo || 'default').digest('hex').slice(0, 10);

/** The logo's bytes: an upload on this server, or an https image (e.g. S3). */
const readLogo = async (src: string): Promise<Buffer | null> => {
  if (!src) return null;
  try {
    if (src.startsWith(`${config.publicUploadsPath}/`)) {
      const name = path.basename(src.split('?')[0]);
      return await fs.readFile(path.join(config.uploadsDir, name));
    }
    if (/^https?:\/\//i.test(src)) {
      const res = await fetch(src, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.length <= 5 * 1024 * 1024 ? buf : null;
    }
  } catch {
    // Missing or unreadable: use the default icon.
  }
  return null;
};

// Feather's shopping-bag outline, scaled into a 24×24 box.
const BAG = `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`;

const defaultIcon = (size: number, maskable: boolean) => {
  const glyph = maskable ? 0.42 : 0.52;
  const offset = (24 - 24 / glyph) / 2;
  const radius = maskable ? 0 : size * 0.22;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND}"/>
    <svg x="0" y="0" width="${size}" height="${size}" viewBox="${offset} ${offset} ${24 / glyph} ${24 / glyph}"
      fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${BAG}</svg>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
};

const fromLogo = async (logo: Buffer, size: number, maskable: boolean) => {
  const inner = Math.round(size * (maskable ? 0.62 : 0.82));
  const art = await sharp(logo)
    .rotate()
    .resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } })
    .composite([{ input: art, gravity: 'center' }])
    .png()
    .toBuffer();
};

const cache = new Map<string, Buffer>();

/** PNG bytes for one icon; cached until the logo changes. */
export const appIcon = async (size: number, maskable = false) => {
  const store = await getStore();
  const src = store.logo || store.favicon || '';
  const key = `${src}|${size}|${maskable}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const logo = await readLogo(src);
  let png: Buffer;
  try {
    png = logo ? await fromLogo(logo, size, maskable) : await defaultIcon(size, maskable);
  } catch {
    png = await defaultIcon(size, maskable); // the logo isn't an image sharp can read
  }
  if (cache.size > 40) cache.clear();
  cache.set(key, png);
  return png;
};

/** The web app manifest: what phones show when the shop is installed. */
export const appManifest = async () => {
  const store = await getStore();
  const v = iconVersion(store.logo || store.favicon || '');
  const icon = (size: number, purpose: 'any' | 'maskable') => ({
    src: `/api/rest/app-icon/${size}${purpose === 'maskable' ? '-maskable' : ''}.png?v=${v}`,
    sizes: `${size}x${size}`,
    type: 'image/png',
    purpose,
  });
  const words = store.name.trim();
  return {
    id: '/',
    name: words,
    short_name: words.length <= 12 ? words : words.split(/\s+/)[0].slice(0, 12),
    description: store.tagline || `Shop online at ${words}.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: BRAND,
    background_color: '#FFFFFF',
    categories: ['shopping'],
    icons: [icon(192, 'any'), icon(512, 'any'), icon(192, 'maskable'), icon(512, 'maskable')],
    shortcuts: [
      { name: 'Shop', url: '/products' },
      { name: 'Bag', url: '/cart' },
      { name: 'My orders', url: '/account/orders' },
    ],
  };
};
