// e2e/catalog.spec.js — home sections, product filters, variants and reviews
// against the demo catalog (backend/seed/catalog.json).
const { createUser, resetUsers } = require('./backend');
const { test, expect, toast, login, openProduct } = require('./fixtures');

test.beforeEach(async () => {
  await resetUsers();
});

test('home shows brands, this week’s most viewed and 15 featured products', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByTestId('best-viewed').getByTestId('product-card').first()
  ).toBeVisible();
  await expect(
    page.getByTestId('featured-grid').getByTestId('product-card')
  ).toHaveCount(15);
  await expect(
    page.getByRole('button', { name: 'View deal' }).first()
  ).toBeVisible();

  await page.getByRole('button', { name: /^Pulse Audio, 3 products$/ }).click();
  await expect(page).toHaveURL(/\/products\?brand=\d+$/);
  await expect(
    page.getByRole('heading', { name: 'Pulse Audio', level: 1 })
  ).toBeVisible();
  await expect(page.getByText('3 results')).toBeVisible();

  await page.goto('/');
  await page.getByRole('link', { name: 'Load more products' }).click();
  await expect(page).toHaveURL(/\/products$/);
});

test('filters narrow the list and live in the address bar', async ({
  page,
}) => {
  await page.goto('/products');
  await expect(page.getByText('31 results')).toBeVisible();

  await page.getByRole('button', { name: 'Rose', exact: true }).click();
  await expect(page).toHaveURL(/attr\.Color=Rose/);
  await expect(page.getByText('1 result', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Over-ear headphones', exact: true })
  ).toBeVisible();

  // The filter survives a reload, and its chip removes it.
  await page.reload();
  await page
    .getByRole('button', { name: 'Color: Rose' })
    .locator('svg')
    .click();
  await expect(page.getByText('31 results')).toBeVisible();

  await page.getByRole('checkbox', { name: /Kairo Leather/ }).check();
  await expect(page.getByText('3 results')).toBeVisible();
  await page.getByRole('checkbox', { name: 'On sale' }).check();
  await expect(page.getByText('1 result', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Leather card wallet', exact: true })
  ).toBeVisible();
});

test('each variant has its own price, and a guest can buy the one they pick', async ({
  page,
}) => {
  await openProduct(page, 'Hydrating face serum');
  const price = page.getByTestId('product-price');
  await expect(price).toContainText('$32.00');
  await page.getByRole('radio', { name: 'Size 50 ml' }).click();
  await expect(price).toContainText('$48.00');
  await expect(page.getByTestId('stock-status')).toHaveText('In stock');

  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(toast(page)).toHaveText(
    'Hydrating face serum added to your cart.'
  );
  await page.goto('/cart');
  const line = page.getByTestId('cart-line');
  await expect(line).toContainText('Size: 50 ml');
  await expect(line).toContainText('$48.00');
});

test('colour choice switches the photos; products with options aren’t added from lists', async ({
  page,
}) => {
  await page.goto('/products?search=crew-neck');
  await expect(
    page.getByRole('button', {
      name: 'Choose options for Cotton crew-neck shirt',
    })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Add Cotton crew-neck shirt to cart' })
  ).toHaveCount(0);

  await openProduct(page, 'Cotton crew-neck shirt');
  await page.getByRole('radio', { name: 'Color White' }).click();
  await expect(
    page.getByRole('img', { name: 'Cotton crew-neck shirt', exact: true })
  ).toHaveAttribute('src', /demo-tee-white\.jpg$/);
});

test('customers review a product once', async ({ page }) => {
  await createUser({
    email: 'rev@example.com',
    firstname: 'Rae',
    lastname: 'Viewer',
  });
  await login(page, 'rev@example.com');
  await expect(page.getByText('Hi, Rae Viewer')).toBeVisible();
  await openProduct(page, 'Canvas tote bag');
  await page.getByRole('tab', { name: /Reviews/ }).click();
  const form = page.getByRole('form', { name: 'Write a review' });
  await form.locator('label').filter({ hasText: '4 Stars' }).click();
  await form
    .getByLabel('Your review')
    .fill('Roomy and sturdy, carries my laptop easily.');
  await form.getByRole('button', { name: 'Post review' }).click();
  await expect(toast(page)).toHaveText('Thanks! Your review is up.');
  await expect(page.getByTestId('reviews')).toContainText('Roomy and sturdy');

  await form.locator('label').filter({ hasText: '5 Stars' }).click();
  await form.getByLabel('Your review').fill('Second thoughts, even better.');
  await form.getByRole('button', { name: 'Post review' }).click();
  await expect(toast(page)).toHaveText('You’ve already reviewed this product.');
});
