-- Separate database for backend integration tests (npm test in backend/).
CREATE DATABASE carlos_shop_test OWNER shop;
-- Database for Playwright end-to-end tests (npm run test:e2e).
CREATE DATABASE carlos_shop_e2e OWNER shop;
