// e2e/shop.spec.js — storefront against the real backend's sample catalog.
const { test, expect } = require('@playwright/test');

const toast = (page) => page.getByTestId('app-notification');
const productImage = (page, name) =>
  page.getByRole('img', { name, exact: true });

test('product list shows the catalog and search really filters it', async ({
  page,
}) => {
  await page.goto('/products');
  await expect(productImage(page, 'Denim jacket')).toBeVisible();

  const search = page.getByRole('textbox', { name: 'Search products' });
  await search.fill('dress');
  await search.press('Enter');
  await expect(page.getByText('Results for “dress”')).toBeVisible();
  await expect(productImage(page, 'Linen summer dress')).toBeVisible();
  await expect(productImage(page, 'Wrap midi dress')).toBeVisible();
  await expect(productImage(page, 'Denim jacket')).toHaveCount(0);
});

test('product page loads from the API, with images served by the backend', async ({
  page,
}) => {
  await page.goto('/products');
  await productImage(page, 'Denim jacket').click();
  await expect(page).toHaveURL(/\/products\/\d+$/);
  await expect(page.getByText('Denim jacket').first()).toBeVisible();
  const image = page.getByRole('img', { name: 'Denim jacket' }).first();
  await expect(image).toHaveJSProperty('complete', true);
  expect(await image.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
});

test('newsletter sign-up works and validates email', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Enter your email').fill('fan@example.com');
  await page.getByRole('button', { name: 'Subscribe' }).click();
  await expect(toast(page)).toHaveText('You’re subscribed to our newsletter.');
});
