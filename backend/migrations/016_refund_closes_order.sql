-- 016_refund_closes_order.sql — a full refund raised by moving an order to
-- "Refunded" marks the order refunded only once the money has gone back
-- (straight away, or when the refund is approved).
ALTER TABLE refunds ADD COLUMN closes_order BOOLEAN NOT NULL DEFAULT false;
