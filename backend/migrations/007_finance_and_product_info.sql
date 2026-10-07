-- 007: financial configuration (currency, tax, delivery prices) edited in the
-- back office, and product information beyond name and description.

CREATE TABLE finance_settings (
  id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings    JSONB NOT NULL,
  updated_by  INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE products
  ADD COLUMN manufacturer     VARCHAR(120) NOT NULL DEFAULT '',
  ADD COLUMN barcode_type     VARCHAR(10)  NOT NULL DEFAULT ''
    CHECK (barcode_type IN ('', 'UPC', 'EAN', 'GTIN', 'ISBN')),
  ADD COLUMN barcode          VARCHAR(32)  NOT NULL DEFAULT '',
  ADD COLUMN mfr_part_number  VARCHAR(64)  NOT NULL DEFAULT '',
  ADD COLUMN length           NUMERIC(10, 2) CHECK (length IS NULL OR length > 0),
  ADD COLUMN width            NUMERIC(10, 2) CHECK (width IS NULL OR width > 0),
  ADD COLUMN height           NUMERIC(10, 2) CHECK (height IS NULL OR height > 0),
  ADD COLUMN dimension_unit   VARCHAR(4) NOT NULL DEFAULT 'cm'
    CHECK (dimension_unit IN ('mm', 'cm', 'm', 'in', 'ft')),
  ADD COLUMN weight           NUMERIC(10, 3) CHECK (weight IS NULL OR weight > 0),
  ADD COLUMN weight_unit      VARCHAR(4) NOT NULL DEFAULT 'kg'
    CHECK (weight_unit IN ('g', 'kg', 'oz', 'lb')),
  -- Extra details shown under Specifications: [{ label, value }].
  ADD COLUMN specs            JSONB NOT NULL DEFAULT '[]';
