// e2e/orders.mobile.spec.js — orders on a phone: the success sheet after
// checkout, the order page (title in the header, Track and Buy again at the
// bottom), tappable order cards with a ⋮ menu, the period sheet, tracking,
// and the bottom menu stepping aside while typing.
const { test, expect } = require('@playwright/test');
const { PASSWORD, createUser, resetUsers } = require('./backend');

const toast = (page) => page.getByTestId('app-notification');

test.beforeEach(async () => {
  await resetUsers();
});

const signIn = async (page, email) => {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
};

const placeOrder = async (page) => {
  await page.goto('/products?search=Nourishing%20body%20lotion');
  await page
    .getByRole('button', { name: 'Add Nourishing body lotion to cart' })
    .click();
  await expect(toast(page)).toHaveText(
    'Nourishing body lotion added to your cart.'
  );
  await page.goto('/checkout');
  const bar = page.getByTestId('checkout-bar');
  await page.getByLabel('Street address').fill('12 Moi Avenue');
  await page.getByLabel('City or town').fill('Nairobi');
  await page.getByLabel('Phone (for delivery updates)').fill('+254700000000');
  await bar.getByRole('button', { name: 'Use this address' }).click();
  await bar.getByRole('button', { name: 'Deliver here' }).click();
  await page.getByTestId('shipping-standard').click();
  await bar.getByRole('button', { name: 'Continue' }).click();
  await page.getByTestId('payment-cod').click();
  await page.getByRole('checkbox', { name: /terms and conditions/i }).check();
  await bar.getByRole('button', { name: /Place order/ }).click();
};

test('after an order: success sheet, then the order with Track and Buy again', async ({
  page,
}) => {
  await createUser({
    email: 'cam@example.com',
    firstname: 'Cam',
    lastname: 'Customer',
  });
  await signIn(page, 'cam@example.com');
  await placeOrder(page);

  const success = page.getByTestId('order-success');
  await expect(success).toContainText('Order placed');
  await success.getByRole('button', { name: 'View order details' }).click();
  await expect(success).toBeHidden();
  await expect(page).not.toHaveURL(/placed=1/);
  await expect(page.getByText('Your order is confirmed')).toHaveCount(0);

  const header = page.getByTestId('page-bar');
  await expect(header).toContainText(/Order WEB-/);
  await expect(header.getByRole('link', { name: 'Invoice' })).toBeVisible();
  const bar = page.getByTestId('order-bar');
  await expect(bar.getByRole('link', { name: 'Track' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Buy again' })).toBeVisible();

  // My orders: the card opens the order; ⋮ has Track, Invoice, Buy again.
  await page.goto('/account/orders');
  const card = page.locator('[data-testid^="order-"]').first();
  await card.getByRole('button', { name: /More for order/ }).click();
  await page.getByRole('menuitem', { name: 'Track' }).click();
  await expect(page).toHaveURL(/\/account\/track\?order=/);
  await expect(page.getByTestId('order-tracker').first()).toBeInViewport();

  await page.goto('/account/orders');
  await page
    .locator('[data-testid^="order-"]')
    .first()
    .click({ position: { x: 20, y: 80 } });
  await expect(page).toHaveURL(/\/account\/orders\/\d+$/);

  // The period lives in a sheet from the header.
  await page.goto('/account/orders');
  await header.getByRole('button', { name: 'Choose a period' }).click();
  await expect(page.getByRole('dialog', { name: 'Orders from' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Orders from' })).toBeHidden();
});

test('the bottom menu steps aside while typing', async ({ page }) => {
  await page.goto('/support');
  await expect(page.getByTestId('bottom-nav')).toBeVisible();
  await page.getByLabel('Subject').click();
  await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
  await page.getByRole('heading', { level: 1 }).first().click();
  await expect(page.getByTestId('bottom-nav')).toBeVisible();
});
