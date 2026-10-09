// src/routes/adminCatalog.ts — /api/admin/products, /categories, /files
import { relatedMatch } from '../lib/search';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { query, transaction } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { cleanRichText } from '../lib/richText';
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
  PRODUCT_STATUSES,
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

const specRow = z.object({
  label: z.string().trim().min(1, 'Each detail needs a name.').max(60),
  value: z.string().trim().min(1, 'Each detail needs a value.').max(200),
});

const variantSchema = z.object({
  options: z.record(z.string().trim().max(60)),
  sku: optionalText(64),
  price: z.coerce.number().positive('Variant prices must be greater than zero.').nullable().optional(),
  special: z.coerce.number().positive('Variant sale prices must be greater than zero.').nullable().optional(),
  quantity: z.coerce.number().int().min(0, 'Stock can’t be negative.').default(0),
  images: z.array(imageUrl).max(6, 'You can add up to 6 images per variant.').default([]),
  // Variant-specific content (used when the product's variant_content is on).
  description: z
    .string()
    .max(40000)
    .nullable()
    .optional()
    .transform((v) => (v && v.trim() ? cleanRichText(v) || null : null)),
  specs: z.array(specRow).max(30, 'You can add up to 30 details per variant.').default([]),
});

// A positive size or weight; blank means not given.
const measure = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.coerce.number({ invalid_type_error: 'Please enter a number.' }).positive('Sizes and weights must be greater than zero.').nullable()
);

const productBody = z.object({
  name: z.string().trim().min(1, 'Please enter a product name.').max(255),
  description: z.string().max(40000).default('').transform(cleanRichText),
  price: z.coerce.number({ invalid_type_error: 'Please enter a price greater than zero.' }).positive('Please enter a price greater than zero.'),
  special: z.coerce.number().positive().nullable().optional(),
  quantity: z.coerce.number().int().min(0, 'Stock can’t be negative.').default(0),
  category_id: z.coerce.number().int().positive().nullable().optional(),
  brand_id: z.coerce.number().int().positive().nullable().optional(),
  images: z.array(imageUrl).max(10, 'You can add up to 10 images.').default([]),
  sku: optionalText(64),
  status: z.enum(PRODUCT_STATUSES).default('published'),
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
  // Vital info and product information.
  manufacturer: z.string().trim().max(120).default(''),
  barcode_type: z.enum(['', 'UPC', 'EAN', 'GTIN', 'ISBN']).default(''),
  barcode: z.string().trim().max(32).regex(/^[0-9A-Za-z-]*$/, 'Product IDs use digits, letters and dashes only.').default(''),
  mfr_part_number: z.string().trim().max(64).default(''),
  length: measure.nullable().optional(),
  width: measure.nullable().optional(),
  height: measure.nullable().optional(),
  dimension_unit: z.enum(['mm', 'cm', 'm', 'in', 'ft']).default('cm'),
  weight: measure.nullable().optional(),
  weight_unit: z.enum(['g', 'kg', 'oz', 'lb']).default('kg'),
  specs: z.array(specRow).max(30, 'You can add up to 30 details.').default([]),
  // Off: one description and spec sheet for every variant.
  variant_content: z.boolean().default(false),
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
        b.manufacturer, b.barcode ? b.barcode_type : '', b.barcode, b.mfr_part_number,
        b.length ?? null, b.width ?? null, b.height ?? null, b.dimension_unit,
        b.weight ?? null, b.weight_unit, JSON.stringify(b.specs), b.variant_content,
      ];
      let productId = id;
      if (productId === null) {
        const { rows } = await db.query(
          `INSERT INTO products (name, description, price, special, quantity, category_id, brand_id, images, sku,
             status, featured, tags, attributes, track_inventory, low_stock_threshold,
             manufacturer, barcode_type, barcode, mfr_part_number, length, width, height, dimension_unit,
             weight, weight_unit, specs, variant_content, published_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text, $11, $12, $13, $14, $15,
             $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
             CASE WHEN $10::text = 'published' THEN now() END) RETURNING id`,
          values
        );
        productId = rows[0].id as number;
      } else {
        await db.query(
          `UPDATE products SET name=$1, description=$2, price=$3, special=$4, quantity=$5, category_id=$6, brand_id=$7,
             images=$8, sku=$9, status=$10::text, featured=$11, tags=$12, attributes=$13, track_inventory=$14,
             low_stock_threshold=$15, manufacturer=$16, barcode_type=$17, barcode=$18, mfr_part_number=$19,
             length=$20, width=$21, height=$22, dimension_unit=$23, weight=$24, weight_unit=$25, specs=$26,
             variant_content=$27, updated_at=now(),
             published_at = COALESCE(published_at, CASE WHEN $10::text = 'published' THEN now() END) WHERE id=$28`,
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
            `INSERT INTO product_variants (product_id, options, sku, price, special, quantity, images, position,
               description, specs)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (product_id, options) DO UPDATE SET sku = EXCLUDED.sku, price = EXCLUDED.price,
               special = EXCLUDED.special, quantity = EXCLUDED.quantity, images = EXCLUDED.images,
               position = EXCLUDED.position, description = EXCLUDED.description, specs = EXCLUDED.specs`,
            [productId, JSON.stringify(v.options), v.sku, v.price ?? null, v.special ?? null, v.quantity,
              JSON.stringify(v.images), position, v.description ?? null, JSON.stringify(v.specs)]
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
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter((x) => (PRODUCT_STATUSES as readonly string[]).includes(x)) : undefined)),
  stock: z.enum(['in', 'low', 'out']).optional(),
});

export const adminCatalogRoutes = () => {
  const router = Router();
  router.use(authenticate);

  const canSeeProducts = requirePermission('catalog.products.view');

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
      const filtered = (search: string | undefined, params: unknown[]) => {
        let w = buildWhere({ ...(q as ProductFilters), search, status: undefined }, params);
        if (q.status?.length) {
          params.push(q.status);
          w += `${w ? ' AND' : 'WHERE'} p.status = ANY($${params.length}::text[])`;
        }
        if (q.stock) w += `${w ? ' AND' : 'WHERE'} (${stockFilter[q.stock]})`;
        return w;
      };
      let params: unknown[] = [];
      let whereSql = filtered(q.search, params);
      let total = Number((await query(`SELECT count(*) ${PRODUCT_FROM} ${whereSql}`, params)).rows[0].count);
      let order = SORTS[q.sort || 'newest'];
      let match: 'exact' | 'related' = 'exact';
      // Nothing found (e.g. a SKU that doesn't exist): related items instead.
      if (!total && q.search) {
        const p2: unknown[] = [];
        const base = filtered(undefined, p2);
        const related = await relatedMatch(q.search, p2);
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
      const limit = q.limit || 20;
      const rows = (
        await query<ProductRow>(
          `${PRODUCT_SELECT} ${whereSql} ORDER BY ${order}
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, ((q.page || 1) - 1) * limit]
        )
      ).rows;
      const counts = (
        await query(
          `SELECT count(*)::int AS all, count(*) FILTER (WHERE status = 'published')::int AS published,
             count(*) FILTER (WHERE status = 'inactive')::int AS inactive,
             count(*) FILTER (WHERE status = 'draft')::int AS draft,
             count(*) FILTER (WHERE status = 'archived')::int AS archived,
             count(*) FILTER (WHERE track_inventory AND quantity > 0 AND quantity <= low_stock_threshold)::int AS low,
             count(*) FILTER (WHERE track_inventory AND quantity <= 0)::int AS out
           FROM products`
        )
      ).rows[0];
      res.set('X-Total-Count', String(total));
      ok(res, { total, match, counts, products: await hydrate(rows) });
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
      // The contract's manufacturer falls back to the brand; keep our own.
      const existingRow = (await query('SELECT manufacturer FROM products WHERE id = $1', [current.product_id])).rows[0];
      // Partial updates: anything not sent keeps its current value.
      const b = parse(productBody, {
        ...current,
        category_id: current.category[0]?.category_id ?? null,
        brand_id: current.brand?.brand_id ?? null,
        // Contract shapes back to the flat input fields.
        manufacturer: existingRow.manufacturer,
        barcode_type: current.barcode?.type ?? '',
        barcode: current.barcode?.value ?? '',
        length: current.dimensions?.length ?? null,
        width: current.dimensions?.width ?? null,
        height: current.dimensions?.height ?? null,
        dimension_unit: current.dimensions?.unit ?? 'cm',
        weight: current.weight?.value ?? null,
        weight_unit: current.weight?.unit ?? 'kg',
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
    requirePermission('catalog.brands.create'),
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
    requirePermission('catalog.brands.update'),
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
    requirePermission('catalog.brands.delete'),
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
    requireAnyPermission('catalog.files.upload', 'admin.settings.manage', 'admin.delivery.manage'),
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
