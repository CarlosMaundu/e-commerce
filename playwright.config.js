// playwright.config.js
// End-to-end tests run the real app against the Firebase Auth emulator, so
// they never touch the live Firebase project or send real emails.
//   npm run test:e2e                      # both projects
//   npx playwright test --project=demo    # one data source
//
// Two copies of the app run side by side:
//   demo (port 3100) – REACT_APP_DATA_SOURCE=demo, public demo API
//   mock (port 3101) – REACT_APP_DATA_SOURCE=mock, in-browser fake backend
//                      implementing our API contract (src/api/contract.md)
const { defineConfig, devices } = require('@playwright/test');

const PROJECT_ID = 'demo-carlos-shop';
const DEMO_PORT = 3100;
const MOCK_PORT = 3101;

const appServer = (port, dataSource) => ({
  command: 'npx react-scripts start',
  url: `http://localhost:${port}`,
  reuseExistingServer: true,
  timeout: 600_000,
  env: {
    PORT: String(port),
    BROWSER: 'none',
    // Lint runs separately (npx eslint src); its dev overlay would block clicks.
    DISABLE_ESLINT_PLUGIN: 'true',
    REACT_APP_DATA_SOURCE: dataSource,
    // Demo values override .env so nothing can reach the real project.
    REACT_APP_FIREBASE_API_KEY: 'demo-api-key',
    REACT_APP_FIREBASE_AUTH_DOMAIN: `${PROJECT_ID}.firebaseapp.com`,
    REACT_APP_FIREBASE_PROJECT_ID: PROJECT_ID,
    REACT_APP_FIREBASE_APP_ID: '1:000000000000:web:demo',
    REACT_APP_FIREBASE_MEASUREMENT_ID: '',
    REACT_APP_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  },
});

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'demo',
      testIgnore: /mock-mode\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${DEMO_PORT}`,
      },
    },
    {
      name: 'mock',
      testMatch: /(mock-mode|navigation)\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${MOCK_PORT}`,
      },
    },
  ],
  webServer: [
    {
      command: `npx firebase emulators:start --only auth --project ${PROJECT_ID}`,
      url: 'http://127.0.0.1:9099/',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    appServer(DEMO_PORT, 'demo'),
    appServer(MOCK_PORT, 'mock'),
  ],
});
