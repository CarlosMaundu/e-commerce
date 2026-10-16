-- 027_outbox_indexes.sql — emails go through an outbox (saved, then sent and
-- retried in the background, so a slow or down mail server never breaks a
-- request), and indexes the reports need as orders grow.
CREATE TABLE email_outbox (
  id               BIGSERIAL PRIMARY KEY,
  to_address       VARCHAR(255) NOT NULL,
  subject          VARCHAR(300) NOT NULL,
  body             TEXT NOT NULL,
  attempts         INT NOT NULL DEFAULT 0,
  next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at          TIMESTAMPTZ,
  last_error       TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_outbox_due ON email_outbox (next_attempt_at) WHERE sent_at IS NULL;

-- Reports: by date, for returns, paid refunds, support requests, sign-ups,
-- stock movements by reason, and order lines by variant.
CREATE INDEX IF NOT EXISTS returns_created ON returns (created_at);
CREATE INDEX IF NOT EXISTS refunds_processed ON refunds (processed_at) WHERE status = 'processed';
CREATE INDEX IF NOT EXISTS support_tickets_created ON support_tickets (created_at);
CREATE INDEX IF NOT EXISTS users_created ON users (created_at);
CREATE INDEX IF NOT EXISTS stock_movements_reason ON stock_movements (reason, created_at);
CREATE INDEX IF NOT EXISTS order_items_variant ON order_items (variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_currency_placed ON orders (currency, placed_at) WHERE placed_at IS NOT NULL;
