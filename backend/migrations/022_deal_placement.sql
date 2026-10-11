-- 022_deal_placement.sql — where each storefront deal shows: the animated
-- strip under the header, the photo banner on the home page, or both.
ALTER TABLE promotions ADD COLUMN placement VARCHAR(10) NOT NULL DEFAULT 'both'
  CHECK (placement IN ('strip', 'banner', 'both'));
ALTER TABLE promotions ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
