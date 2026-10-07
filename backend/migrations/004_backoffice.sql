-- 004_backoffice.sql — security settings, impersonation and staff-placed orders.

-- One row of settings the back office can change (Security settings page).
CREATE TABLE security_settings (
  id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings    JSONB NOT NULL,
  updated_by  INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO security_settings (settings) VALUES ('{
  "password": { "min_length": 8, "require_symbol": false },
  "lockout": { "max_attempts": 5, "minutes": 15 },
  "staff_sessions": { "max_hours": 12, "idle_minutes": 60, "max_concurrent": 5 },
  "accounts": { "allow_registration": true }
}');

-- A staff member acting as a customer gets a short session of the
-- customer's, linked to the staff member and their own session.
ALTER TABLE sessions
  ADD COLUMN impersonator_id   INT REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN parent_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL;

-- Orders placed by staff on a customer's behalf.
ALTER TABLE orders ADD COLUMN placed_by INT REFERENCES users(id) ON DELETE SET NULL;

-- Actions taken while impersonating record who really did them.
ALTER TABLE audit_logs ADD COLUMN impersonator_id INT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX audit_logs_user_idx ON audit_logs (user_id, created_at DESC);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
