-- 006_store_and_status.sql — product lifecycle (Active, Inactive, Draft,
-- Archived) with a publish date, and the shop's own settings.

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products ADD CONSTRAINT products_status_check
  CHECK (status IN ('published', 'inactive', 'draft', 'archived'));
-- First time a product went live; kept when it's later deactivated.
ALTER TABLE products ADD COLUMN published_at TIMESTAMPTZ;
UPDATE products SET published_at = created_at WHERE status = 'published';

-- Shop name, logo, favicon and contact details, edited in the back office.
CREATE TABLE store_settings (
  id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings    JSONB NOT NULL,
  updated_by  INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
