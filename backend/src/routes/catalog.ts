// src/routes/catalog.ts — storefront catalog and newsletter (OpenCart routes).
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { fail, handler, ok, parse } from '../lib/http';
import { optionalAuth } from '../middleware/auth';

export interface ProductRow {
  id: number;
  name: string;
  description: string;
  price: string;
  special: string | null;
  quantity: number;
  category_id: number | null;
  category_name: string | null;
  images: string[];
  options: { sizes: string[]; colors: string[] };
  manufacturer: string;
  rating: string;
  reviews: number;
  created_at: Date;
  updated_at: Date;
}

export const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name
  FROM products p LEFT JOIN categories c ON c.id = p.category_id`;

export const toContractProduct = (p: ProductRow) => ({
  product_id: p.id,
  name: p.name,
  description: p.description,
  price: Number(p.price),
  special: p.special === null ? null : Number(p.special),
  image: p.images[0] || '',
  images: p.images,
  category: p.category_id ? [{ category_id: p.category_id, name: p.category_name }] : [],
  quantity: p.quantity,
  rating: Number(p.rating),
  reviews: p.reviews,
  manufacturer: p.manufacturer,
  options: p.options,
  date_added: p.created_at,
  date_modified: p.updated_at,
});

interface CategoryRow {
  id: number;
  name: string;
  image: string;
  parent_id: number | null;
}

const buildTree = (rows: CategoryRow[], parentId: number | null): unknown[] =>
  rows
    .filter((c) => c.parent_id === parentId)
    .map((c) => ({
      category_id: c.id,
      name: c.name,
      image: c.image,
      parent_id: c.parent_id ?? 0,
      categories: buildTree(rows, c.id),
    }));

export const loadCategoryTree = async (rootId?: number) => {
  const rows = (await query<CategoryRow>('SELECT id, name, image, parent_id FROM categories ORDER BY id')).rows;
  if (rootId === undefined) return buildTree(rows, null);
  const root = rows.find((c) => c.id === rootId);
  if (!root) return null;
  return { category_id: root.id, name: root.name, image: root.image, parent_id: root.parent_id ?? 0, categories: buildTree(rows, root.id) };
};

const listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.coerce.number().int().positive().optional(),
  price_min: z.coerce.number().min(0).optional(),
  price_max: z.coerce.number().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export const catalogRoutes = () => {
  const router = Router();

  router.get(
    '/products',
    handler(async (req, res) => {
      const q = parse(listQuery, req.query);
      const where: string[] = [];
      const params: unknown[] = [];
      const add = (sql: string, value: unknown) => {
        params.push(value);
        where.push(sql.replace('?', `$${params.length}`));
      };
      if (q.search) add(`(p.name ILIKE ? OR p.description ILIKE $${params.length + 1})`, `%${q.search}%`);
      if (q.category) {
        add(
          `p.category_id IN (WITH RECURSIVE tree AS (
              SELECT id FROM categories WHERE id = ?
              UNION ALL SELECT c.id FROM categories c JOIN tree t ON c.parent_id = t.id
            ) SELECT id FROM tree)`,
          q.category
        );
      }
      if (q.price_min !== undefined) add('COALESCE(p.special, p.price) >= ?', q.price_min);
      if (q.price_max !== undefined) add('COALESCE(p.special, p.price) <= ?', q.price_max);
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const total = Number(
        (await query(`SELECT count(*) FROM products p ${whereSql}`, params)).rows[0].count
      );
      let paging = '';
      if (q.limit) {
        params.push(q.limit, ((q.page || 1) - 1) * q.limit);
        paging = `LIMIT $${params.length - 1} OFFSET $${params.length}`;
      }
      const rows = (
        await query<ProductRow>(`${PRODUCT_SELECT} ${whereSql} ORDER BY p.created_at DESC, p.id DESC ${paging}`, params)
      ).rows;
      res.set('X-Total-Count', String(total));
      ok(res, rows.map(toContractProduct));
    })
  );

  router.get(
    '/products/:id',
    handler(async (req, res) => {
      const id = Number(req.params.id);
      const row = Number.isInteger(id) && (await query<ProductRow>(`${PRODUCT_SELECT} WHERE p.id = $1`, [id])).rows[0];
      if (!row) fail(404, 'Product not found.');
      ok(res, toContractProduct(row as ProductRow));
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
