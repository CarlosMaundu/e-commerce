// e2e/mock-mode.spec.js
// Runs against REACT_APP_DATA_SOURCE=mock: the app talks to the in-browser
// fake backend through the same client code the real backend will use.
const { test, expect } = require('@playwright/test');
const emulator = require('./emulator');

const PASSWORD = 'Str0ng!Pass1';
const ADMIN_EMAIL = 'admin@example.com'; // seeded in src/api/mock/fixtures.js
const toast = (page) => page.getByTestId('app-notification');
const productImage = (page, name) =>
  page.getByRole('img', { name, exact: true });

async function login(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
}

test.beforeEach(async () => {
  await emulator.clearAccounts();
});

test('product list shows the sample catalog and search really filters it', async ({
  page,
}) => {
  await page.goto('/products');
  await expect(productImage(page, 'Denim jacket')).toBeVisible();
  await expect(productImage(page, 'Wireless earbuds')).toBeVisible();

  const search = page.getByRole('textbox', { name: 'Search products' });
  await search.fill('dress');
  await search.press('Enter');
  await expect(page.getByText('Results for “dress”')).toBeVisible();
  await expect(productImage(page, 'Linen summer dress')).toBeVisible();
  await expect(productImage(page, 'Wrap midi dress')).toBeVisible();
  await expect(productImage(page, 'Denim jacket')).toHaveCount(0);
});

test('product page loads details from the contract API', async ({ page }) => {
  await page.goto('/products');
  await productImage(page, 'Denim jacket').click();
  await expect(page).toHaveURL(/\/products\/2$/);
  await expect(page.getByText('Denim jacket').first()).toBeVisible();
});

test('newsletter sign-up succeeds and validates email', async ({ page }) => {
  await page.goto('/');
  const email = page.getByPlaceholder('Enter your email');
  await email.fill('fan@example.com');
  await page.getByRole('button', { name: 'Subscribe' }).click();
  await expect(toast(page)).toHaveText('You’re subscribed to our newsletter.');
});

test('sign-up creates the profile through the account endpoint', async ({
  page,
}) => {
  await page.goto('/register');
  await page.getByLabel('First Name').fill('Grace');
  await page.getByLabel('Last Name').fill('Hopper');
  await page.getByLabel('Email Address').fill('grace@example.com');
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="confirmPassword"]').fill(PASSWORD);
  await page.getByRole('checkbox', { name: /terms and conditions/i }).check();
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByText('Hi, Grace Hopper')).toBeVisible();

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('carlos-shop:mock-db')).users.find(
      (u) => u.email === 'grace@example.com'
    )
  );
  expect(stored).toMatchObject({
    firstname: 'Grace',
    lastname: 'Hopper',
    role: 'customer',
  });
});

test('admin manages users through the admin endpoints', async ({ page }) => {
  await emulator.createAccount(ADMIN_EMAIL, PASSWORD);
  await login(page, ADMIN_EMAIL, PASSWORD);
  await expect(page.getByText('Hi, Ada Admin')).toBeVisible();

  await page.goto('/profile?section=users');
  await expect(page.getByText('Ada Admin (you)')).toBeVisible();
  await page.getByRole('button', { name: 'Edit customer@example.com' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Admin' }).click();
  await dialog.getByRole('button', { name: 'Save changes' }).click();

  await expect(toast(page)).toHaveText('User updated.');
  await expect(page.getByTestId('user-row-customer@example.com')).toContainText(
    'Admin'
  );
});

test('customers can’t open user management', async ({ page }) => {
  await emulator.createAccount('customer@example.com', PASSWORD);
  await login(page, 'customer@example.com', PASSWORD);
  await expect(page.getByText('Hi, Cam Customer')).toBeVisible();

  await page.goto('/profile?section=users');
  await expect(
    page.getByText('You don’t have permission to manage users.')
  ).toBeVisible();
});
