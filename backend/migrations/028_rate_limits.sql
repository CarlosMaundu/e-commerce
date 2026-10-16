-- 028_rate_limits.sql — rate-limit counters kept in the database, so every API
-- server counts the same requests (in memory, each server would count apart).
CREATE TABLE rate_limits (
  key       VARCHAR(200) PRIMARY KEY,   -- limiter prefix + client key (IP)
  hits      INT NOT NULL,
  reset_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX rate_limits_reset ON rate_limits (reset_at);
