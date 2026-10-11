-- 024_promo_rules.sql — business rules for promo codes: who can use a code
-- (everyone, a customer's first order, customers who signed up recently, or
-- returning customers), a cap on percentage discounts, leaving sale items
-- out, and emailing the code to new customers when they sign up.
ALTER TABLE coupons ADD COLUMN audience VARCHAR(20) NOT NULL DEFAULT 'everyone'
  CHECK (audience IN ('everyone', 'first_order', 'new_customers', 'returning'));
ALTER TABLE coupons ADD COLUMN new_customer_days INT CHECK (new_customer_days IS NULL OR new_customer_days > 0);
ALTER TABLE coupons ADD COLUMN max_discount NUMERIC(12, 2) CHECK (max_discount IS NULL OR max_discount > 0);
ALTER TABLE coupons ADD COLUMN exclude_sale_items BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE coupons ADD COLUMN send_on_signup BOOLEAN NOT NULL DEFAULT false;
