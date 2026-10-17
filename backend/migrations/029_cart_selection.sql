-- 029_cart_selection.sql — shoppers tick which cart items to buy now; the
-- rest stay in the cart for later. New items start ticked.
ALTER TABLE cart_items ADD COLUMN selected BOOLEAN NOT NULL DEFAULT true;
