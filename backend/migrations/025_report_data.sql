-- 025_report_data.sql — data for reports: cost prices (for margins), what
-- shoppers search for, and every stock movement.

-- Cost price per product and variant; each order line keeps the cost at the
-- time of sale, so later changes don't rewrite past margins.
ALTER TABLE products ADD COLUMN cost_price NUMERIC(12, 2) CHECK (cost_price IS NULL OR cost_price >= 0);
ALTER TABLE product_variants ADD COLUMN cost_price NUMERIC(12, 2) CHECK (cost_price IS NULL OR cost_price >= 0);
ALTER TABLE order_items ADD COLUMN unit_cost NUMERIC(12, 2);

CREATE FUNCTION order_item_cost() RETURNS trigger AS $$
BEGIN
  IF NEW.unit_cost IS NULL THEN
    NEW.unit_cost := COALESCE(
      (SELECT cost_price FROM product_variants WHERE id = NEW.variant_id),
      (SELECT cost_price FROM products WHERE id = NEW.product_id)
    );
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER order_items_cost BEFORE INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION order_item_cost();

-- Shop searches (one per search, not per keystroke) and how many results.
CREATE TABLE search_queries (
  id          BIGSERIAL PRIMARY KEY,
  term        VARCHAR(120) NOT NULL,
  normalized  VARCHAR(120) NOT NULL,                     -- lower-case, single spaces
  results     INT NOT NULL,
  user_id     INT,
  visitor     VARCHAR(64) NOT NULL DEFAULT '',            -- hashed IP + agent, to count each search once
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX search_queries_time ON search_queries (created_at);
CREATE INDEX search_queries_term ON search_queries (normalized);

-- Every change to stock, with why (sale, cancellation, return, adjustment…).
-- Code that changes stock for a reason sets app.stock_reason / app.stock_order
-- / app.stock_user for its transaction; anything else is an adjustment.
CREATE TABLE stock_movements (
  id              BIGSERIAL PRIMARY KEY,
  product_id      INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id      INT REFERENCES product_variants(id) ON DELETE CASCADE,
  change          INT NOT NULL,
  quantity_after  INT NOT NULL,
  reason          VARCHAR(20) NOT NULL,                    -- initial, sale, cancelled, returned, adjustment
  order_id        INT,
  user_id         INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_product ON stock_movements (product_id, created_at);
CREATE INDEX stock_movements_time ON stock_movements (created_at);

CREATE FUNCTION log_stock_movement(pid INT, vid INT, diff INT, after INT, fallback TEXT) RETURNS void AS $$
BEGIN
  IF diff = 0 THEN RETURN; END IF;
  INSERT INTO stock_movements (product_id, variant_id, change, quantity_after, reason, order_id, user_id)
  VALUES (
    pid, vid, diff, after,
    COALESCE(NULLIF(current_setting('app.stock_reason', true), ''), fallback),
    NULLIF(current_setting('app.stock_order', true), '')::int,
    NULLIF(current_setting('app.stock_user', true), '')::int
  );
END $$ LANGUAGE plpgsql;

-- Variants: every change. Products: only those without variants (a product
-- with variants keeps the sum of its variants, already logged).
CREATE FUNCTION variant_stock() RETURNS trigger AS $$
BEGIN
  PERFORM log_stock_movement(NEW.product_id, NEW.id,
    NEW.quantity - CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE OLD.quantity END, NEW.quantity,
    CASE WHEN TG_OP = 'INSERT' THEN 'initial' ELSE 'adjustment' END);
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER variants_stock AFTER INSERT OR UPDATE OF quantity ON product_variants
  FOR EACH ROW EXECUTE FUNCTION variant_stock();

CREATE FUNCTION product_stock() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM product_variants WHERE product_id = NEW.id) THEN RETURN NEW; END IF;
  PERFORM log_stock_movement(NEW.id, NULL, NEW.quantity - OLD.quantity, NEW.quantity, 'adjustment');
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER products_stock AFTER UPDATE OF quantity ON products
  FOR EACH ROW EXECUTE FUNCTION product_stock();

-- A new product's opening stock, checked when its transaction ends (by then
-- its variants, if any, exist and log their own).
CREATE FUNCTION product_opening_stock() RETURNS trigger AS $$
DECLARE qty INT; logged INT;
BEGIN
  IF EXISTS (SELECT 1 FROM product_variants WHERE product_id = NEW.id) THEN RETURN NULL; END IF;
  SELECT quantity INTO qty FROM products WHERE id = NEW.id;
  IF qty IS NULL THEN RETURN NULL; END IF;  -- deleted in the same transaction
  -- Whatever later changes in the transaction don't already explain.
  SELECT COALESCE(sum(change), 0) INTO logged FROM stock_movements WHERE product_id = NEW.id;
  INSERT INTO stock_movements (product_id, change, quantity_after, reason, user_id)
  SELECT NEW.id, qty - logged, qty, 'initial', NULLIF(current_setting('app.stock_user', true), '')::int
  WHERE qty - logged <> 0;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER products_opening_stock AFTER INSERT ON products
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION product_opening_stock();

-- Today's stock as the starting point for products that already exist.
INSERT INTO stock_movements (product_id, variant_id, change, quantity_after, reason)
  SELECT product_id, id, quantity, quantity, 'initial' FROM product_variants WHERE quantity <> 0;
INSERT INTO stock_movements (product_id, variant_id, change, quantity_after, reason)
  SELECT p.id, NULL, p.quantity, p.quantity, 'initial' FROM products p
  WHERE p.quantity <> 0 AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id);
