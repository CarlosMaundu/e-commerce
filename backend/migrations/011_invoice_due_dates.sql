-- 011: shop checkout invoices have no due date (card is paid at once, cash
-- on delivery is due on delivery); only staff-issued invoices set one.
UPDATE invoices SET due_at = NULL WHERE due_at = issued_at;
