-- 015_sla.sql — fulfilment SLA settings (targets per stage and per delivery
-- option), kept like the delivery settings.
CREATE TABLE sla_settings (
  id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings    JSONB NOT NULL,
  updated_by  INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_history_order_status ON order_history (order_id, status, created_at);
