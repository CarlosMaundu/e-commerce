// src/demoCatalog.ts — the demo catalog in seed/catalog.json: categories,
// brands with logos, products with variants (own prices, stock and images),
// tags, reviews, a week of views and storefront promotions.
//
// Runs automatically into an empty shop. To swap an existing catalog for it:
//   npm run seed:demo                                 (local)
//   docker compose exec api node dist/demoCatalog.js --replace
import fs from 'fs';
import path from 'path';
import type { PoolClient } from 'pg';
import { config } from './config';
import { pool, query, transaction } from './db';
import { refreshRating, syncProductQuantity } from './lib/products';
import { demoMoney, demoPrice } from './lib/demoMoney';
import { loadFinance } from './lib/finance';

interface Spec {
  categories: { name: string; image: string; children: string[] }[];
  brands: { name: string; logo: string }[];
  products: {
    name: string;
    category: string;
    brand: string;
    price: number;
    special?: number;
    sku: string;
    featured?: boolean;
    tags: string[];
    description: string;
    quantity?: number;
    attributes: { name: string; values: string[] }[];
    imageBy?: string;
    priceBy?: Record<string, number>;
    priceAdd?: Record<string, number>;
    // Product information (Specifications tab).
    info?: {
      manufacturer?: string;
      mfr_part_number?: string;
      length?: number;
      width?: number;
      height?: number;
      dimension_unit?: string;
      weight?: number;
      weight_unit?: string;
      specs?: { label: string; value: string }[];
    };
    /** Photos per combination, keyed "Model=X|Color=Y" (all pairs must match). */
    variantImages?: Record<string, string[]>;
    /** Only these combinations exist (partial matches), e.g. per-model colours. */
    only?: Record<string, string>[];
    images: Record<string, string[]>;
    reviews: { author: string; rating: number; title: string; text: string; verified: boolean; days_ago: number }[];
    views: number;
  }[];
  promotions: { title: string; subtitle: string; code: string | null; link: string; image?: string; daily?: boolean; days?: number }[];
}

const SEED_DIR = path.join(__dirname, '..', 'seed');

/** Same pseudo-random numbers on every install. */
const random = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const combos = (attributes: Spec['products'][number]['attributes']): Record<string, string>[] =>
  attributes.reduce<Record<string, string>[]>(
    (acc, a) => acc.flatMap((c) => a.values.map((v) => ({ ...c, [a.name]: v }))),
    [{}]
  );

const code = (s: string) => s.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();

export const seedDemoCatalog = async ({ replace = false } = {}) => {
  const spec: Spec = JSON.parse(fs.readFileSync(path.join(SEED_DIR, 'catalog.json'), 'utf8'));
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  const copy = (dir: string, file: string) => {
    const target = path.join(config.uploadsDir, `demo-${file}`);
    if (!fs.existsSync(target)) fs.copyFileSync(path.join(SEED_DIR, 'images', dir, file), target);
    return `${config.publicUploadsPath}/demo-${file}`;
  };
  const rand = random(7);

  await transaction(async (db: PoolClient) => {
    if (replace) {
      // Order lines and carts keep their history; they just lose the product link.
      await db.query('DELETE FROM promotions');
      await db.query('DELETE FROM products');
      await db.query('DELETE FROM categories');
      await db.query('DELETE FROM brands');
    }

    const categoryIds: Record<string, number> = {};
    for (const c of spec.categories) {
      const { rows } = await db.query('INSERT INTO categories (name, image) VALUES ($1, $2) RETURNING id', [
        c.name, copy('catalog', c.image),
      ]);
      categoryIds[c.name] = rows[0].id;
      for (const child of c.children) {
        const sub = await db.query('INSERT INTO categories (name, image, parent_id) VALUES ($1, $2, $3) RETURNING id', [
          child, '', rows[0].id,
        ]);
        categoryIds[child] = sub.rows[0].id;
      }
    }

    const brandIds: Record<string, number> = {};
    for (const b of spec.brands) {
      const { rows } = await db.query('INSERT INTO brands (name, logo) VALUES ($1, $2) RETURNING id', [
        b.name, copy('brands', b.logo),
      ]);
      brandIds[b.name] = rows[0].id;
    }

    for (const [index, p] of spec.products.entries()) {
      const byValue = (value: string) => (p.images[value] || []).map((f) => copy('catalog', f));
      const order = p.imageBy ? p.attributes.find((a) => a.name === p.imageBy)!.values : [''];
      const combinationPhotos = Object.values(p.variantImages || {}).flat();
      const gallery = combinationPhotos.length
        ? [...new Set(combinationPhotos)].map((f) => copy('catalog', f))
        : [...order.flatMap(byValue), ...(p.imageBy ? byValue('') : [])];
      // Short SKU codes per value, longer where short ones would clash.
      const codes: Record<string, Record<string, string>> = {};
      for (const a of p.attributes) {
        const short = a.values.map(code);
        const clash = new Set(short).size !== short.length;
        codes[a.name] = Object.fromEntries(
          a.values.map((v, i) => [v, clash ? v.replace(/\+/g, 'PLUS').replace(/[^A-Za-z0-9]/g, '').toUpperCase() : short[i]])
        );
      }
      const matches = (options: Record<string, string>, key: string) =>
        key.split('|').every((pair) => {
          const [k, v] = pair.split('=');
          return options[k] === v;
        });
      const { rows } = await db.query(
        `INSERT INTO products (name, description, price, special, quantity, category_id, brand_id, images, sku,
           status, featured, tags, attributes, track_inventory, low_stock_threshold, created_at, published_at,
           manufacturer, mfr_part_number, length, width, height, dimension_unit, weight, weight_unit, specs)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'published', $10, $11, $12, true, 5,
                 now() - make_interval(days => $13), now() - make_interval(days => $13),
                 $14, $15, $16, $17, $18, $19, $20, $21, $22)
         RETURNING id`,
        [
          p.name, p.description, demoPrice(p.price), p.special ? demoPrice(p.special) : null, p.quantity ?? 0, categoryIds[p.category],
          brandIds[p.brand], JSON.stringify(gallery), p.sku, Boolean(p.featured), p.tags,
          JSON.stringify(p.attributes), spec.products.length - index,
          p.info?.manufacturer ?? '', p.info?.mfr_part_number ?? '', p.info?.length ?? null, p.info?.width ?? null,
          p.info?.height ?? null, p.info?.dimension_unit ?? 'cm', p.info?.weight ?? null, p.info?.weight_unit ?? 'kg',
          JSON.stringify(p.info?.specs ?? []),
        ]
      );
      const productId = rows[0].id;

      const all = p.attributes.length ? combos(p.attributes) : [];
      const existing = p.only
        ? all.filter((o) => p.only!.some((rule) => Object.entries(rule).every(([k, v]) => o[k] === v)))
        : all;
      for (const [position, options] of existing.entries()) {
        const overrides = Object.entries(options)
          .map(([k, v]) => p.priceBy?.[`${k}=${v}`])
          .filter((n): n is number => n !== undefined);
        const extra = Object.entries(options).reduce((sum, [k, v]) => sum + (p.priceAdd?.[`${k}=${v}`] || 0), 0);
        const base = overrides.length ? Math.max(...overrides) : null;
        const usd = base !== null || extra ? (base ?? p.price) + extra : null;
        const price = usd === null ? null : demoPrice(usd);
        // A variant with its own price keeps the product's sale ratio.
        const special = usd !== null && p.special ? demoPrice(Math.round(usd * (p.special / p.price))) : null;
        const roll = rand();
        const quantity = roll < 0.1 ? 0 : roll < 0.2 ? 1 + Math.floor(rand() * 4) : 6 + Math.floor(rand() * 20);
        const ownKey = Object.keys(p.variantImages || {}).find((key) => matches(options, key));
        const images = ownKey
          ? p.variantImages![ownKey].map((f) => copy('catalog', f))
          : p.imageBy
            ? byValue(options[p.imageBy])
            : [];
        await db.query(
          `INSERT INTO product_variants (product_id, options, sku, price, special, quantity, images, position)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [productId, JSON.stringify(options), `${p.sku}-${Object.entries(options).map(([k, v]) => codes[k][v]).join('-')}`,
            price, special, quantity, JSON.stringify(images), position]
        );
      }
      await syncProductQuantity(db, productId);

      for (const r of p.reviews) {
        await db.query(
          `INSERT INTO product_reviews (product_id, author, rating, title, text, verified, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, now() - make_interval(days => $7))`,
          [productId, r.author, r.rating, r.title, r.text, r.verified, r.days_ago]
        );
      }
      await refreshRating(db, productId);

      // Spread the week's views over the last seven days.
      for (let day = 0; day < 7; day += 1) {
        const views = Math.round((p.views / 7) * (0.5 + rand()));
        if (views) {
          await db.query(
            `INSERT INTO product_views (product_id, day, views) VALUES ($1, current_date - $2::int, $3)
             ON CONFLICT (product_id, day) DO UPDATE SET views = EXCLUDED.views`,
            [productId, day, views]
          );
        }
      }
    }

    for (const [position, promo] of spec.promotions.entries()) {
      const codeExists = promo.code && (await db.query('SELECT 1 FROM coupons WHERE code = $1', [promo.code])).rows[0];
      await db.query(
        `INSERT INTO promotions (title, subtitle, code, link, ends_at, position, image)
         VALUES ($1, $2, $3, $4, CASE WHEN $5::int IS NULL THEN NULL ELSE now() + make_interval(days => $5::int) END, $6, $7)`,
        [promo.title.replace(/\$(\d+)/g, (_, n) => demoMoney(Number(n))), promo.subtitle, codeExists ? promo.code : null, promo.link, promo.daily ? null : promo.days ?? 7, position,
          promo.image ? copy('catalog', promo.image) : '']
      );
    }
  });
  console.log(`Seeded demo catalog: ${spec.products.length} products`);
};

if (require.main === module) {
  query('SELECT 1')
    .then(() => loadFinance())
    .then(() => seedDemoCatalog({ replace: process.argv.includes('--replace') }))
    .then(() => pool.end())
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
