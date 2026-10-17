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

test('every footer link opens a real page; Careers and Press are gone', async ({
  page,
}) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Careers' })).toHaveCount(0);
  await expect(footer.getByRole('link', { name: 'Press' })).toHaveCount(0);
  const checks = [
    ['About us', /\/about$/, 'about-content'],
    ['Support', /\/support$/, null, 'How can we help?'],
    ['FAQs', /\/faq$/, null, 'Frequently asked questions'],
    ['Terms and conditions', /\/policies\/terms$/, 'policy-content'],
    ['Privacy policy', /\/policies\/privacy$/, 'policy-content'],
    ['Refund & Return Policy', /\/policies\/refunds$/, 'policy-content'],
  ];
  for (const [name, url, testId, heading] of checks) {
    await page.goto('/');
    await page
      .getByRole('contentinfo')
      .getByRole('link', { name, exact: true })
      .click();
    await expect(page).toHaveURL(url);
    if (testId) await expect(page.getByTestId(testId)).toBeVisible();
    if (heading) {
      await expect(
        page.getByRole('heading', { name: heading, level: 1 })
      ).toBeVisible();
    }
  }
});

test('the FAQ can be searched and answers open', async ({ page }) => {
  await page.goto('/faq');
  await page.getByLabel('Search the FAQs').fill('refund');
  const q = page.getByRole('button', { name: 'When will I get my refund?' });
  await expect(q).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'How do I place an order?' })
  ).toHaveCount(0);
  await q.click();
  await expect(
    page.getByText('Card refunds go back to the same card')
  ).toBeVisible();
});

test('signup terms link points at the terms page', async ({ page }) => {
  await page.goto('/register');
  await expect(
    page.getByRole('link', { name: 'Terms and Conditions', exact: true })
  ).toHaveAttribute('href', '/policies/terms');
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

test('the Categories menu shows each category’s photo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Categories' }).click();
  const panel = page.getByRole('navigation', { name: 'Categories' });
  const women = panel.getByRole('link', { name: 'Women' });
  await expect(women.locator('img')).toHaveAttribute('src', /\S/);
  await women.click();
  await expect(page).toHaveURL(/\/products\?category=\d+$/);
});

test('the installed app is named after the shop, with its own icons', async ({
  page,
}) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await page.request.get(href)).json();
  expect(manifest.name).toBe('Carlos Shop');
  expect(JSON.stringify(manifest)).not.toMatch(/React/);
  const icon = await page.request.get(manifest.icons[0].src);
  expect(icon.headers()['content-type']).toBe('image/png');
  await expect(
    page.locator('meta[name="apple-mobile-web-app-title"]')
  ).toHaveAttribute('content', 'Carlos Shop');
});

test('the member card leads to sign-up (old /signup links too)', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('hero-member').getByRole('link').click();
  await expect(page).toHaveURL(/\/register$/);
  await page.goto('/signup');
  await expect(page).toHaveURL(/\/register$/);
});

test('desktop: the deal strip shows while shopping but not in the cart or checkout', async ({
  page,
}) => {
  await page.goto('/products');
  await expect(page.getByLabel('Current offers')).toBeVisible();
  await page.goto('/cart');
  await expect(
    page.getByRole('heading', { name: /Cart|Your cart is empty/ }).first()
  ).toBeVisible();
  await expect(page.getByLabel('Current offers')).toHaveCount(0);
});
