-- 010: invoices, payments, refunds and a double-entry ledger.
--
-- Every placed order has an invoice. Money received (card, cash on
-- delivery, M-Pesa, bank) is a payment; money sent back is a refund, which
-- also appears as a negative payment. Each of these posts a balanced
-- journal (total debits = total credits) to ledger_entries.

CREATE TABLE invoices (
  id          SERIAL PRIMARY KEY,
  number      VARCHAR(20) NOT NULL UNIQUE,                 -- INV-000123
  order_id    INT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'issued'
                CHECK (status IN ('issued', 'partially_paid', 'paid', 'void', 'refunded', 'partially_refunded')),
  subtotal    NUMERIC(12, 2) NOT NULL,
  discount    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  shipping    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total       NUMERIC(12, 2) NOT NULL,
  amount_paid     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount_refunded NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency    VARCHAR(3) NOT NULL,
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at      TIMESTAMPTZ,
  notes       TEXT NOT NULL DEFAULT '',
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX invoices_user ON invoices (user_id, issued_at DESC);
CREATE INDEX invoices_status ON invoices (status);

CREATE TABLE payments (
  id          SERIAL PRIMARY KEY,
  kind        VARCHAR(10) NOT NULL DEFAULT 'payment' CHECK (kind IN ('payment', 'refund')),
  method      VARCHAR(20) NOT NULL CHECK (method IN ('stripe', 'cod', 'cash', 'mpesa', 'bank')),
  status      VARCHAR(20) NOT NULL DEFAULT 'succeeded' CHECK (status IN ('succeeded', 'pending', 'failed')),
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),   -- always positive; kind says the direction
  currency    VARCHAR(3) NOT NULL,
  reference   VARCHAR(120) NOT NULL DEFAULT '',            -- Stripe id, M-Pesa code, bank ref…
  order_id    INT REFERENCES orders(id) ON DELETE SET NULL,
  invoice_id  INT REFERENCES invoices(id) ON DELETE SET NULL,
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  refund_id   INT,
  note        TEXT NOT NULL DEFAULT '',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by INT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX payments_order ON payments (order_id);
CREATE INDEX payments_received ON payments (received_at DESC);

CREATE TABLE refunds (
  id              SERIAL PRIMARY KEY,
  order_id        INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  invoice_id      INT REFERENCES invoices(id) ON DELETE SET NULL,
  return_id       INT REFERENCES returns(id) ON DELETE SET NULL,
  status          VARCHAR(20) NOT NULL CHECK (status IN ('pending_approval', 'processed', 'rejected', 'failed')),
  items_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0,          -- goods being refunded (incl. tax when prices include it)
  delivery_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  restocking_fee  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0), -- paid back = items + delivery − fee
  method          VARCHAR(20) NOT NULL CHECK (method IN ('stripe', 'cod', 'cash', 'mpesa', 'bank')),
  reference       VARCHAR(120) NOT NULL DEFAULT '',
  reason          TEXT NOT NULL DEFAULT '',
  requested_by    INT REFERENCES users(id) ON DELETE SET NULL,
  approved_by     INT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ
);
CREATE INDEX refunds_order ON refunds (order_id);
CREATE INDEX refunds_status ON refunds (status);
ALTER TABLE payments ADD CONSTRAINT payments_refund_fk FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE SET NULL;

-- One row per journal line. Accounts: receivables, cash, card_clearing,
-- mobile_money, bank, sales, vat_payable, delivery_income, sales_returns,
-- restocking_income.
CREATE TABLE ledger_entries (
  id          BIGSERIAL PRIMARY KEY,
  journal_id  INT NOT NULL,
  account     VARCHAR(30) NOT NULL,
  debit       NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit      NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo        VARCHAR(200) NOT NULL DEFAULT '',
  order_id    INT REFERENCES orders(id) ON DELETE SET NULL,
  invoice_id  INT REFERENCES invoices(id) ON DELETE SET NULL,
  payment_id  INT REFERENCES payments(id) ON DELETE SET NULL,
  refund_id   INT REFERENCES refunds(id) ON DELETE SET NULL,
  currency    VARCHAR(3) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  INT REFERENCES users(id) ON DELETE SET NULL
);
CREATE SEQUENCE ledger_journal_seq;
CREATE INDEX ledger_journal ON ledger_entries (journal_id);
CREATE INDEX ledger_account ON ledger_entries (account, occurred_at);
CREATE INDEX ledger_order ON ledger_entries (order_id);

CREATE TABLE refund_settings (
  id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings    JSONB NOT NULL,
  updated_by  INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Staff can place orders for customers (who placed it).
ALTER TABLE orders ADD COLUMN created_by INT REFERENCES users(id) ON DELETE SET NULL;
