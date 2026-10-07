-- 003_catalog.sql — richer catalog: brands with logos, product variants
-- (attribute combinations with their own price, stock and images), tags,
-- publish status, inventory settings, reviews, weekly view counts and
-- storefront promotions.

-- ---------- brands ----------
CREATE TABLE brands (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  logo        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX brands_name_key ON brands (lower(name));

INSERT INTO brands (name)
SELECT DISTINCT trim(manufacturer) FROM products WHERE trim(manufacturer) <> ''
ON CONFLICT DO NOTHING;

-- ---------- products ----------
ALTER TABLE products
  ADD COLUMN brand_id            INT REFERENCES brands(id) ON DELETE SET NULL,
  ADD COLUMN sku                 VARCHAR(64),
  ADD COLUMN status              VARCHAR(10) NOT NULL DEFAULT 'published'
                                 CHECK (status IN ('published', 'draft')),
  ADD COLUMN featured            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN tags                TEXT[] NOT NULL DEFAULT '{}',
  -- [{ "name": "Color", "values": ["Black", "Red"] }, { "name": "Size", … }]
  ADD COLUMN attributes          JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN track_inventory     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN low_stock_threshold INT NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0);

UPDATE products p SET brand_id = b.id
FROM brands b WHERE lower(b.name) = lower(trim(p.manufacturer));

-- The old { sizes, colors } options become generic attributes.
UPDATE products SET attributes = (
  SELECT COALESCE(jsonb_agg(a), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('name', 'Size', 'values', options->'sizes') AS a
      WHERE jsonb_array_length(COALESCE(options->'sizes', '[]')) > 0
    UNION ALL
    SELECT jsonb_build_object('name', 'Color', 'values', options->'colors')
      WHERE jsonb_array_length(COALESCE(options->'colors', '[]')) > 0
  ) attrs
);

ALTER TABLE products DROP COLUMN manufacturer, DROP COLUMN options;
-- rating and reviews are now kept in step with product_reviews.
UPDATE products SET rating = 0, reviews = 0;

CREATE UNIQUE INDEX products_sku_key ON products (lower(sku)) WHERE sku IS NOT NULL;
CREATE INDEX products_status_idx ON products (status);
CREATE INDEX products_brand_idx ON products (brand_id);
CREATE INDEX products_tags_idx ON products USING GIN (tags);

-- ---------- variants ----------
-- One row per attribute combination, e.g. { "Color": "Black", "Size": "L" }.
-- price/special NULL = use the product's. When a product has variants, its
-- quantity is the sum of theirs (kept in step by the API).
CREATE TABLE product_variants (
  id          SERIAL PRIMARY KEY,
  product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  options     JSONB NOT NULL,
  sku         VARCHAR(64),
  price       NUMERIC(12, 2) CHECK (price IS NULL OR price > 0),
  special     NUMERIC(12, 2) CHECK (special IS NULL OR special > 0),
  quantity    INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  images      JSONB NOT NULL DEFAULT '[]',
  position    INT NOT NULL DEFAULT 0,
  UNIQUE (product_id, options)
);
CREATE UNIQUE INDEX product_variants_sku_key ON product_variants (lower(sku)) WHERE sku IS NOT NULL;

ALTER TABLE cart_items
  ADD COLUMN variant_id INT REFERENCES product_variants(id) ON DELETE CASCADE;
ALTER TABLE order_items
  ADD COLUMN variant_id INT REFERENCES product_variants(id) ON DELETE SET NULL;

-- Option keys follow the attribute names now ("Size", not "size").
UPDATE cart_items SET options = jsonb_strip_nulls(
  jsonb_build_object('Size', options->>'size', 'Color', options->>'color'))
WHERE options ?| ARRAY['size', 'color'];
UPDATE order_items SET options = jsonb_strip_nulls(
  jsonb_build_object('Size', options->>'size', 'Color', options->>'color'))
WHERE options ?| ARRAY['size', 'color'];

-- ---------- reviews ----------
CREATE TABLE product_reviews (
  id          SERIAL PRIMARY KEY,
  product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  author      VARCHAR(100) NOT NULL,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       VARCHAR(150) NOT NULL DEFAULT '',
  text        TEXT NOT NULL,
  verified    BOOLEAN NOT NULL DEFAULT false,  -- bought and received it
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_reviews_product_idx ON product_reviews (product_id, created_at DESC);
CREATE UNIQUE INDEX product_reviews_one_per_user ON product_reviews (product_id, user_id)
  WHERE user_id IS NOT NULL;

-- ---------- views (for "Best viewed this week") ----------
CREATE TABLE product_views (
  product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  day         DATE NOT NULL DEFAULT current_date,
  views       INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, day)
);

-- ---------- promotions (storefront offer strip) ----------
CREATE TABLE promotions (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(120) NOT NULL,
  subtitle    VARCHAR(200) NOT NULL DEFAULT '',
  code        VARCHAR(40) REFERENCES coupons(code) ON DELETE SET NULL,
  link        VARCHAR(500) NOT NULL DEFAULT '/products',  -- e.g. /products?on_sale=1
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,      -- NULL = a daily deal that resets at midnight
  active      BOOLEAN NOT NULL DEFAULT true,
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
