-- 017_legal_pages.sql — Terms and conditions, Privacy policy and the Refund
-- & Return Policy, edited in Back office → Legal pages. Pages without a row
-- use the built-in defaults (lib/legalDefaults.ts).
CREATE TABLE legal_pages (
  slug        VARCHAR(40) PRIMARY KEY,
  title       VARCHAR(120) NOT NULL,
  body        TEXT NOT NULL,
  updated_by  INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
