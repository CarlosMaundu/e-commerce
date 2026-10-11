-- 021_promo_codes.sql — promo codes managed in the back office: a limit per
-- customer, and who created or last changed each code.
ALTER TABLE coupons ADD COLUMN per_customer_limit INT CHECK (per_customer_limit IS NULL OR per_customer_limit > 0);
-- Plain ids (no foreign key): who made or changed it, kept if the user goes.
ALTER TABLE coupons ADD COLUMN created_by INT;
ALTER TABLE coupons ADD COLUMN updated_by INT;
ALTER TABLE coupons ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX orders_coupon ON orders (coupon_code) WHERE coupon_code IS NOT NULL;
