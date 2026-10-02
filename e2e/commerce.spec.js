// e2e/commerce.spec.js — cart, checkout, orders, returns and roles against
// the real backend (see playwright.config.js).
const { test: base, expect } = require('@playwright/test');
const {
  PASSWORD,
  createUser,
  linkFromLatestEmail,
  resetUsers,
} = require('./backend');

const test = base.extend({
  // Each call returns a page in a fresh browser context (= signed out).
  freshPage: async ({ browser }, use) => {
    const contexts = [];
    await use(async () => {
      const context = await browser.newContext();
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});

test.beforeEach(async () => {
  await resetUsers();
});

const toast = (page) => page.getByTestId('app-notification');

async function login(page, email, greeting) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  // Customers see "Hi, Name" in the shop; staff land in the back office.
  await expect(
    page.getByText(greeting.replace(/^Hi, /, '')).first()
  ).toBeVisible();
}

async function addToCart(page, title) {
  await page.goto(`/products?search=${encodeURIComponent(title)}`);
  await page.getByRole('button', { name: `Add ${title} to cart` }).click();
  await expect(toast(page)).toHaveText(`${title} added to your cart.`);
}

/** Checks out the current cart with a new address and cash on delivery. */
async function checkout(page) {
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page.getByText('Where should we deliver?')).toBeVisible();
  await page.getByLabel('First name').fill('Cam');
  await page.getByLabel('Last name').fill('Customer');
  await page.getByLabel('Street address').fill('12 Moi Avenue');
  await page.getByLabel('City or town').fill('Nairobi');
  await page.getByLabel('Phone (for delivery updates)').fill('+254700000000');
  await page.getByRole('button', { name: 'Use this address' }).click();
  await page.getByRole('button', { name: 'Deliver here' }).click();
  await page.getByTestId('shipping-standard').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByTestId('payment-cod').click();
  await page.getByRole('checkbox', { name: /terms and conditions/i }).check();
  await page.getByRole('button', { name: 'Review order' }).click();
  await expect(page.getByText('Review your order')).toBeVisible();
  await page.getByRole('button', { name: /Place order/ }).click();
  await expect(page.getByText('Your order is confirmed')).toBeVisible();
  const [, id] = page.url().match(/\/account\/orders\/(\d+)/);
  return id;
}

async function setStatus(page, status) {
  await page.getByRole('combobox', { name: 'Status' }).click();
  await page.getByRole('option', { name: status, exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(toast(page)).toHaveText(
    'Order updated and the customer was emailed.'
  );
}

const customer = () =>
  createUser({
    email: 'cam@example.com',
    firstname: 'Cam',
    lastname: 'Customer',
  });

test('a guest cart is kept when the shopper signs in', async ({ page }) => {
  await customer();
  await addToCart(page, 'Nourishing body lotion');
  await page.goto('/cart');
  await expect(page.getByTestId('cart-line')).toHaveCount(1);
  await expect(
    page.getByText('Sign in at checkout to use a promo code.')
  ).toBeVisible();

  await login(page, 'cam@example.com', 'Hi, Cam Customer');
  await page.goto('/cart');
  await expect(page.getByTestId('cart-line')).toHaveCount(1);
  await expect(page.getByTestId('cart-line')).toContainText(
    'Nourishing body lotion'
  );
  // Signed in, the cart lives on the server, so promo codes are offered.
  await expect(page.getByLabel('Promo code')).toBeVisible();
});

test('promo codes are checked by the server', async ({ page }) => {
  await customer();
  await login(page, 'cam@example.com', 'Hi, Cam Customer');
  await addToCart(page, 'Canvas tote bag'); // $15
  await page.goto('/cart');

  await page.getByLabel('Promo code').fill('NOPE');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(toast(page)).toContainText(/isn’t valid|not valid/i);

  // FRIDAY35 needs $50 or more.
  await page.getByLabel('Promo code').fill('FRIDAY35');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(toast(page)).toContainText('$50');

  await page.getByLabel('Promo code').fill('welcome10');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('WELCOME10 applied')).toBeVisible();
  // $15 − 10% = $13.50, plus 8% tax = $14.58
  await expect(page.getByTestId('cart-total')).toHaveText('$14.58');
});

test('checkout places an order the customer can see, and emails them', async ({
  page,
}) => {
  await customer();
  await login(page, 'cam@example.com', 'Hi, Cam Customer');
  await addToCart(page, 'Nourishing body lotion');
  const id = await checkout(page);

  await expect(
    page.getByRole('heading', { name: `Order #${id}` })
  ).toBeVisible();
  const { subject } = await linkFromLatestEmail('cam@example.com');
  expect(subject).toContain(`#${id}`);

  // The cart was emptied and the order is listed.
  await page.goto('/cart');
  await expect(page.getByText('Your cart is empty')).toBeVisible();
  await page.goto('/account/orders');
  await expect(page.getByTestId(`order-${id}`)).toContainText('Pending');
});

test('an order moves through fulfilment and a delivered item can be returned', async ({
  page,
  freshPage,
}) => {
  await customer();
  await login(page, 'cam@example.com', 'Hi, Cam Customer');
  await addToCart(page, 'Canvas tote bag');
  const id = await checkout(page);

  await createUser({
    email: 'ops@example.com',
    firstname: 'Ola',
    lastname: 'Orders',
    role: 'order_manager',
  });
  const admin = await freshPage();
  await login(admin, 'ops@example.com', 'Hi, Ola Orders');
  await admin.goto('/admin/orders');
  await admin.getByTestId(`admin-order-${id}`).click();
  await expect(admin).toHaveURL(new RegExp(`/admin/orders/${id}$`));
  await setStatus(admin, 'Processing');
  await setStatus(admin, 'Shipped');
  await setStatus(admin, 'Delivered');
  await expect(admin.getByRole('combobox', { name: 'Status' })).toContainText(
    'Delivered (current)'
  );

  // The customer sees the new status and asks to return the item.
  await page.goto(`/account/orders/${id}`);
  await expect(page.getByText('Delivered').first()).toBeVisible();
  await page.getByRole('button', { name: 'Return', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: /reason/i }).click();
  await page.getByRole('option', { name: 'Arrived damaged' }).click();
  await dialog.getByRole('button', { name: 'Request return' }).click();
  await expect(toast(page)).toHaveText(
    'Return requested. We’ll email you when it’s reviewed.'
  );

  await admin.goto('/admin/returns');
  await admin.getByRole('button', { name: 'Approve' }).click();
  await expect(toast(admin)).toHaveText('Return marked approved.');

  await page.goto('/account/returns');
  await expect(page.getByText('approved').first()).toBeVisible();
});

test('back-office pages follow the role’s permissions', async ({ page }) => {
  await createUser({
    email: 'cat@example.com',
    firstname: 'Cat',
    lastname: 'Alog',
    role: 'catalog_manager',
  });
  await login(page, 'cat@example.com', 'Hi, Cat Alog');
  await page.goto('/admin/products');
  await expect(page).toHaveURL(/\/admin\/products$/);
  await expect(page.getByRole('link', { name: 'Orders' })).toHaveCount(0);

  await page.goto('/admin/orders');
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/admin/roles');
  await expect(page).toHaveURL(/\/$/);
});

test('a super admin creates, then deletes, a custom role', async ({ page }) => {
  await createUser({
    email: 'root@example.com',
    firstname: 'Sue',
    lastname: 'Per',
    role: 'super_admin',
  });
  await login(page, 'root@example.com', 'Hi, Sue Per');
  await page.goto('/admin/roles');
  await expect(
    page.getByRole('button', { name: 'Delete role Super admin' })
  ).toHaveCount(0); // built-in roles can't be deleted

  await page.getByRole('button', { name: 'New role' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Role name').fill('Stock clerk');
  await dialog.getByLabel('What is this role for?').fill('Keeps stock up');
  await dialog.getByRole('checkbox', { name: 'Edit products' }).check();
  await dialog.getByRole('button', { name: 'Save role' }).click();
  await expect(toast(page)).toHaveText('Role created.');
  await expect(page.getByText('Keeps stock up')).toBeVisible();

  await page.getByRole('button', { name: 'Delete role Stock clerk' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /delete/i })
    .click();
  await expect(toast(page)).toHaveText('Role deleted.');
  await expect(page.getByText('Keeps stock up')).toHaveCount(0);
});
