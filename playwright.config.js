// playwright.config.js
// End-to-end tests run the real app against a real backend:
//   - Postgres and Mailpit from Docker (`docker compose up -d db mailpit`)
//   - an API instance on :4100 using the carlos_shop_e2e database, so tests
//     never touch your development data
//   - the React dev server on :3100, proxying /api to that API
// Reset and setup emails are read from Mailpit's API (e2e/backend.js).
//   npm run test:e2e
const { defineConfig, devices } = require('@playwright/test');

const API_PORT = 4100;
const WEB_PORT = 3100;
const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ||
  'postgres://shop:shop@localhost:5433/carlos_shop_e2e';

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './e2e/globalSetup.js',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Fresh demo catalog every run, so stock and products are predictable.
      command:
        'npx tsx src/migrate.ts && npx tsx src/demoCatalog.ts --replace && npx tsx src/server.ts',
      cwd: './backend',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test', // relaxes rate limits; lockout rules still apply
        PORT: String(API_PORT),
        DATABASE_URL: E2E_DATABASE_URL,
        JWT_SECRET: 'e2e-secret-not-for-production',
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: '1025',
        FRONTEND_URL: `http://localhost:${WEB_PORT}`,
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
        UPLOADS_DIR: 'uploads-e2e',
        SEED_SAMPLE_CATALOG: 'true',
        // The e2e suite is written in dollars with 8% tax added at checkout.
        CURRENCY: 'USD',
        TAX_LABEL: 'Tax',
        TAX_RATE: '0.08',
        PRICES_INCLUDE_TAX: 'false',
        STANDARD_SHIPPING: '10',
        EXPRESS_SHIPPING: '25',
        FREE_SHIPPING_OVER: '150',
      },
    },
    {
      command: 'npx react-scripts start',
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 600_000,
      env: {
        PORT: String(WEB_PORT),
        BROWSER: 'none',
        // Lint runs separately (npx eslint src); its dev overlay would block clicks.
        DISABLE_ESLINT_PLUGIN: 'true',
        API_PROXY_TARGET: `http://localhost:${API_PORT}`,
        REACT_APP_GOOGLE_CLIENT_ID: '',
      },
    },
  ],
});
