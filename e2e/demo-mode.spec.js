// e2e/demo-mode.spec.js
// Behaviour specific to REACT_APP_DATA_SOURCE=demo.
const { test, expect } = require('@playwright/test');

test('newsletter explains it is not available yet instead of failing', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByPlaceholder('Enter your email').fill('fan@example.com');
  await page.getByRole('button', { name: 'Subscribe' }).click();
  await expect(page.getByTestId('app-notification')).toHaveText(
    'Newsletter sign-up isn’t available yet. Please check back soon.'
  );
});
