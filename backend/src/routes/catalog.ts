// src/routes/catalog.ts — storefront catalog, brands, reviews, promotions and
// newsletter (OpenCart routes plus documented extensions).
import { relatedMatch } from '../lib/search';
import { getRefundSettings } from '../lib/refunds';
import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db';
import { fail, handler, ok, parse } from '../lib/http';
import {
  buildWhere,
  hydrate,
  loadProduct,
  PRODUCT_SELECT,
  ProductFilters,
  ProductRow,
  refreshRating,
  SORTS,
} from '../lib/products';
import { getStore } from '../lib/store';
import { publicFinance } from '../lib/finance';
import { authenticate, customersOnly, notWhileImpersonating, optionalAuth } from '../middleware/auth';

interface CategoryRow {
  id: number;
  name: string;
  image: string;
  parent_id: number | null;
  product_count: number;
}

const buildTree = (rows: CategoryRow[], parentId: number | null): unknown[] =>
  rows
    .filter((c) => c.parent_id === parentId)
    .map((c) => ({
      category_id: c.id,
      name: c.name,
      image: c.image,
      parent_id: c.parent_id ?? 0,
      product_count: c.product_count,
      categories: buildTree(rows, c.id),
    }));

export const loadCategoryTree = async (rootId?: number) => {
  const rows = (
    await query<CategoryRow>(
      `SELECT c.id, c.name, c.image, c.parent_id,
         (SELECT count(*)::int FROM products p WHERE p.category_id = c.id) AS product_count
       FROM categories c ORDER BY c.id`
    )
  ).rows;
  if (rootId === undefined) return buildTree(rows, null);
  const root = rows.find((c) => c.id === rootId);
  if (!root) return null;
  return {
    category_id: root.id, name: root.name, image: root.image, parent_id: root.parent_id ?? 0,
    product_count: root.product_count, categories: buildTree(rows, root.id),
  };
};

const csv = (v: unknown) =>
  (Array.isArray(v) ? v.join(',') : String(v ?? ''))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const flag = z
  .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
  .transform((v) => v === '1' || v === 'true')
  .optional();

/** Storefront and admin list filters, from the query string. */
export const filterQuery = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.any().transform((v) => csv(v).map(Number).filter((n) => Number.isInteger(n) && n > 0)).optional(),
  brand: z.any().transform((v) => csv(v).map(Number).filter((n) => Number.isInteger(n) && n > 0)).optional(),
  price_min: z.coerce.number().min(0).optional(),
  price_max: z.coerce.number().min(0).optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  in_stock: flag,
  on_sale: flag,
  featured: flag,
  tag: z.any().transform((v) => csv(v).map((t) => t.slice(0, 60)).slice(0, 20)).optional(),
  attr: z
    .record(z.any())
    .transform((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.slice(0, 60), csv(v).slice(0, 20)])))
    .optional(),
  sort: z.enum(Object.keys(SORTS) as [string, ...string[]], {
    errorMap: () => ({ message: 'Please choose a valid sort order.' }),
  }).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export const PRODUCT_FROM = `FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN brands b ON b.id = p.brand_id`;

/** Runs a filtered, sorted, paged product list → { total, products }. */
export const listProducts = async (q: z.infer<typeof filterQuery>, extra: Partial<ProductFilters> = {}) => {
  const filters = { ...(q as ProductFilters), ...extra };
  let params: unknown[] = [];
  let whereSql = buildWhere(filters, params);
  let total = Number((await query(`SELECT count(*) ${PRODUCT_FROM} ${whereSql}`, params)).rows[0].count);
  let order = SORTS[q.sort || 'newest'];
  let match: 'exact' | 'related' = 'exact';
  // Nothing found: show related items instead (same other filters).
  if (!total && filters.search) {
    const p2: unknown[] = [];
    const base = buildWhere({ ...filters, search: undefined }, p2);
    const related = await relatedMatch(filters.search, p2);
    if (related) {
      const w = `${base ? `${base} AND` : 'WHERE'} ${related.where}`;
      const n = Number((await query(`SELECT count(*) ${PRODUCT_FROM} ${w}`, p2)).rows[0].count);
      if (n) {
        params = p2;
        whereSql = w;
        total = n;
        order = `${related.score} DESC, ${order}`;
        match = 'related';
      }
    }
  }
  let paging = '';
  if (q.limit) {
    params.push(q.limit, ((q.page || 1) - 1) * q.limit);
    paging = `LIMIT $${params.length - 1} OFFSET $${params.length}`;
  }
  const rows = (
    await query<ProductRow>(`${PRODUCT_SELECT} ${whereSql} ORDER BY ${order} ${paging}`, params)
  ).rows;
  return { total, match, products: await hydrate(rows) };
};

const reviewBody = z.object({
  rating: z.coerce
    .number({ invalid_type_error: 'Please choose a star rating.' })
    .int()
    .min(1, 'Please choose a star rating.')
    .max(5, 'Please choose a star rating.'),
  title: z.string().trim().max(150).default(''),
  text: z
    .string({ required_error: 'Please write a few words about the product.' })
    .trim()
    .min(10, 'Please write at least a sentence (10 characters or more).')
    .max(5000, 'Please keep your review under 5,000 characters.'),
});

/**
 * Attributes shoppers filter by. Others (scent, shade, strap, switch…) are
 * choices made on the product page, not ways to browse.
 */
export const FILTER_ATTRIBUTES = ['color', 'colour', 'size', 'material', 'fabric material'];

const startOfTomorrow = () => {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d;
};

export const catalogRoutes = () => {
  const router = Router();

  router.get(
    '/products',
    handler(async (req, res) => {
      const q = parse(filterQuery, req.query);
      const { total, match, products } = await listProducts(q, { status: 'published' });
      res.set('X-Total-Count', String(total));
      res.set('X-Search-Match', match);
      ok(res, products);
    })
  );

  // Frequently bought together: products most often in the same orders,
  // topped up from the same category, then the most viewed. Published and
  // in stock only; at most three.
  router.get(
    '/products/:id/bought-together',
    handler(async (req, res) => {
      const id = Number(req.params.id);
      const base = (await query('SELECT category_id FROM products WHERE id = $1', [id])).rows[0];
      if (!base) fail(404, 'Product not found.');
      const usable = `p.status = 'published' AND (p.quantity > 0 OR NOT p.track_inventory) AND p.id <> $1`;
      const ids: number[] = (
        await query(
          `SELECT oi2.product_id AS id, count(DISTINCT oi1.order_id) AS n
           FROM order_items oi1
           JOIN orders o ON o.id = oi1.order_id AND o.placed_at IS NOT NULL
           JOIN order_items oi2 ON oi2.order_id = oi1.order_id AND oi2.product_id <> oi1.product_id
           JOIN products p ON p.id = oi2.product_id
           WHERE oi1.product_id = $1 AND ${usable}
           GROUP BY oi2.product_id ORDER BY n DESC, oi2.product_id LIMIT 3`,
          [id]
        )
      ).rows.map((r) => r.id);
      if (ids.length < 3) {
        const more = (
          await query(
            `SELECT p.id FROM products p WHERE ${usable} AND NOT (p.id = ANY($2::int[]))
             ORDER BY (p.category_id IS NOT DISTINCT FROM $3) DESC,
               (SELECT COALESCE(sum(v.views), 0) FROM product_views v WHERE v.product_id = p.id AND v.day > current_date - 30) DESC,
               p.id
             LIMIT $4`,
            [id, ids, base.category_id, 3 - ids.length]
          )
        ).rows.map((r) => r.id);
        ids.push(...more);
      }
      if (!ids.length) return ok(res, []);
      const rows = (await query<ProductRow>(`${PRODUCT_SELECT} WHERE p.id = ANY($1::int[])`, [ids])).rows;
      const products = await hydrate(rows);
      ok(res, ids.map((pid) => products.find((p: any) => p.product_id === pid)).filter(Boolean));
    })
  );

  router.get(
    '/products/:id',
    handler(async (req, res) => {
      const product = await loadProduct(Number(req.params.id), { publishedOnly: true });
      if (!product) fail(404, 'Product not found.');
      // Counts towards "Best viewed this week"; never blocks the page.
      query(
        `INSERT INTO product_views (product_id, day, views) VALUES ($1, current_date, 1)
         ON CONFLICT (product_id, day) DO UPDATE SET views = product_views.views + 1`,
        [product!.product_id]
      ).catch(() => {});
      ok(res, product);
    })
  );

  // More from the same category, then the same brand.
  router.get(
    '/products/:id/related',
    handler(async (req, res) => {
      const id = Number(req.params.id);
      const base = (await query('SELECT category_id, brand_id FROM products WHERE id = $1', [id])).rows[0];
      if (!base) fail(404, 'Product not found.');
      const rows = (
        await query<ProductRow>(
          `${PRODUCT_SELECT} WHERE p.id <> $1 AND p.status = 'published'
             AND (p.category_id = $2 OR p.brand_id = $3)
           ORDER BY (p.category_id = $2) DESC NULLS LAST, p.rating DESC, p.id DESC LIMIT 10`,
          [id, base.category_id, base.brand_id]
        )
      ).rows;
      ok(res, await hydrate(rows));
    })
  );

  // ---------- reviews ----------
  router.get(
    '/products/:id/reviews',
    handler(async (req, res) => {
      const id = Number(req.params.id);
      const { limit = 10, page = 1 } = parse(
        z.object({
          limit: z.coerce.number().int().min(1).max(50).optional(),
          page: z.coerce.number().int().min(1).optional(),
        }),
        req.query
      );
      if (!(await query("SELECT 1 FROM products WHERE id = $1 AND status = 'published'", [id])).rows[0]) {
        fail(404, 'Product not found.');
      }
      const summary = (
        await query(
          `SELECT count(*)::int AS count, COALESCE(round(avg(rating)::numeric, 1), 0) AS average,
             count(*) FILTER (WHERE rating = 5)::int AS r5, count(*) FILTER (WHERE rating = 4)::int AS r4,
             count(*) FILTER (WHERE rating = 3)::int AS r3, count(*) FILTER (WHERE rating = 2)::int AS r2,
             count(*) FILTER (WHERE rating = 1)::int AS r1
           FROM product_reviews WHERE product_id = $1`,
          [id]
        )
      ).rows[0];
      const reviews = (
        await query(
          `SELECT id, author, rating, title, text, verified, created_at FROM product_reviews
           WHERE product_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
          [id, limit, (page - 1) * limit]
        )
      ).rows;
      res.set('X-Total-Count', String(summary.count));
      ok(res, {
        summary: {
          average: Number(summary.average),
          count: summary.count,
          breakdown: { 5: summary.r5, 4: summary.r4, 3: summary.r3, 2: summary.r2, 1: summary.r1 },
        },
        reviews: reviews.map((r) => ({
          review_id: r.id,
          author: r.author,
          rating: r.rating,
          title: r.title,
          text: r.text,
          verified: r.verified,
          date_added: r.created_at,
        })),
      });
    })
  );

  router.post(
    '/products/:id/review',
    authenticate,
    customersOnly,
    notWhileImpersonating('Reviews must come from the customer themselves.'),
    handler(async (req, res) => {
      const id = Number(req.params.id);
      const b = parse(reviewBody, req.body);
      if (!(await query("SELECT 1 FROM products WHERE id = $1 AND status = 'published'", [id])).rows[0]) {
        fail(404, 'Product not found.');
      }
      const user = req.auth!.user;
      const verified = Boolean(
        (
          await query(
            `SELECT 1 FROM orders o JOIN order_items oi ON oi.order_id = o.id
             WHERE o.user_id = $1 AND oi.product_id = $2 AND o.status = 'delivered' LIMIT 1`,
            [req.auth!.userId, id]
          )
        ).rows[0]
      );
      const author = `${user.firstname} ${user.lastname.charAt(0)}.`.trim();
      const saved = await transaction(async (db) => {
        const { rows } = await db.query(
          `INSERT INTO product_reviews (product_id, user_id, author, rating, title, text, verified)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (product_id, user_id) WHERE user_id IS NOT NULL DO NOTHING
           RETURNING id`,
          [id, req.auth!.userId, author, b.rating, b.title, b.text, verified]
        );
        if (!rows[0]) fail(409, 'You’ve already reviewed this product.');
        await refreshRating(db, id);
        return rows[0].id;
      });
      ok(res, { review_id: saved, verified }, 201);
    })
  );

  // ---------- facets for the product list ----------
  router.get(
    '/product_filters',
    handler(async (req, res) => {
      const { category } = parse(filterQuery.pick({ category: true }), req.query);
      const params: unknown[] = [];
      const whereSql = buildWhere({ status: 'published', category }, params);
      const brands = (
        await query(
          `SELECT b.id, b.name, b.logo, count(*)::int AS count ${PRODUCT_FROM} ${whereSql} ${whereSql ? 'AND' : 'WHERE'} b.id IS NOT NULL
           GROUP BY b.id ORDER BY lower(b.name)`,
          params
        )
      ).rows;
      const price = (
        await query(
          `SELECT COALESCE(min(COALESCE(p.special, p.price)), 0) AS min,
                  COALESCE(max(COALESCE(p.special, p.price)), 0) AS max ${PRODUCT_FROM} ${whereSql}`,
          params
        )
      ).rows[0];
      const attrRows = (
        await query(
          `SELECT a->>'name' AS name, v AS value, count(DISTINCT p.id)::int AS count
           ${PRODUCT_FROM}, jsonb_array_elements(p.attributes) a, jsonb_array_elements_text(a->'values') v
           ${whereSql} GROUP BY 1, 2 ORDER BY 1, 2`,
          params
        )
      ).rows;
      const attributes: { name: string; values: { value: string; count: number }[] }[] = [];
      for (const r of attrRows.filter((x) => FILTER_ATTRIBUTES.includes(x.name.toLowerCase()))) {
        let group = attributes.find((a) => a.name.toLowerCase() === r.name.toLowerCase());
        if (!group) attributes.push((group = { name: r.name, values: [] }));
        if (!group.values.some((v) => v.value === r.value)) group.values.push({ value: r.value, count: r.count });
      }
      const tags = (
        await query(
          `SELECT t AS tag, count(*)::int AS count ${PRODUCT_FROM}, unnest(p.tags) t ${whereSql}
           GROUP BY t ORDER BY count(*) DESC, t LIMIT 30`,
          params
        )
      ).rows;
      ok(res, {
        brands: brands.map((b) => ({ brand_id: b.id, name: b.name, logo: b.logo, count: b.count })),
        price: { min: Number(price.min), max: Number(price.max) },
        attributes,
        tags,
      });
    })
  );

  // OpenCart "manufacturers": every brand that has published products.
  router.get(
    '/manufacturers',
    handler(async (_req, res) => {
      const rows = (
        await query(
          `SELECT b.id, b.name, b.logo, count(p.id)::int AS count
           FROM brands b LEFT JOIN products p ON p.brand_id = b.id AND p.status = 'published'
           GROUP BY b.id ORDER BY lower(b.name)`
        )
      ).rows;
      ok(res, rows.map((b) => ({ manufacturer_id: b.id, name: b.name, image: b.logo, product_count: b.count })));
    })
  );

  router.get(
    '/promotions',
    handler(async (_req, res) => {
      const rows = (
        await query(
          `SELECT * FROM promotions WHERE active
             AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())
           ORDER BY position, id`
        )
      ).rows;
      ok(
        res,
        rows.map((p) => ({
          promotion_id: p.id,
          title: p.title,
          subtitle: p.subtitle,
          code: p.code,
          link: p.link,
          image: p.image,
          ends_at: p.ends_at || startOfTomorrow(),
          daily: !p.ends_at,
        }))
      );
    })
  );

  // Shop name, logo, favicon and contact details for every page.
  router.get(
    '/store',
    handler(async (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      // Return rules for the Refund & Return Policy page.
      const r = await getRefundSettings();
      ok(res, {
        ...(await getStore()),
        finance: publicFinance(),
        returns: {
          window_days: r.return_window_days,
          refund_delivery: r.refund_delivery,
          restocking_fee_percent: r.restocking_fee_percent,
        },
      });
    })
  );

  router.get(
    '/categories',
    handler(async (_req, res) => {
      ok(res, await loadCategoryTree());
    })
  );

  router.get(
    '/categories/:id',
    handler(async (req, res) => {
      const tree = await loadCategoryTree(Number(req.params.id));
      if (!tree) fail(404, 'Category not found.');
      ok(res, tree);
    })
  );

  // Contract extension: guests send their email; signed-in users may omit it.
  router.put(
    '/newsletter/subscribe',
    optionalAuth,
    handler(async (req, res) => {
      const body = parse(
        z.object({
          email: z.string().trim().toLowerCase().email('Please enter a valid email address.').optional(),
        }),
        req.body
      );
      const email = body.email || req.auth?.user.email;
      if (!email) fail(400, 'Please enter a valid email address.');
      await query(
        'INSERT INTO newsletter_subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
        [email]
      );
      ok(res, { email, subscribed: true });
    })
  );

  return router;
};
