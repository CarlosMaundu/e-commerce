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
