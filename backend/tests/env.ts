process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgres://shop:shop@localhost:5433/carlos_shop_test';
process.env.JWT_SECRET = 'test-secret-not-for-production';
process.env.UPLOADS_DIR = require('path').join(__dirname, '..', 'uploads-test');
process.env.SEED_SAMPLE_CATALOG = 'true';
process.env.FRONTEND_URL = 'http://shop.test';
