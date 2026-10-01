// e2e/navigation.spec.js
const { test, expect } = require('@playwright/test');

test('header search opens the product list for that term', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('textbox', { name: 'Search products' });
  await search.fill('shirt');
  await search.press('Enter');

  await expect(page).toHaveURL(/\/products\?search=shirt$/);
  await expect(page.getByText('Results for “shirt”')).toBeVisible();

  // Searching again while already on /products updates the results.
  const again = page.getByRole('textbox', { name: 'Search products' });
  await again.fill('shoes');
  await again.press('Enter');
  await expect(page.getByText('Results for “shoes”')).toBeVisible();
});

test('footer company links open information pages', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/\/information\/about$/);
  await expect(
    page.getByRole('heading', { name: 'About us', level: 1 })
  ).toBeVisible();
});

test('signup terms link points at the terms page', async ({ page }) => {
  await page.goto('/register');
  await expect(
    page.getByRole('link', { name: 'Terms and Conditions' })
  ).toHaveAttribute('href', '/information/terms');
});

test('unknown pages show a helpful not-found page', async ({ page }) => {
  await page.goto('/this-does-not-exist');
  await expect(
    page.getByRole('heading', { name: 'Page not found' })
  ).toBeVisible();
  await page.goto('/information/nope');
  await expect(
    page.getByRole('heading', { name: 'Page not found' })
  ).toBeVisible();
});
