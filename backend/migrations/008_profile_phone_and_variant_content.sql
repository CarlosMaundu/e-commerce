-- 008: a phone number on the customer's profile, and optional
-- variant-specific content (a variant's own description and specification
-- rows, which replace or add to the product's on the product page).
ALTER TABLE users ADD COLUMN phone VARCHAR(30) NOT NULL DEFAULT '';

ALTER TABLE products ADD COLUMN variant_content BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE product_variants
  ADD COLUMN description TEXT,                         -- null: use the product's
  ADD COLUMN specs JSONB NOT NULL DEFAULT '[]';        -- [{ label, value }]
