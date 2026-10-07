-- 012: send an item as a gift (to/from, a free message, an optional paid
-- gift box) — chosen in the cart, copied to the order, and ticked off by
-- staff before dispatch; and a "received" step in the returns process.
ALTER TABLE cart_items ADD COLUMN gift JSONB;          -- { to, from, message, gift_box }
ALTER TABLE order_items ADD COLUMN gift JSONB;         -- the same, plus { done, done_by, done_at }
ALTER TABLE orders ADD COLUMN gift_total NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_status_check;
ALTER TABLE returns ADD CONSTRAINT returns_status_check
  CHECK (status IN ('requested', 'approved', 'received', 'rejected', 'refunded'));
ALTER TABLE returns ADD COLUMN received_at TIMESTAMPTZ;
