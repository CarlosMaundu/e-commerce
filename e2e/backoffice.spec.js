// e2e/backoffice.spec.js — product editor with variants and brands, staff vs
// customers, acting as a customer, profile sessions and unlocking accounts.
const { createUser, resetUsers } = require('./backend');
const { test, expect, toast, login } = require('./fixtures');

test.beforeEach(async () => {
  await resetUsers();
});

const signInAdmin = async (page) => {
  await createUser({
    email: 'boss@example.com',
    firstname: 'Bo',
    lastname: 'Boss',
    role: 'super_admin',
  });
  await login(page, 'boss@example.com');
  // Staff land in the back office.
  await expect(page).toHaveURL(/\/admin/);
};

const addValues = async (row, values) => {
  const input = row.getByLabel('Values');
  for (const v of values) {
    await input.fill(v);
    await input.press('Enter');
  }
};

test('admin adds a product with variants and a new brand; the shop sells those options', async ({
  page,
}) => {
  await signInAdmin(page);
  await page.goto('/admin/products');
  await page.getByRole('link', { name: 'Add product' }).click();

  // 1. Vital info, with a brand added on the spot.
  await page.getByLabel('Product name').fill('Trail runner');
  await page.getByLabel('Brand', { exact: true }).click();
  await page.getByRole('option', { name: 'Add a new brand…' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Brand name').fill('Summit Gear');
  await dialog.getByRole('button', { name: 'Save brand' }).click();
  await expect(toast(page)).toHaveText('Brand added.');
  await expect(page.getByLabel('Brand', { exact: true })).toHaveValue(
    'Summit Gear'
  );

  // 4. Variations: Color × Size.
  await page.getByRole('button', { name: /Variations/ }).click();
  await page
    .getByLabel('This product has variants, like size or color')
    .check();
  await addValues(page.getByTestId('variation-0'), ['Red', 'Blue']);
  await page.getByRole('button', { name: 'Add another variation' }).click();
  await page
    .getByTestId('variation-1')
    .getByLabel('Variation', { exact: true })
    .fill('Size');
  await addValues(page.getByTestId('variation-1'), ['42', '43']);
  await expect(page.getByText('4 combinations')).toBeVisible();

  // 5. Pricing and quantity: a default price, stock for all, one own price.
  await page.getByRole('button', { name: /Pricing and quantity/ }).click();
  await page.getByRole('spinbutton', { name: /^Default price/ }).fill('120');
  await page.getByLabel('Set all quantities').fill('7');
  await page.getByRole('button', { name: 'Apply to all variants' }).click();
  await page.getByLabel('Price for Blue / 43', { exact: true }).fill('135');
  await page.getByLabel('Quantity for Red / 42', { exact: true }).fill('0');

  // 7. Tags.
  await page.getByRole('button', { name: /Tags and visibility/ }).click();
  const tags = page.getByRole('combobox', { name: 'Tags' });
  await tags.fill('Trail Running');
  await tags.press('Enter');

  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(toast(page)).toHaveText('Trail runner is now in the shop.');
  await expect(page).toHaveURL(/\/admin\/products\/\d+$/);

  // The list shows it with its stock and price range.
  await page.goto('/admin/products?search=Trail');
  const row = page.locator('[data-testid^="product-row-"]').first();
  await expect(row).toContainText('Trail runner');
  await expect(row).toContainText('$120.00 – $135.00');
  await expect(row).toContainText('21'); // 3 × 7 in stock

  // In the shop: options, prices per variant and the out-of-stock combination.
  await page.goto('/products?tag=trail-running');
  await expect(page.getByText('From')).toBeVisible();
  await page.getByRole('img', { name: 'Trail runner', exact: true }).click();
  await page.getByRole('radio', { name: 'Color Blue' }).click();
  await page.getByRole('radio', { name: /^Size 43/ }).click();
  await expect(page.getByTestId('product-price')).toContainText('$135.00');
  await page.getByRole('radio', { name: 'Color Red' }).click();
  await expect(
    page.getByRole('radio', { name: 'Size 42 (out of stock)' })
  ).toBeVisible();
  // Staff browse the shop but can't buy.
  await expect(
    page.getByText('You’re signed in to the back office, so you can’t shop.')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to cart' })).toHaveCount(
    0
  );
});

test('staff don’t shop, but can view the shop as a customer and come back', async ({
  page,
}) => {
  await createUser({
    email: 'cam@example.com',
    firstname: 'Cam',
    lastname: 'Customer',
  });
  await signInAdmin(page);
  await page.goto('/cart');
  await expect(page.getByText('Back-office accounts don’t shop')).toBeVisible();
  await page.goto('/account');
  await expect(page).toHaveURL(/\/admin\/profile$/);

  await page.goto('/admin/users');
  await page
    .getByRole('button', { name: 'More actions for cam@example.com' })
    .click();
  await page.getByRole('menuitem', { name: 'View as customer' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'View as customer' })
    .click();
  const banner = page.getByTestId('impersonation-banner');
  await expect(banner).toContainText('You’re viewing the shop as Cam Customer');
  await expect(page.getByText('Hi, Cam Customer')).toBeVisible();

  await page.goto('/products?search=Canvas tote');
  await page
    .getByRole('button', { name: 'Add Canvas tote bag to cart' })
    .click();
  await expect(toast(page)).toHaveText('Canvas tote bag added to your cart.');
  await page.goto('/cart');
  await expect(page.getByTestId('cart-line')).toContainText('Canvas tote bag');

  await page.getByRole('button', { name: 'Stop viewing as customer' }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(toast(page)).toHaveText('You’re back as Bo Boss.');
  await expect(banner).toHaveCount(0);

  await page.goto('/admin/audit');
  await page.getByLabel('Area').click();
  await page.getByRole('option', { name: 'Acting as customers' }).click();
  const log = page.getByRole('table', { name: 'Audit log' });
  await expect(log).toContainText('Started acting as a customer');
  await expect(log).toContainText('Stopped acting as a customer');
});

test('staff see where they’re signed in and sign other devices out', async ({
  page,
  freshPage,
}) => {
  await signInAdmin(page);
  const laptop = await freshPage();
  await login(laptop, 'boss@example.com');
  await expect(laptop).toHaveURL(/\/admin/);

  await page.goto('/admin/profile');
  const sessions = page.getByRole('table', { name: 'Sign-in sessions' });
  // Two browsers, plus the session the test helper's sign-up opened.
  await expect(sessions.locator('tbody tr')).toHaveCount(3);
  await expect(sessions).toContainText('This device');
  await page.getByRole('button', { name: 'Sign out other devices' }).click();
  await expect(toast(page)).toHaveText('Signed out of 2 other devices.');
  await expect(sessions.locator('tbody tr')).toHaveCount(1);

  await laptop.reload();
  await expect(laptop).toHaveURL(/\/login/);
});

test('a locked-out customer is unlocked from Users', async ({ page }) => {
  await createUser({
    email: 'cam@example.com',
    firstname: 'Cam',
    lastname: 'Customer',
  });
  for (let i = 0; i < 5; i += 1) {
    await fetch('http://localhost:4100/api/rest/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'cam@example.com',
        password: 'wrong-password',
      }),
    });
  }
  await signInAdmin(page);
  await page.goto('/admin/users');
  const row = page.getByTestId('user-row-cam@example.com');
  await expect(row).toContainText('Locked');
  await page
    .getByRole('button', { name: 'More actions for cam@example.com' })
    .click();
  await page.getByRole('menuitem', { name: 'Unlock account' }).click();
  await expect(toast(page)).toHaveText('cam@example.com can sign in again.');
  await expect(row).not.toContainText('Locked');
});
