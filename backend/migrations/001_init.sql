-- 001_init.sql — users, roles, sessions, catalog
-- Modelled on the Project Management portal's RBAC and session tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- RBAC ----------
CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(50)  NOT NULL UNIQUE,   -- e.g. super_admin
  name        VARCHAR(100) NOT NULL UNIQUE,   -- display name
  description TEXT         NOT NULL DEFAULT '',
  is_system   BOOLEAN      NOT NULL DEFAULT false,  -- cannot be deleted
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- One format everywhere: module.resource.action (e.g. catalog.products.update)
CREATE TABLE permissions (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(150) NOT NULL UNIQUE,
  module      VARCHAR(50)  NOT NULL,
  description TEXT         NOT NULL DEFAULT ''
);

CREATE TABLE role_permissions (
  role_id       INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ---------- Users ----------
CREATE TABLE users (
  id                    SERIAL PRIMARY KEY,
  email                 VARCHAR(255) NOT NULL,
  password_hash         TEXT,                         -- null: Google-only or setup pending
  google_sub            VARCHAR(255) UNIQUE,
  firstname             VARCHAR(100) NOT NULL DEFAULT '',
  lastname              VARCHAR(100) NOT NULL DEFAULT '',
  avatar                TEXT         NOT NULL DEFAULT '',
  role_id               INT          NOT NULL REFERENCES roles(id),
  status                VARCHAR(20)  NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'suspended')),
  failed_login_attempts INT          NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower ON users (lower(email));

-- A session per signed-in device. Access tokens carry the session id, so
-- revoking a session signs that device out immediately.
CREATE TABLE sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_hash      CHAR(64) NOT NULL,
  user_agent        TEXT NOT NULL DEFAULT '',
  ip_address        VARCHAR(64) NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,
  revoked_at        TIMESTAMPTZ
);
CREATE INDEX sessions_user_active ON sessions (user_id) WHERE revoked_at IS NULL;

-- Single-use emailed tokens: password reset and first-time account setup.
CREATE TABLE auth_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  CHAR(64) NOT NULL UNIQUE,
  purpose     VARCHAR(20) NOT NULL CHECK (purpose IN ('reset', 'setup')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  target      VARCHAR(100) NOT NULL DEFAULT '',
  details     JSONB NOT NULL DEFAULT '{}',
  ip_address  VARCHAR(64) NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Catalog ----------
CREATE TABLE categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  image      TEXT NOT NULL DEFAULT '',
  parent_id  INT REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price         NUMERIC(12, 2) NOT NULL CHECK (price > 0),
  special       NUMERIC(12, 2) CHECK (special IS NULL OR special > 0),
  quantity      INT NOT NULL DEFAULT 0,
  category_id   INT REFERENCES categories(id) ON DELETE SET NULL,
  images        JSONB NOT NULL DEFAULT '[]',
  options       JSONB NOT NULL DEFAULT '{"sizes": [], "colors": []}',
  manufacturer  VARCHAR(150) NOT NULL DEFAULT '',
  rating        NUMERIC(2, 1) NOT NULL DEFAULT 0,
  reviews       INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_category ON products (category_id);
CREATE INDEX products_name_search ON products (lower(name));

CREATE TABLE newsletter_subscribers (
  email      VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
