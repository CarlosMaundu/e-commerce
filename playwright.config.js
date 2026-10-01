// playwright.config.js
// End-to-end tests run the real app against the Firebase Auth emulator, so
// they never touch the live Firebase project or send real emails.
//   npm run test:e2e
const { defineConfig, devices } = require('@playwright/test');

const PORT = 3100;
const PROJECT_ID = 'demo-carlos-shop';

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `npx firebase emulators:start --only auth --project ${PROJECT_ID}`,
      url: 'http://127.0.0.1:9099/',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npx react-scripts start',
      url: `http://localhost:${PORT}`,
      reuseExistingServer: true,
      timeout: 600_000,
      env: {
        PORT: String(PORT),
        BROWSER: 'none',
        // Lint runs separately (npx eslint src); its dev overlay would block clicks.
        DISABLE_ESLINT_PLUGIN: 'true',
        // Demo values override .env so nothing can reach the real project.
        REACT_APP_FIREBASE_API_KEY: 'demo-api-key',
        REACT_APP_FIREBASE_AUTH_DOMAIN: `${PROJECT_ID}.firebaseapp.com`,
        REACT_APP_FIREBASE_PROJECT_ID: PROJECT_ID,
        REACT_APP_FIREBASE_APP_ID: '1:000000000000:web:demo',
        REACT_APP_FIREBASE_MEASUREMENT_ID: '',
        REACT_APP_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      },
    },
  ],
});
