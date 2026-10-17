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

const noSideScroll = async (page) => {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
};

test('support conversation: the reply box is pinned at the bottom, like a chat', async ({
  page,
}) => {
  await createUser({
    email: 'cam@example.com',
    firstname: 'Cam',
    lastname: 'Customer',
  });
  await signIn(page, 'cam@example.com');
  await page.goto('/support');
  await page.getByRole('combobox', { name: 'What is it about?' }).click();
  await page.getByRole('option', { name: 'A product question' }).click();
  await page.getByLabel('Subject').fill('Does the tote bag fit a laptop?');
  await page.getByLabel('How can we help?').fill('Will a 15 inch laptop fit?');
  await page.getByRole('button', { name: 'Send request' }).click();
  const sent = page.getByTestId('support-sent');
  const number = (await sent.textContent()).match(/SUP-[0-9A-Z]{9}/)[0];

  await page.goto(`/account/support/${number}`);
  await expect(page.getByTestId('page-bar')).toContainText(number);
  // Phones: the subject sits at the top of the page.
  await expect(
    page.locator('strong', { hasText: 'Does the tote bag fit a laptop?' })
  ).toBeVisible();
  const bar = page.getByTestId('reply-bar');
  await expect(bar).toBeVisible();
  await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
  await bar.getByLabel('Your reply').fill('It is a slim one.');
  await bar.getByRole('button', { name: 'Send reply' }).click();
  await expect(page.getByTestId('support-thread')).toContainText(
    'It is a slim one.'
  );
  await noSideScroll(page);
});

test('addresses, profile and invoice: actions in the header and at the bottom', async ({
  page,
}) => {
  await createUser({
    email: 'cam@example.com',
    firstname: 'Cam',
    lastname: 'Customer',
  });
  await signIn(page, 'cam@example.com');

  // An invoice fits the screen; Print is in the header.
  await placeOrder(page);
  await page
    .getByTestId('order-success')
    .getByRole('button', { name: 'View order details' })
    .click();
  await page
    .getByTestId('page-bar')
    .getByRole('link', { name: 'Invoice' })
    .click();
  await expect(page.getByTestId('invoice-document')).toBeVisible();
  await expect(
    page
      .getByTestId('page-bar')
      .getByRole('button', { name: 'Print or save PDF' })
  ).toBeVisible();
  await noSideScroll(page);

  // Addresses: "+" in the header opens the form with Save pinned below it.
  await page.goto('/account/addresses');
  await page
    .getByTestId('page-bar')
    .getByRole('button', { name: 'Add address' })
    .click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('First name').fill('Cam');
  await sheet.getByLabel('Last name').fill('Customer');
  await sheet.getByLabel('Street address').fill('12 Moi Avenue');
  await sheet.getByLabel('City or town').fill('Nairobi');
  await expect(
    sheet.getByRole('button', { name: 'Save address' })
  ).toBeInViewport();
  await sheet.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByText('12 Moi Avenue').first()).toBeVisible();
  await noSideScroll(page);

  // Profile: edit from the header; Save waits at the bottom.
  await page.goto('/account/profile');
  await page
    .getByTestId('page-bar')
    .getByRole('button', { name: 'Edit profile' })
    .click();
  await expect(
    page
      .getByTestId('profile-bar')
      .getByRole('button', { name: 'Save changes' })
  ).toBeVisible();

  for (const path of [
    '/account/invoices',
    '/account/refunds',
    '/account/returns',
    '/account/support',
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await noSideScroll(page);
  }
});
