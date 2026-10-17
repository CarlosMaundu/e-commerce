-- 030_refresh_grace.sql — the refresh token before the latest rotation stays
-- valid for a moment, so a page that was left (or reloaded) while its
-- refresh was in flight doesn't sign the person out.
ALTER TABLE sessions ADD COLUMN previous_hash CHAR(64);
ALTER TABLE sessions ADD COLUMN rotated_at TIMESTAMPTZ;
