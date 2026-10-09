-- 018_support_faq.sql — customer support requests (a thread of messages
-- between the customer and staff) and the FAQ.
CREATE TABLE support_tickets (
  id              SERIAL PRIMARY KEY,
  number          VARCHAR(24) NOT NULL UNIQUE,                 -- SUP-1FT3K9X7Q
  user_id         INT REFERENCES users(id) ON DELETE SET NULL,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  phone           VARCHAR(40) NOT NULL DEFAULT '',
  category        VARCHAR(30) NOT NULL,
  subject         VARCHAR(160) NOT NULL,
  order_id        INT REFERENCES orders(id) ON DELETE SET NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'waiting', 'resolved', 'closed')),
  last_from       VARCHAR(10) NOT NULL DEFAULT 'customer' CHECK (last_from IN ('customer', 'staff')),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX support_tickets_status ON support_tickets (status, last_message_at DESC);
CREATE INDEX support_tickets_user ON support_tickets (user_id);

CREATE TABLE support_messages (
  id          SERIAL PRIMARY KEY,
  ticket_id   INT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author      VARCHAR(10) NOT NULL CHECK (author IN ('customer', 'staff')),
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_ticket ON support_messages (ticket_id, created_at);

CREATE TABLE faq_items (
  id          SERIAL PRIMARY KEY,
  category    VARCHAR(60) NOT NULL,
  question    VARCHAR(300) NOT NULL,
  answer      TEXT NOT NULL,                                   -- formatted text (HTML)
  position    INT NOT NULL DEFAULT 0,
  published   BOOLEAN NOT NULL DEFAULT true,
  updated_by  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
