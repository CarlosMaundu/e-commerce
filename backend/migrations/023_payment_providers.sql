-- 023_payment_providers.sql — Back office → Payments: each way of paying is
-- configured here (credentials encrypted), tested, and switched on or off;
-- and requests to collect money at the door (card link / M-Pesa prompt).
CREATE TABLE payment_providers (
  code              VARCHAR(20) PRIMARY KEY,                 -- stripe, mpesa, cod
  enabled           BOOLEAN NOT NULL DEFAULT false,
  mode              VARCHAR(10) NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live')),
  settings          JSONB NOT NULL DEFAULT '{}'::jsonb,      -- not secret
  secrets           TEXT NOT NULL DEFAULT '',                -- encrypted JSON
  last_test_at      TIMESTAMPTZ,
  last_test_ok      BOOLEAN,
  last_test_message TEXT NOT NULL DEFAULT '',
  updated_by        INT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_requests (
  id           SERIAL PRIMARY KEY,
  order_id     INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  invoice_id   INT REFERENCES invoices(id) ON DELETE SET NULL,
  provider     VARCHAR(20) NOT NULL CHECK (provider IN ('card_link', 'mpesa')),
  amount       NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency     VARCHAR(3) NOT NULL,
  phone        VARCHAR(20) NOT NULL DEFAULT '',
  external_id  VARCHAR(120) NOT NULL DEFAULT '',              -- Checkout session / CheckoutRequestID
  url          TEXT NOT NULL DEFAULT '',
  status       VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired')),
  reference    VARCHAR(120) NOT NULL DEFAULT '',              -- M-Pesa receipt / card payment id
  message      TEXT NOT NULL DEFAULT '',
  payment_id   INT REFERENCES payments(id) ON DELETE SET NULL,
  created_by   INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_requests_order ON payment_requests (order_id, created_at DESC);
CREATE UNIQUE INDEX payment_requests_external ON payment_requests (provider, external_id) WHERE external_id <> '';
