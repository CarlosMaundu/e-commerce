-- 013_numbers_verification_notifications.sql — readable order and invoice
-- numbers (filled for existing rows by lib/dataFixes on start-up), optional
-- email verification, and per-person back-office notification state.

ALTER TABLE orders ADD COLUMN number VARCHAR(24) UNIQUE;        -- WEB-1FT3K9X7
ALTER TABLE invoices ALTER COLUMN number TYPE VARCHAR(32);      -- INV-20261004-204015-X7R2

-- Existing accounts count as verified; new sign-ups verify when required.
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;
UPDATE users SET email_verified_at = COALESCE(created_at, now());
ALTER TABLE auth_tokens DROP CONSTRAINT IF EXISTS auth_tokens_purpose_check;
ALTER TABLE auth_tokens ADD CONSTRAINT auth_tokens_purpose_check CHECK (purpose IN ('reset', 'setup', 'verify'));

-- The bell: when someone last opened it and cleared it, and single dismissals.
CREATE TABLE staff_notification_state (
  user_id    INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ,
  cleared_at TIMESTAMPTZ
);
CREATE TABLE staff_notification_dismissals (
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key          VARCHAR(80) NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
