// src/routes/adminCosts.ts — Back office → Products → Cost prices: every
// product (or each variant) with its selling price, cost and margin; edit
// costs in place, fill missing ones from a target margin, and optionally use
// them for past orders that have no cost yet (so reports can show profit).
import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db';
import { audit } from '../lib/audit';
import { handler, ok, parse } from '../lib/http';
import { round2 } from '../lib/pricing';
import { authenticate, requirePermission } from '../middleware/auth';

// One row per thing with its own cost: a variant, or a product without variants.
const ITEMS = `
  SELECT pr.id AS product_id, v.id AS variant_id, pr.name, v.options, COALESCE(v.sku, pr.sku) AS sku,
    COALESCE(v.special, v.price, pr.special, pr.price) AS price, COALESCE(v.cost_price, pr.cost_price) AS cost,
    v.cost_price IS NULL AND pr.cost_price IS NOT NULL AS inherited, pr.category_id, c.name AS category, pr.status
  FROM product_variants v JOIN products pr ON pr.id = v.product_id LEFT JOIN categories c ON c.id = pr.category_id
  UNION ALL
  SELECT pr.id, NULL, pr.name, '{}'::jsonb, pr.sku, COALESCE(pr.special, pr.price), pr.cost_price, false,
    pr.category_id, c.name, pr.status
  FROM products pr LEFT JOIN categories c ON c.id = pr.category_id
  WHERE NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = pr.id)`;

const toRow = (r: any) => {
  const price = Number(r.price);
  const cost = r.cost === null ? null : Number(r.cost);
  return {
    product_id: r.product_id,
    variant_id: r.variant_id,
    name: r.name,
    options: r.options || {},
    sku: r.sku,
    category: r.category,
    price,
    cost_price: cost,
    // The variant uses its product's cost.
    inherited: r.inherited,
    margin: cost === null || !price ? null : round2(((price - cost) / price) * 100),
  };
};

/** Past order lines without a cost take the item's cost now. */
const applyToPast = (db: { query: typeof query }, productIds: number[]) =>
  db.query(
    `UPDATE order_items oi SET unit_cost = COALESCE(
       (SELECT cost_price FROM product_variants WHERE id = oi.variant_id),
       (SELECT cost_price FROM products WHERE id = oi.product_id))
     WHERE oi.unit_cost IS NULL AND oi.product_id = ANY($1::int[])`,
    [productIds]
  );

export const adminCostRoutes = () => {
  const router = Router();
  router.use('/cost-prices', authenticate, requirePermission('catalog.products.update'));

  router.get('/cost-prices', handler(async (req, res) => {
    const q = parse(
      z.object({
        search: z.string().trim().max(100).optional(),
        missing: z.coerce.boolean().optional(),
        category: z.coerce.number().int().positive().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(10),
      }),
      req.query
    );
    const params: unknown[] = [];
    const where: string[] = [];
    if (q.search) {
      params.push(`%${q.search}%`);
      where.push(`(i.name ILIKE $${params.length} OR i.sku ILIKE $${params.length})`);
    }
    if (q.category) {
      params.push(q.category);
      where.push(`(i.category_id = $${params.length} OR i.category_id IN (SELECT id FROM categories WHERE parent_id = $${params.length}))`);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const counts = (await query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE i.cost IS NULL)::int AS missing FROM (${ITEMS}) i ${w}`,
      params
    )).rows[0];
    const filter = q.missing ? `${w ? `${w} AND` : 'WHERE'} i.cost IS NULL` : w;
    const total = q.missing ? counts.missing : counts.total;
    params.push(q.limit, (q.page - 1) * q.limit);
    const rows = (await query(
      `SELECT * FROM (${ITEMS}) i ${filter} ORDER BY i.name, i.variant_id NULLS FIRST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )).rows;
    ok(res, { items: rows.map(toRow), total, counts: { all: counts.total, missing: counts.missing } });
  }));

  // { items: [{ product_id, variant_id, cost_price }], apply_to_past_orders }
  router.put('/cost-prices', handler(async (req, res) => {
    const b = parse(
      z.object({
        items: z
          .array(
            z.object({
              product_id: z.coerce.number().int().positive(),
              variant_id: z.coerce.number().int().positive().nullable().default(null),
              cost_price: z.preprocess(
                (v) => (v === '' ? null : v),
                z.coerce.number().min(0, 'Cost can’t be negative.').nullable()
              ),
            })
          )
          .min(1, 'Change at least one cost.')
          .max(500),
        apply_to_past_orders: z.coerce.boolean().default(false),
      }),
      req.body
    );
    const ids = [...new Set(b.items.map((i) => i.product_id))];
    await transaction(async (db) => {
      for (const i of b.items) {
        if (i.variant_id) {
          await db.query('UPDATE product_variants SET cost_price = $3 WHERE id = $2 AND product_id = $1', [
            i.product_id, i.variant_id, i.cost_price,
          ]);
        } else {
          await db.query('UPDATE products SET cost_price = $2, updated_at = now() WHERE id = $1', [i.product_id, i.cost_price]);
        }
      }
      if (b.apply_to_past_orders) await applyToPast(db, ids);
    });
    audit(req, 'catalog.costs_updated', `products:${ids.length}`, { items: b.items.length, past: b.apply_to_past_orders });
    ok(res, { updated: b.items.length });
  }));

  // Fill missing costs so each item makes `margin_percent` on its price.
  router.post('/cost-prices/fill', handler(async (req, res) => {
    const b = parse(
      z.object({
        margin_percent: z.coerce
          .number({ invalid_type_error: 'Please enter a margin.' })
          .min(0, 'Use 0 to 95.')
          .max(95, 'Use 0 to 95.'),
        category: z.coerce.number().int().positive().optional(),
        apply_to_past_orders: z.coerce.boolean().default(false),
      }),
      req.body
    );
    const share = 1 - b.margin_percent / 100;
    const inCategory = b.category
      ? `AND (pr.category_id = $2 OR pr.category_id IN (SELECT id FROM categories WHERE parent_id = $2))`
      : '';
    const params = b.category ? [share, b.category] : [share];
    const filled = await transaction(async (db) => {
      // Products without variants, and variants with neither their own nor a product cost.
      const a = await db.query(
        `UPDATE products pr SET cost_price = round(COALESCE(pr.special, pr.price) * $1, 2), updated_at = now()
         WHERE pr.cost_price IS NULL AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = pr.id) ${inCategory}
         RETURNING pr.id`,
        params
      );
      const v = await db.query(
        `UPDATE product_variants v SET cost_price = round(COALESCE(v.special, v.price, pr.special, pr.price) * $1, 2)
         FROM products pr WHERE pr.id = v.product_id AND v.cost_price IS NULL AND pr.cost_price IS NULL ${inCategory}
         RETURNING v.product_id`,
        params
      );
      const ids = [...new Set([...a.rows, ...v.rows].map((r: any) => r.id ?? r.product_id))];
      if (b.apply_to_past_orders && ids.length) await applyToPast(db, ids);
      return a.rowCount! + v.rowCount!;
    });
    audit(req, 'catalog.costs_filled', 'products', { margin: b.margin_percent, filled });
    ok(res, { filled });
  }));

  return router;
};
