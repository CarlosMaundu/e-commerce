process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgres://shop:shop@localhost:5433/carlos_shop_test';
process.env.JWT_SECRET = 'test-secret-not-for-production';
process.env.UPLOADS_DIR = require('path').join(__dirname, '..', 'uploads-test');
process.env.SEED_SAMPLE_CATALOG = 'true';
// Tests were written in dollars with 8% tax added at checkout.
process.env.CURRENCY = 'USD';
process.env.TAX_LABEL = 'Tax';
process.env.TAX_RATE = '0.08';
process.env.PRICES_INCLUDE_TAX = 'false';
process.env.STANDARD_SHIPPING = '10';
process.env.EXPRESS_SHIPPING = '25';
process.env.FREE_SHIPPING_OVER = '150';
process.env.FRONTEND_URL = 'http://shop.test';
// Offers card payments; the gateway itself is a fake (tests/helpers.ts).
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';
