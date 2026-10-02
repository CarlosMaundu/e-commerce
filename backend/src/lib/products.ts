// src/lib/products.ts — loading products (with brand and variants), their
// contract shape, storefront filters, and resolving a shopper's choice of
// options to a variant with its own price and stock.
import { query } from '../db';
import { fail } from './http';

export interface Attribute {
  name: string;
  values: string[];
}

export interface VariantRow {
  id: number;
  product_id: number;
  options: Record<string, string>;
  sku: string | null;
  price: string | null;
  special: string | null;
  quantity: number;
  images: string[];
  position: number;
}

export interface ProductRow {
  id: number;
  name: string;
  description: string;
  price: string;
  special: string | null;
  quantity: number;
  category_id: number | null;
  category_name: string | null;
  brand_id: number | null;
  brand_name: string | null;
  brand_logo: string | null;
  images: string[];
  attributes: Attribute[];
  sku: string | null;
  status: 'published' | 'draft';
  featured: boolean;
  tags: string[];
  track_inventory: boolean;
  low_stock_threshold: number;
  rating: string;
  reviews: number;
  created_at: Date;
  updated_at: Date;
}

export const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name, b.name AS brand_name, b.logo AS brand_logo
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN brands b ON b.id = p.brand_id`;

/** Untracked products never run out. */
export const UNLIMITED = 9999;
export const stockOf = (trackInventory: boolean, quantity: number) =>
  trackInventory ? quantity : UNLIMITED;

const num = (v: string | null) => (v === null ? null : Number(v));

const toContractVariant = (v: VariantRow, p: ProductRow) => {
  const ownPrice = v.price !== null;
  const price = ownPrice ? Number(v.price) : Number(p.price);
  const special = ownPrice ? num(v.special) : num(p.special);
  return {
    variant_id: v.id,
    options: v.options,
    sku: v.sku,
    price,
    special,
    own_price: ownPrice,
    quantity: v.quantity,
    in_stock: stockOf(p.track_inventory, v.quantity) > 0,
    images: v.images,
  };
};

export const toContractProduct = (p: ProductRow, variants: VariantRow[] = []) => {
  const stock = stockOf(p.track_inventory, p.quantity);
  return {
    product_id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    special: num(p.special),
    image: p.images[0] || '',
    images: p.images,
    category: p.category_id ? [{ category_id: p.category_id, name: p.category_name }] : [],
    brand: p.brand_id ? { brand_id: p.brand_id, name: p.brand_name, logo: p.brand_logo || '' } : null,
    manufacturer: p.brand_name || '',
    sku: p.sku,
    status: p.status,
    featured: p.featured,
    tags: p.tags,
    attributes: p.attributes,
    variants: variants.map((v) => toContractVariant(v, p)),
    quantity: p.quantity,
    track_inventory: p.track_inventory,
    low_stock_threshold: p.low_stock_threshold,
    in_stock: stock > 0,
    low_stock: p.track_inventory && p.quantity > 0 && p.quantity <= p.low_stock_threshold,
    rating: Number(p.rating),
    reviews: p.reviews,
    date_added: p.created_at,
    date_modified: p.updated_at,
  };
};

export type ContractProduct = ReturnType<typeof toContractProduct>;

/** Loads variants for many products in one query. */
export const loadVariants = async (productIds: number[]) => {
  const byProduct = new Map<number, VariantRow[]>();
  if (!productIds.length) return byProduct;
  const { rows } = await query<VariantRow>(
    'SELECT * FROM product_variants WHERE product_id = ANY($1::int[]) ORDER BY position, id',
    [productIds]
  );
  for (const v of rows) {
    if (!byProduct.has(v.product_id)) byProduct.set(v.product_id, []);
    byProduct.get(v.product_id)!.push(v);
  }
  return byProduct;
};

export const hydrate = async (rows: ProductRow[]) => {
  const variants = await loadVariants(rows.map((r) => r.id));
  return rows.map((r) => toContractProduct(r, variants.get(r.id) || []));
};

export const loadProduct = async (id: number, { publishedOnly = false } = {}) => {
  if (!Number.isInteger(id)) return null;
  const row = (
    await query<ProductRow>(
      `${PRODUCT_SELECT} WHERE p.id = $1 ${publishedOnly ? "AND p.status = 'published'" : ''}`,
      [id]
    )
  ).rows[0];
  return row ? (await hydrate([row]))[0] : null;
};

// ---------- filtering ----------

export interface ProductFilters {
  search?: string;
  category?: number;
  brand?: number[];
  price_min?: number;
  price_max?: number;
  rating?: number;
  in_stock?: boolean;
  on_sale?: boolean;
  featured?: boolean;
  tag?: string;
  attr?: Record<string, string[]>;
  status?: 'published' | 'draft';
}

export const SORTS: Record<string, string> = {
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'COALESCE(p.special, p.price) ASC, p.id',
  price_desc: 'COALESCE(p.special, p.price) DESC, p.id',
  rating: 'p.rating DESC, p.reviews DESC, p.id DESC',
  name: 'lower(p.name) ASC, p.id',
  // Views over the last 7 days, then rating, so the list is never empty.
  popular: `(SELECT COALESCE(sum(v.views), 0) FROM product_views v
             WHERE v.product_id = p.id AND v.day > current_date - 7) DESC,
            p.rating DESC, p.id DESC`,
  stock_asc: 'p.quantity ASC, p.id',
  stock_desc: 'p.quantity DESC, p.id',
};

/** Builds a WHERE clause; `params` is filled in place. */
export const buildWhere = (f: ProductFilters, params: unknown[]) => {
  const where: string[] = [];
  const bind = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  if (f.status) where.push(`p.status = ${bind(f.status)}`);
  if (f.search) {
    const s = bind(`%${f.search}%`);
    const exact = bind(f.search.toLowerCase());
    where.push(`(p.name ILIKE ${s} OR p.description ILIKE ${s} OR p.sku ILIKE ${s}
      OR b.name ILIKE ${s} OR ${exact} = ANY(SELECT lower(t) FROM unnest(p.tags) t))`);
  }
  if (f.category) {
    where.push(`p.category_id IN (WITH RECURSIVE tree AS (
        SELECT id FROM categories WHERE id = ${bind(f.category)}
        UNION ALL SELECT c.id FROM categories c JOIN tree t ON c.parent_id = t.id
      ) SELECT id FROM tree)`);
  }
  if (f.brand?.length) where.push(`p.brand_id = ANY(${bind(f.brand)}::int[])`);
  if (f.price_min !== undefined) where.push(`COALESCE(p.special, p.price) >= ${bind(f.price_min)}`);
  if (f.price_max !== undefined) where.push(`COALESCE(p.special, p.price) <= ${bind(f.price_max)}`);
  if (f.rating) where.push(`p.rating >= ${bind(f.rating)}`);
  if (f.in_stock) where.push('(p.quantity > 0 OR NOT p.track_inventory)');
  if (f.on_sale) {
    where.push(`(p.special IS NOT NULL OR EXISTS (SELECT 1 FROM product_variants pv
      WHERE pv.product_id = p.id AND pv.special IS NOT NULL))`);
  }
  if (f.featured) where.push('p.featured');
  if (f.tag) where.push(`${bind(f.tag.toLowerCase())} = ANY(SELECT lower(t) FROM unnest(p.tags) t)`);
  for (const [name, values] of Object.entries(f.attr || {})) {
    if (!values.length) continue;
    where.push(`EXISTS (SELECT 1 FROM jsonb_array_elements(p.attributes) a
      WHERE lower(a->>'name') = lower(${bind(name)}) AND a->'values' ?| ${bind(values)}::text[])`);
  }
  return where.length ? `WHERE ${where.join(' AND ')}` : '';
};

// ---------- choosing options ----------

/** Keeps only the product's attributes, in its order, with trimmed values. */
export const cleanOptions = (attributes: Attribute[], raw: Record<string, unknown>) => {
  const lower = new Map(Object.entries(raw || {}).map(([k, v]) => [k.toLowerCase(), String(v ?? '').trim()]));
  const clean: Record<string, string> = {};
  for (const a of attributes) {
    const value = lower.get(a.name.toLowerCase());
    if (value) clean[a.name] = value;
  }
  return clean;
};

const sameOptions = (a: Record<string, string>, b: Record<string, string>) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

export interface ResolvedItem {
  productId: number;
  name: string;
  options: Record<string, string>;
  variantId: number | null;
  stock: number;
}

/**
 * Checks that a shopper chose every option, with real values, and finds the
 * matching variant. Throws a friendly 400/404/409 otherwise.
 */
export const resolveItem = async (
  productId: number,
  rawOptions: Record<string, unknown>,
  db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> } = { query: (t, p) => query(t, p) }
): Promise<ResolvedItem> => {
  const product = (
    await db.query(
      `SELECT id, name, quantity, attributes, track_inventory, status FROM products WHERE id = $1`,
      [productId]
    )
  ).rows[0];
  if (!product || product.status !== 'published') fail(404, 'That product is no longer available.');
  const attributes: Attribute[] = product.attributes;
  const options = cleanOptions(attributes, rawOptions);
  for (const a of attributes) {
    if (!options[a.name]) fail(400, `Please choose a ${a.name.toLowerCase()}.`);
    if (!a.values.includes(options[a.name])) {
      fail(400, `“${options[a.name]}” isn’t an available ${a.name.toLowerCase()} for “${product.name}”.`);
    }
  }
  const variants: VariantRow[] = (
    await db.query('SELECT * FROM product_variants WHERE product_id = $1', [productId])
  ).rows;
  if (!variants.length) {
    return { productId, name: product.name, options, variantId: null, stock: stockOf(product.track_inventory, product.quantity) };
  }
  const variant = variants.find((v) => sameOptions(v.options, options));
  const label = Object.values(options).join(' / ');
  if (!variant) fail(409, `“${product.name}” isn’t made in ${label}.`);
  return {
    productId,
    name: `${product.name} (${label})`,
    options,
    variantId: variant!.id,
    stock: stockOf(product.track_inventory, variant!.quantity),
  };
};

type Db = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

/** A product with variants has the sum of their stock. */
export const syncProductQuantity = async (db: Db, productId: number) => {
  await db.query(
    `UPDATE products p SET quantity = s.total, updated_at = now()
     FROM (SELECT sum(quantity)::int AS total FROM product_variants WHERE product_id = $1) s
     WHERE p.id = $1 AND s.total IS NOT NULL`,
    [productId]
  );
};

/** Takes stock for one order line; false when there isn't enough. */
export const takeStock = async (db: Db, item: { product_id: number; variant_id: number | null; quantity: number }) => {
  const product = (
    await db.query('SELECT quantity, track_inventory FROM products WHERE id = $1 FOR UPDATE', [item.product_id])
  ).rows[0];
  if (!product) return false;
  if (!product.track_inventory) return true;
  if (item.variant_id) {
    const variant = (
      await db.query('SELECT quantity FROM product_variants WHERE id = $1 FOR UPDATE', [item.variant_id])
    ).rows[0];
    if (!variant || variant.quantity < item.quantity) return false;
    await db.query('UPDATE product_variants SET quantity = quantity - $2 WHERE id = $1', [item.variant_id, item.quantity]);
    await syncProductQuantity(db, item.product_id);
    return true;
  }
  if (product.quantity < item.quantity) return false;
  await db.query('UPDATE products SET quantity = quantity - $2, updated_at = now() WHERE id = $1', [item.product_id, item.quantity]);
  return true;
};

/** Puts stock back for every line of an order (cancellations). */
export const returnStock = async (db: Db, orderId: number) => {
  const items = (
    await db.query(
      `SELECT oi.product_id, oi.variant_id, oi.quantity FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1 AND p.track_inventory`,
      [orderId]
    )
  ).rows;
  for (const item of items) {
    if (item.variant_id) {
      await db.query('UPDATE product_variants SET quantity = quantity + $2 WHERE id = $1', [item.variant_id, item.quantity]);
      await syncProductQuantity(db, item.product_id);
    } else {
      await db.query('UPDATE products SET quantity = quantity + $2, updated_at = now() WHERE id = $1', [item.product_id, item.quantity]);
    }
  }
};

/** Recomputes a product's average rating and review count. */
export const refreshRating = async (db: Db, productId: number) => {
  await db.query(
    `UPDATE products p SET rating = COALESCE(s.avg, 0), reviews = s.n
     FROM (SELECT round(avg(rating)::numeric, 1) AS avg, count(*)::int AS n
           FROM product_reviews WHERE product_id = $1) s
     WHERE p.id = $1`,
    [productId]
  );
};
