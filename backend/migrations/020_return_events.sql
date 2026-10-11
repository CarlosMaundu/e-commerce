-- 020_return_events.sql — every step of a return (requested, approved, item
-- received, refund raised / approved / paid, rejected) with who and when,
-- and a "refund pending" state while its refund waits for approval.
ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_status_check;
ALTER TABLE returns ADD CONSTRAINT returns_status_check
  CHECK (status IN ('requested', 'approved', 'received', 'refund_pending', 'rejected', 'refunded'));
ALTER TABLE returns ADD COLUMN restocked BOOLEAN;

CREATE TABLE return_events (
  id          SERIAL PRIMARY KEY,
  return_id   INT NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  status      VARCHAR(30) NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  internal    BOOLEAN NOT NULL DEFAULT false,               -- staff-only (not shown to the customer)
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX return_events_return ON return_events (return_id, created_at);

-- Earlier returns: what we know of their history.
INSERT INTO return_events (return_id, status, created_at)
  SELECT id, 'requested', created_at FROM returns;
INSERT INTO return_events (return_id, status, created_at)
  SELECT id, 'received', received_at FROM returns WHERE received_at IS NOT NULL;
INSERT INTO return_events (return_id, status, created_at)
  SELECT id, status, updated_at FROM returns WHERE status IN ('approved', 'rejected', 'refunded');
-- Their refunds still waiting for approval put them in "refund pending".
UPDATE returns r SET status = 'refund_pending'
  WHERE r.status = 'refunded'
    AND EXISTS (SELECT 1 FROM refunds f WHERE f.return_id = r.id AND f.status = 'pending_approval');
