-- 014_fuzzy_search.sql — typo-tolerant product search (pg_trgm). Optional:
-- where the extension can't be installed, search falls back to word and SKU
-- matching only (see lib/search.ts).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS products_name_trgm ON products USING gin (lower(name) gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm unavailable: %', SQLERRM;
END $$;
CREATE INDEX IF NOT EXISTS product_variants_sku_lower ON product_variants (lower(sku));
