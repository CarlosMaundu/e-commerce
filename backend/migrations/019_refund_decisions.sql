-- 019_refund_decisions.sql — whether a refund had to wait for approval, and
-- when it was approved or rejected, for the order's timeline.
ALTER TABLE refunds ADD COLUMN needs_approval BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE refunds ADD COLUMN decided_at TIMESTAMPTZ;

-- Earlier refunds: those still waiting or rejected went through approval, as
-- did any approved by someone other than whoever raised them.
UPDATE refunds SET needs_approval = true
WHERE status IN ('pending_approval', 'rejected')
   OR (approved_by IS NOT NULL AND requested_by IS DISTINCT FROM approved_by);
UPDATE refunds SET decided_at = COALESCE(processed_at, created_at)
WHERE needs_approval AND status <> 'pending_approval';
