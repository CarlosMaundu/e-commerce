-- 009: delivery options (standard, express, pick up) edited in the back
-- office: names, prices, the free-delivery threshold and the pick-up point.
CREATE TABLE delivery_settings (
  id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings    JSONB NOT NULL,
  updated_by  INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
