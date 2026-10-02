// src/routes/adminCatalog.ts — /api/admin/products, /categories, /files
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { query, transaction } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { singleImage, uploadedUrl } from '../lib/uploads';
import { authenticate, requireAnyPermission, requirePermission } from '../middleware/auth';
import {
  buildWhere,
  hydrate,
  loadProduct,
  PRODUCT_SELECT,
  ProductFilters,
  ProductRow,
  SORTS,
  syncProductQuantity,
} from '../lib/products';
import { filterQuery, loadCategoryTree, PRODUCT_FROM } from './catalog';


const imageUrl = z
  .string()
  .trim()
  .refine((v) => /^https?:\/\/\S+$/i.test(v) || v.startsWith(`${config.publicUploadsPath}/`), {
    message: 'Please add product images as uploaded files or full https:// links.',
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

const attributeSchema = z.object({
  name: z.string().trim().min(1, 'Please name every variation (for example Color or Size).').max(60),
  values: z
    .array(z.string().trim().min(1).max(60))
    .min(1, 'Please add at least one value to every variation.')
    .max(50),
});

const variantSchema = z.object({
  options: z.record(z.string().trim().max(60)),
  sku: optionalText(64),
  price: z.coerce.number().positive('Variant prices must be greater than zero.').nullable().optional(),
  special: z.coerce.number().positive('Variant sale prices must be greater than zero.').nullable().optional(),
  quantity: z.coerce.number().int().min(0, 'Stock can’t be negative.').default(0),
  images: z.array(imageUrl).max(6, 'You can add up to 6 images per variant.').default([]),
});

const productBody = z.object({
  name: z.string().trim().min(1, 'Please enter a product name.').max(255),
  description: z.string().max(20000).default(''),
  price: z.coerce.number({ invalid_type_error: 'Please enter a price greater than zero.' }).positive('Please enter a price greater than zero.'),
  special: z.coerce.number().positive().nullable().optional(),
  quantity: z.coerce.number().int().min(0, 'Stock can’t be negative.').default(0),
  category_id: z.coerce.number().int().positive().nullable().optional(),
  brand_id: z.coerce.number().int().positive().nullable().optional(),
  images: z.array(imageUrl).max(10, 'You can add up to 10 images.').default([]),
  sku: optionalText(64),
  status: z.enum(['published', 'draft']).default('published'),
  featured: z.boolean().default(false),
  tags: z
    .array(z.string().trim().min(1).max(40, 'Tags can be up to 40 characters.'))
    .max(20, 'You can add up to 20 tags.')
    .default([])
    .transform((tags) => tags.filter((t, i) => tags.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i)),
  attributes: z.array(attributeSchema).max(5, 'You can add up to 5 variations.').default([]),
  variants: z.array(variantSchema).max(200, 'You can add up to 200 variants.').optional(),
  track_inventory: z.boolean().default(true),
  low_stock_threshold: z.coerce.number().int().min(0).default(5),
});

type ProductInput = z.output<typeof productBody>;

const checkSpecial = (price: number, special: number | null | undefined, label = 'The sale price') => {
  if (special !== null && special !== undefined && special >= price) {
    fail(400, `${label} must be lower than the regular price.`);
  }
};

const checkRef = async (table: 'categories' | 'brands', id: number | null | undefined, message: string) => {
  if (id && !(await query(`SELECT 1 FROM ${table} WHERE id = $1`, [id])).rows[0]) fail(400, message);
};

/** Checks variations and their combinations; returns the cleaned variants. */
const checkVariants = (b: ProductInput) => {
  const names = b.attributes.map((a) => a.name.toLowerCase());
  if (new Set(names).size !== names.length) fail(400, 'Each variation needs a different name.');
  for (const a of b.attributes) {
    if (new Set(a.values.map((v) => v.toLowerCase())).size !== a.values.length) {
      fail(400, `“${a.name}” lists the same value twice.`);
    }
  }
  const variants = b.variants || [];
  if (!b.attributes.length && variants.length) fail(400, 'Add a variation (such as Color or Size) before adding variants.');
  const seen = new Set<string>();
  return variants.map((v) => {
    const options: Record<string, string> = {};
    for (const a of b.attributes) {
      const value = Object.entries(v.options).find(([k]) => k.toLowerCase() === a.name.toLowerCase())?.[1];
      if (!value || !a.values.includes(value)) {
        fail(400, `Every variant needs a ${a.name.toLowerCase()} from the list.`);
      }
      options[a.name] = value!;
    }
    const key = JSON.stringify(options);
    if (seen.has(key)) fail(400, `${Object.values(options).join(' / ')} is listed twice.`);
    seen.add(key);
    const label = Object.values(options).join(' / ');
    const base = v.price ?? b.price;
    checkSpecial(base, v.special, `The sale price for ${label}`);
    return { ...v, options };
  });
};

const uniqueViolation = (error: unknown) => {
  const e = error as { code?: string; constraint?: string };
  if (e.code !== '23505') throw error;
  if (e.constraint === 'product_variants_sku_key') fail(409, 'Another variant already uses that SKU.');
  if (e.constraint === 'products_sku_key') fail(409, 'Another product already uses that SKU.');
  if (e.constraint === 'brands_name_key') fail(409, 'A brand with that name already exists.');
  throw error;
};

/** Saves the product and replaces its variants, keeping ids of unchanged combinations. */
const saveProduct = async (b: ProductInput, id: number | null) => {
  const variants = checkVariants(b);
  checkSpecial(b.price, b.special);
  await checkRef('categories', b.category_id, 'Please choose a category that exists.');
  await checkRef('brands', b.brand_id, 'Please choose a brand that exists.');
  try {
    return await transaction(async (db) => {
      const values = [
        b.name, b.description, b.price, b.special ?? null, b.quantity, b.category_id ?? null, b.brand_id ?? null,
        JSON.stringify(b.images), b.sku, b.status, b.featured, b.tags, JSON.stringify(b.attributes),
        b.track_inventory, b.low_stock_threshold,
      ];
      let productId = id;
      if (productId === null) {
        const { rows } = await db.query(
          `INSERT INTO products (name, description, price, special, quantity, category_id, brand_id, images, sku,
             status, featured, tags, attributes, track_inventory, low_stock_threshold)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
          values
        );
        productId = rows[0].id as number;
      } else {
        await db.query(
          `UPDATE products SET name=$1, description=$2, price=$3, special=$4, quantity=$5, category_id=$6, brand_id=$7,
             images=$8, sku=$9, status=$10, featured=$11, tags=$12, attributes=$13, track_inventory=$14,
             low_stock_threshold=$15, updated_at=now() WHERE id=$16`,
          [...values, productId]
        );
      }
      if (b.variants !== undefined) {
        const keep = variants.map((v) => JSON.stringify(v.options));
        await db.query(
          'DELETE FROM product_variants WHERE product_id = $1 AND NOT (options = ANY($2::jsonb[]))',
          [productId, keep]
        );
        for (const [position, v] of variants.entries()) {
          await db.query(
            `INSERT INTO product_variants (product_id, options, sku, price, special, quantity, images, position)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (product_id, options) DO UPDATE SET sku = EXCLUDED.sku, price = EXCLUDED.price,
               special = EXCLUDED.special, quantity = EXCLUDED.quantity, images = EXCLUDED.images,
               position = EXCLUDED.position`,
            [productId, JSON.stringify(v.options), v.sku, v.price ?? null, v.special ?? null, v.quantity,
              JSON.stringify(v.images), position]
          );
        }
      } else if (id !== null) {
        // Variations changed without new variants: drop combinations that no longer fit.
        const existing = (await db.query('SELECT id, options FROM product_variants WHERE product_id = $1', [productId])).rows;
        for (const v of existing) {
          const fits =
            Object.keys(v.options).length === b.attributes.length &&
            b.attributes.every((a) => a.values.includes(v.options[a.name]));
          if (!fits) await db.query('DELETE FROM product_variants WHERE id = $1', [v.id]);
        }
      }
      await syncProductQuantity(db, productId);
      return productId;
    });
  } catch (error) {
    return uniqueViolation(error);
  }
};

const adminListQuery = filterQuery.extend({
  status: z.enum(['published', 'draft']).optional(),
  stock: z.enum(['in', 'low', 'out']).optional(),
});

export const adminCatalogRoutes = () => {
  const router = Router();
  router.use(authenticate);

  const canSeeProducts = requireAnyPermission(
    'catalog.products.create', 'catalog.products.update', 'catalog.products.delete'
  );

  // ---------- products ----------
  router.get(
    '/products',
    canSeeProducts,
    handler(async (req, res) => {
      const q = parse(adminListQuery, req.query);
      const stockFilter: Record<string, string> = {
        in: 'p.quantity > p.low_stock_threshold OR NOT p.track_inventory',
        low: 'p.track_inventory AND p.quantity > 0 AND p.quantity <= p.low_stock_threshold',
        out: 'p.track_inventory AND p.quantity <= 0',
      };
      const params: unknown[] = [];
      let whereSql = buildWhere({ ...(q as ProductFilters), status: q.status }, params);
      if (q.stock) whereSql += `${whereSql ? ' AND' : 'WHERE'} (${stockFilter[q.stock]})`;
      const total = Number((await query(`SELECT count(*) ${PRODUCT_FROM} ${whereSql}`, params)).rows[0].count);
      const limit = q.limit || 20;
      const rows = (
        await query<ProductRow>(
          `${PRODUCT_SELECT} ${whereSql} ORDER BY ${SORTS[q.sort || 'newest']}
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, ((q.page || 1) - 1) * limit]
        )
      ).rows;
      const counts = (
        await query(
          `SELECT count(*)::int AS all, count(*) FILTER (WHERE status = 'published')::int AS published,
             count(*) FILTER (WHERE status = 'draft')::int AS draft,
             count(*) FILTER (WHERE track_inventory AND quantity > 0 AND quantity <= low_stock_threshold)::int AS low,
             count(*) FILTER (WHERE track_inventory AND quantity <= 0)::int AS out
           FROM products`
        )
      ).rows[0];
      res.set('X-Total-Count', String(total));
      ok(res, { total, counts, products: await hydrate(rows) });
    })
  );

  router.get(
    '/products/:id',
    canSeeProducts,
    handler(async (req, res) => {
      const product = await loadProduct(Number(req.params.id));
      if (!product) fail(404, 'Product not found.');
      ok(res, product);
    })
  );

  router.post(
    '/products',
    requirePermission('catalog.products.create'),
    handler(async (req, res) => {
      const b = parse(productBody, req.body);
      const id = await saveProduct(b, null);
      audit(req, 'catalog.product_created', `product:${id}`, { name: b.name });
      ok(res, await loadProduct(id), 201);
    })
  );

  router.put(
    '/products/:id',
    requirePermission('catalog.products.update'),
    handler(async (req, res) => {
      const existing = await loadProduct(Number(req.params.id));
      if (!existing) fail(404, 'Product not found.');
      const current = existing!;
      // Partial updates: anything not sent keeps its current value.
      const b = parse(productBody, {
        ...current,
        category_id: current.category[0]?.category_id ?? null,
        brand_id: current.brand?.brand_id ?? null,
        variants: undefined,
        ...req.body,
      });
      await saveProduct(b, current.product_id);
      audit(req, 'catalog.product_updated', `product:${current.product_id}`, { fields: Object.keys(req.body || {}) });
      ok(res, await loadProduct(current.product_id));
    })
  );

  router.delete(
    '/products/:id',
    requirePermission('catalog.products.delete'),
    handler(async (req, res) => {
      const { rowCount } = await query('DELETE FROM products WHERE id = $1', [Number(req.params.id)]);
      if (!rowCount) fail(404, 'Product not found.');
      audit(req, 'catalog.product_deleted', `product:${req.params.id}`);
      ok(res, true);
    })
  );

  // Tags in use, for suggestions while editing.
  router.get(
    '/product_tags',
    canSeeProducts,
    handler(async (_req, res) => {
      const rows = (
        await query(`SELECT t AS tag, count(*)::int AS count FROM products, unnest(tags) t GROUP BY t ORDER BY count(*) DESC, t`)
      ).rows;
      ok(res, rows);
    })
  );

  // ---------- brands (managed with the category permissions) ----------
  const brandBody = z.object({
    name: z.string().trim().min(1, 'Please enter a brand name.').max(150),
    logo: z.union([imageUrl, z.literal('')]).default(''),
  });

  const BRAND_SELECT = `SELECT b.id, b.name, b.logo,
      (SELECT count(*)::int FROM products p WHERE p.brand_id = b.id) AS product_count FROM brands b`;
  const brandOut = (b: { id: number; name: string; logo: string; product_count: number }) => ({
    brand_id: b.id, name: b.name, logo: b.logo, product_count: b.product_count,
  });
  const loadBrand = async (id: number) => brandOut((await query(`${BRAND_SELECT} WHERE b.id = $1`, [id])).rows[0]);

  router.get(
    '/brands',
    handler(async (_req, res) => {
      ok(res, (await query(`${BRAND_SELECT} ORDER BY lower(b.name)`)).rows.map(brandOut));
    })
  );

  router.post(
    '/brands',
    requirePermission('catalog.categories.create'),
    handler(async (req, res) => {
      const b = parse(brandBody, req.body);
      const id = await query<{ id: number }>('INSERT INTO brands (name, logo) VALUES ($1, $2) RETURNING id', [b.name, b.logo])
        .then((r) => r.rows[0].id)
        .catch(uniqueViolation);
      audit(req, 'catalog.brand_created', `brand:${id}`, { name: b.name });
      ok(res, await loadBrand(id), 201);
    })
  );

  router.put(
    '/brands/:id',
    requirePermission('catalog.categories.update'),
    handler(async (req, res) => {
      const id = Number(req.params.id);
      if (!(await query('SELECT 1 FROM brands WHERE id = $1', [id])).rows[0]) fail(404, 'Brand not found.');
      const b = parse(brandBody.partial(), req.body);
      await query('UPDATE brands SET name = COALESCE($2, name), logo = COALESCE($3, logo) WHERE id = $1', [
        id, b.name ?? null, b.logo ?? null,
      ]).catch(uniqueViolation);
      audit(req, 'catalog.brand_updated', `brand:${id}`);
      ok(res, await loadBrand(id));
    })
  );

  router.delete(
    '/brands/:id',
    requirePermission('catalog.categories.delete'),
    handler(async (req, res) => {
      const id = Number(req.params.id);
      const { rowCount } = await query('DELETE FROM brands WHERE id = $1', [id]);
      if (!rowCount) fail(404, 'Brand not found.');
      audit(req, 'catalog.brand_deleted', `brand:${id}`);
      ok(res, true);
    })
  );

  // ---------- categories ----------
  const categoryBody = z.object({
    name: z.string().trim().min(1, 'Please enter a category name.').max(150),
    image: z.string().trim().max(2000).default(''),
    subcategories: z.array(z.string().trim()).default([]),
  });

  const replaceSubcategories = async (parentId: number, names: string[]) => {
    const wanted = names.filter(Boolean);
    const current = (await query<{ id: number; name: string }>(
      'SELECT id, name FROM categories WHERE parent_id = $1', [parentId]
    )).rows;
    // Keep existing children with the same name so their products stay attached.
    for (const child of current) {
      if (!wanted.includes(child.name)) {
        const used = (await query('SELECT 1 FROM products WHERE category_id = $1 LIMIT 1', [child.id])).rows[0];
        if (used) fail(409, `“${child.name}” still has products. Move or delete them first.`);
        await query('DELETE FROM categories WHERE id = $1', [child.id]);
      }
    }
    for (const name of wanted) {
      if (!current.some((c) => c.name === name)) {
        await query('INSERT INTO categories (name, parent_id) VALUES ($1, $2)', [name, parentId]);
      }
    }
  };

  router.post(
    '/categories',
    requirePermission('catalog.categories.create'),
    handler(async (req, res) => {
      const b = parse(categoryBody, req.body);
      const { rows } = await query<{ id: number }>(
        'INSERT INTO categories (name, image) VALUES ($1, $2) RETURNING id', [b.name, b.image]
      );
      await replaceSubcategories(rows[0].id, b.subcategories);
      audit(req, 'catalog.category_created', `category:${rows[0].id}`, { name: b.name });
      ok(res, await loadCategoryTree(rows[0].id), 201);
    })
  );

  router.put(
    '/categories/:id',
    requirePermission('catalog.categories.update'),
    handler(async (req, res) => {
      const id = Number(req.params.id);
      const existing = (await query('SELECT * FROM categories WHERE id = $1', [id])).rows[0];
      if (!existing) fail(404, 'Category not found.');
      const b = parse(categoryBody.partial(), req.body);
      await query(
        'UPDATE categories SET name = COALESCE($2, name), image = COALESCE($3, image) WHERE id = $1',
        [id, b.name ?? null, b.image ?? null]
      );
      if (b.subcategories) await replaceSubcategories(id, b.subcategories);
      audit(req, 'catalog.category_updated', `category:${id}`);
      ok(res, await loadCategoryTree(id));
    })
  );

  router.delete(
    '/categories/:id',
    requirePermission('catalog.categories.delete'),
    handler(async (req, res) => {
      const id = Number(req.params.id);
      if (!(await query('SELECT 1 FROM categories WHERE id = $1', [id])).rows[0]) fail(404, 'Category not found.');
      const used = (
        await query(
          `WITH RECURSIVE tree AS (SELECT id FROM categories WHERE id = $1
             UNION ALL SELECT c.id FROM categories c JOIN tree t ON c.parent_id = t.id)
           SELECT 1 FROM products WHERE category_id IN (SELECT id FROM tree) LIMIT 1`,
          [id]
        )
      ).rows[0];
      if (used) fail(409, 'This category still has products. Move or delete them first.');
      await query('DELETE FROM categories WHERE id = $1', [id]);
      audit(req, 'catalog.category_deleted', `category:${id}`);
      ok(res, true);
    })
  );

  // ---------- files ----------
  router.post(
    '/files',
    requirePermission('catalog.files.upload'),
    singleImage,
    handler(async (req, res) => {
      if (!req.file) fail(400, 'Please choose a file to upload.');
      const url = uploadedUrl(req.file!);
      audit(req, 'catalog.file_uploaded', url, { size: req.file!.size });
      ok(res, { url, filename: req.file!.originalname, size: req.file!.size }, 201);
    })
  );

  return router;
};
