-- 002_commerce.sql — addresses, cart, wishlist, coupons, orders, returns

CREATE TABLE addresses (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  firstname    VARCHAR(100) NOT NULL,
  lastname     VARCHAR(100) NOT NULL,
  company      VARCHAR(150) NOT NULL DEFAULT '',
  address_1    VARCHAR(255) NOT NULL,
  address_2    VARCHAR(255) NOT NULL DEFAULT '',
  city         VARCHAR(120) NOT NULL,
  postcode     VARCHAR(20)  NOT NULL DEFAULT '',
  country      VARCHAR(2)   NOT NULL,          -- ISO 3166-1 alpha-2
  zone         VARCHAR(120) NOT NULL DEFAULT '', -- state / county / region
  telephone    VARCHAR(40)  NOT NULL DEFAULT '',
  is_default   BOOLEAN      NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX addresses_user ON addresses (user_id);

CREATE TABLE cart_items (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INT NOT NULL CHECK (quantity > 0),
  options     JSONB NOT NULL DEFAULT '{}',   -- { "size": "M", "color": "Navy" }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id, options)
);

-- Checkout choices that belong to the cart (OpenCart keeps these in session).
CREATE TABLE checkout_state (
  user_id              INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  coupon_code          VARCHAR(40),
  shipping_address_id  INT REFERENCES addresses(id) ON DELETE SET NULL,
  payment_address_id   INT REFERENCES addresses(id) ON DELETE SET NULL,
  shipping_method      VARCHAR(40),
  payment_method       VARCHAR(40),
  comment              TEXT NOT NULL DEFAULT '',
  pending_order_id     INT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wishlist_items (
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE coupons (
  code         VARCHAR(40) PRIMARY KEY,           -- stored upper-case
  description  VARCHAR(255) NOT NULL DEFAULT '',
  type         VARCHAR(10) NOT NULL CHECK (type IN ('percent', 'fixed')),
  value        NUMERIC(10, 2) NOT NULL CHECK (value > 0),
  min_total    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  starts_at    TIMESTAMPTZ,
  ends_at      TIMESTAMPTZ,
  uses_limit   INT,                               -- null = unlimited
  uses_count   INT NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id                 SERIAL PRIMARY KEY,
  user_id            INT REFERENCES users(id) ON DELETE SET NULL,
  email              VARCHAR(255) NOT NULL,
  status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('awaiting_payment', 'pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment_method     VARCHAR(40) NOT NULL,
  payment_status     VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_reference  VARCHAR(255),                -- e.g. Stripe PaymentIntent id
  shipping_method    VARCHAR(40) NOT NULL,
  shipping_address   JSONB NOT NULL,              -- snapshot at order time
  payment_address    JSONB NOT NULL,
  coupon_code        VARCHAR(40),
  subtotal           NUMERIC(12, 2) NOT NULL,
  discount           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  shipping_total     NUMERIC(12, 2) NOT NULL,
  tax_total          NUMERIC(12, 2) NOT NULL,
  total              NUMERIC(12, 2) NOT NULL,
  currency           VARCHAR(3) NOT NULL DEFAULT 'USD',
  comment            TEXT NOT NULL DEFAULT '',
  placed_at          TIMESTAMPTZ,                 -- null until confirmed
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_user ON orders (user_id, created_at DESC);
CREATE INDEX orders_status ON orders (status);
CREATE INDEX orders_placed ON orders (placed_at);

CREATE TABLE order_items (
  id          SERIAL PRIMARY KEY,
  order_id    INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  INT REFERENCES products(id) ON DELETE SET NULL,
  name        VARCHAR(255) NOT NULL,
  image       TEXT NOT NULL DEFAULT '',
  options     JSONB NOT NULL DEFAULT '{}',
  unit_price  NUMERIC(12, 2) NOT NULL,
  quantity    INT NOT NULL CHECK (quantity > 0),
  total       NUMERIC(12, 2) NOT NULL
);
CREATE INDEX order_items_order ON order_items (order_id);
CREATE INDEX order_items_product ON order_items (product_id);

CREATE TABLE order_history (
  id          SERIAL PRIMARY KEY,
  order_id    INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      VARCHAR(20) NOT NULL,
  comment     TEXT NOT NULL DEFAULT '',
  notified    BOOLEAN NOT NULL DEFAULT false,
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,  -- who changed it
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_history_order ON order_history (order_id);

CREATE TABLE returns (
  id             SERIAL PRIMARY KEY,
  order_id       INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id  INT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  user_id        INT REFERENCES users(id) ON DELETE SET NULL,
  quantity       INT NOT NULL CHECK (quantity > 0),
  reason         VARCHAR(40) NOT NULL,
  opened         BOOLEAN NOT NULL DEFAULT false,
  comment        TEXT NOT NULL DEFAULT '',
  status         VARCHAR(20) NOT NULL DEFAULT 'requested'
                   CHECK (status IN ('requested', 'approved', 'rejected', 'refunded')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX returns_user ON returns (user_id);
