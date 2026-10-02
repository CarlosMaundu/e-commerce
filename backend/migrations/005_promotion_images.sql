-- 005_promotion_images.sql — a background photo for each storefront offer.
ALTER TABLE promotions ADD COLUMN image TEXT NOT NULL DEFAULT '';
