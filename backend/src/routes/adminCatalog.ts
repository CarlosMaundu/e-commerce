// src/routes/adminCatalog.ts — /api/admin/products, /categories, /files
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config';
import { query } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, HttpError, ok, parse } from '../lib/http';
import { authenticate, requirePermission } from '../middleware/auth';
import { loadCategoryTree, PRODUCT_SELECT, ProductRow, toContractProduct } from './catalog';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const imageUrl = z
  .string()
  .trim()
  .refine((v) => /^https?:\/\/\S+$/i.test(v) || v.startsWith(`${config.publicUploadsPath}/`), {
    message: 'Please add product images as uploaded files or full https:// links.',
  });

const productBody = z.object({
  name: z.string().trim().min(1, 'Please enter a product name.').max(255),
  description: z.string().max(10000).default(''),
  price: z.coerce.number({ invalid_type_error: 'Please enter a price greater than zero.' }).positive('Please enter a price greater than zero.'),
  special: z.coerce.number().positive().nullable().optional(),
  quantity: z.coerce.number().int().min(0, 'Stock can’t be negative.').default(0),
  category_id: z.coerce.number().int().positive().nullable().optional(),
  images: z.array(imageUrl).max(6, 'You can add up to 6 images.').default([]),
  options: z
    .object({ sizes: z.array(z.string()).default([]), colors: z.array(z.string()).default([]) })
    .default({ sizes: [], colors: [] }),
  manufacturer: z.string().max(150).default(''),
});

const checkSpecial = (price: number, special: number | null | undefined) => {
  if (special !== null && special !== undefined && special >= price) {
    fail(400, 'The sale price must be lower than the regular price.');
  }
};

const checkCategory = async (categoryId: number | null | undefined) => {
  if (categoryId && !(await query('SELECT 1 FROM categories WHERE id = $1', [categoryId])).rows[0]) {
    fail(400, 'Please choose a category that exists.');
  }
};

const loadProduct = async (id: number) =>
  (await query<ProductRow>(`${PRODUCT_SELECT} WHERE p.id = $1`, [id])).rows[0];

export const adminCatalogRoutes = () => {
  const router = Router();
  router.use(authenticate);

  // ---------- products ----------
  router.post(
    '/products',
    requirePermission('catalog.products.create'),
    handler(async (req, res) => {
      const b = parse(productBody, req.body);
      checkSpecial(b.price, b.special);
      await checkCategory(b.category_id);
      const { rows } = await query<{ id: number }>(
        `INSERT INTO products (name, description, price, special, quantity, category_id, images, options, manufacturer)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [b.name, b.description, b.price, b.special ?? null, b.quantity, b.category_id ?? null,
          JSON.stringify(b.images), JSON.stringify(b.options), b.manufacturer]
      );
      audit(req, 'catalog.product_created', `product:${rows[0].id}`, { name: b.name });
      ok(res, toContractProduct(await loadProduct(rows[0].id)), 201);
    })
  );

  router.put(
    '/products/:id',
    requirePermission('catalog.products.update'),
    handler(async (req, res) => {
      const existing = await loadProduct(Number(req.params.id));
      if (!existing) fail(404, 'Product not found.');
      const merged = parse(productBody, {
        ...toContractProduct(existing),
        category_id: existing.category_id,
        ...req.body,
      });
      checkSpecial(merged.price, merged.special);
      await checkCategory(merged.category_id);
      await query(
        `UPDATE products SET name=$2, description=$3, price=$4, special=$5, quantity=$6, category_id=$7,
           images=$8, options=$9, manufacturer=$10, updated_at=now() WHERE id=$1`,
        [existing.id, merged.name, merged.description, merged.price, merged.special ?? null, merged.quantity,
          merged.category_id ?? null, JSON.stringify(merged.images), JSON.stringify(merged.options), merged.manufacturer]
      );
      audit(req, 'catalog.product_updated', `product:${existing.id}`, { fields: Object.keys(req.body || {}) });
      ok(res, toContractProduct(await loadProduct(existing.id)));
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
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  const upload = multer({
    storage: multer.diskStorage({
      destination: config.uploadsDir,
      filename: (_req, file, cb) =>
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${IMAGE_TYPES[file.mimetype]}`),
    }),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    fileFilter: (_req, file, cb) =>
      IMAGE_TYPES[file.mimetype]
        ? cb(null, true)
        : cb(new HttpError(400, ['Please upload a JPG, PNG, WebP or GIF image.'])),
  });

  router.post(
    '/files',
    requirePermission('catalog.files.upload'),
    (req, res, next) =>
      upload.single('file')(req, res, (error: unknown) => {
        if ((error as { code?: string })?.code === 'LIMIT_FILE_SIZE') {
          return next(new HttpError(413, ['That file is too large. Please choose one under 5 MB.']));
        }
        next(error);
      }),
    handler(async (req, res) => {
      if (!req.file) fail(400, 'Please choose a file to upload.');
      const url = `${config.publicUploadsPath}/${path.basename(req.file!.filename)}`;
      audit(req, 'catalog.file_uploaded', url, { size: req.file!.size });
      ok(res, { url, filename: req.file!.originalname, size: req.file!.size }, 201);
    })
  );

  return router;
};
