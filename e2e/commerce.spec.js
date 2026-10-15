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
  await expect(page).not.toHaveURL(/\/login/);
  // Customers see "Hi, First" in the shop; staff see their name in the
  // back office. Either way the first name shows.
  await expect(
    page.getByText(greeting.replace(/^Hi, /, '').split(' ')[0]).first()
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
  // Signed in: the recipient is filled in from the profile.
  await expect(page.getByText('Delivering to')).toContainText('Cam Customer');
  await page.getByLabel('Street address').fill('12 Moi Avenue');
  await page.getByLabel('City or town').fill('Nairobi');
  await page.getByLabel('Phone (for delivery updates)').fill('+254700000000');
  await page.getByRole('button', { name: 'Use this address' }).click();
  await page.getByRole('button', { name: 'Deliver here' }).click();
  await page.getByTestId('shipping-standard').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByTestId('payment-cod').click();
  await page.getByRole('checkbox', { name: /terms and conditions/i }).check();
  await page.getByRole('button', { name: /Place order/ }).click();
  // A success window comes first, then the order summary.
  const success = page.getByTestId('order-success');
  await expect(success).toContainText('Order placed');
  await expect(success).toContainText(/Order WEB-[0-9A-Z]{9} is confirmed/);
  await success.getByRole('button', { name: 'View order details' }).click();
  await expect(success).toHaveCount(0);
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
    page.getByRole('heading', { name: /^Order WEB-[0-9A-Z]{9}$/ })
  ).toBeVisible();
  const { subject } = await linkFromLatestEmail('cam@example.com');
  expect(subject).toMatch(/order WEB-[0-9A-Z]{9}$/);

  // The cart was emptied and the order is listed.
  await page.goto('/cart');
  await expect(page.getByText('Your cart is empty')).toBeVisible();
  await page.goto('/account/orders');
  await expect(page.getByTestId(`order-${id}`)).toContainText('Pending');

  // Account pages: progress, the invoice, tracking and the product link.
  await page.goto(`/account/orders/${id}`);
  await expect(page.getByTestId('order-tracker')).toContainText('Order placed');
  await page.getByRole('link', { name: 'Invoice', exact: true }).click();
  const invoice = page.getByTestId('invoice-document');
  await expect(invoice).toContainText(/INV-\d{8}-\d{6}-[0-9A-Z]{4}/);
  await expect(invoice).toContainText('Nourishing body lotion');
  await expect(invoice).toContainText('Due');
  await page.goto('/account/track');
  await page.getByLabel('Order number').fill(String(id));
  await page.getByRole('button', { name: 'Track', exact: true }).click();
  await expect(page.getByTestId('order-tracker')).toBeVisible();
  await page.goto(`/account/orders/${id}`);
  await page.getByTestId('order-item-link').click();
  await expect(
    page.getByRole('heading', { name: 'Nourishing body lotion', level: 1 })
  ).toBeVisible();
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

  // Staff approve it with instructions; the customer is told what to do.
  await admin.goto('/admin/returns');
  await admin.getByRole('button', { name: /^Actions for return of/ }).click();
  await admin.getByRole('menuitem', { name: /^Approve/ }).click();
  let step = admin.getByRole('dialog');
  await step
    .getByLabel('Instructions for the customer (optional)')
    .fill('Use the prepaid label in the box.');
  await step.getByRole('button', { name: 'Approve return' }).click();
  await expect(toast(admin)).toHaveText(
    'Return approved. The customer has been emailed.'
  );

  await page.goto('/account/returns');
  await page.getByRole('link', { name: /^#\d+$/ }).click();
  await expect(page).toHaveURL(/\/account\/returns\/\d+$/);
  await expect(page.getByTestId('return-next-step')).toContainText(
    'Use the prepaid label in the box.'
  );

  // The item comes back: checked in on the return's page, then refunded.
  await admin.getByRole('tab', { name: /Awaiting item/ }).click();
  await admin
    .getByTestId(/^return-row-/)
    .first()
    .click();
  await expect(admin).toHaveURL(/\/admin\/returns\/\d+$/);
  await admin.getByRole('button', { name: 'Item received' }).click();
  step = admin.getByRole('dialog');
  await step.getByLabel('Don’t restock: damaged or not resellable').check();
  await step.getByRole('button', { name: 'Mark as received' }).click();
  await expect(toast(admin)).toHaveText('Item received.');
  await admin.getByRole('button', { name: 'Refund the customer' }).click();
  await admin
    .getByRole('dialog')
    .getByRole('button', { name: 'Refund' })
    .click();
  await expect(toast(admin)).toHaveText(
    'Refund paid. The customer has been emailed.'
  );
  const timeline = admin.getByTestId('return-timeline');
  await expect(timeline).toContainText('Refunded');
  await expect(timeline).toContainText('Not put back on sale.');
  await expect(admin.getByRole('link', { name: /Refund #\d+/ })).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('return-timeline')).toContainText('paid back');
  await expect(page.getByTestId('return-timeline')).not.toContainText(
    'Not put back on sale.'
  );

  // The refund is listed under Refunds in the customer's account.
  await page
    .getByRole('alert')
    .getByRole('link', { name: 'Refunds', exact: true })
    .click();
  await expect(page).toHaveURL(/\/account\/refunds$/);
  await expect(page.getByText('Return of Canvas tote bag')).toBeVisible();
  await expect(page.getByText('Refunded to you')).toBeVisible();
});

test('an item sent as a gift is charged for its box and prepared before dispatch', async ({
  page,
  freshPage,
}) => {
  await customer();
  await login(page, 'cam@example.com', 'Hi, Cam Customer');
  await addToCart(page, 'Canvas tote bag');
  await page.goto('/cart');
  // Ticking the box opens the gift details; it stays ticked once saved.
  await page
    .getByRole('checkbox', { name: 'Send Canvas tote bag as a gift' })
    .click();
  const gift = page.getByRole('dialog', {
    name: 'Gift this item to a loved one?',
  });
  await gift.getByRole('button', { name: 'Save' }).click();
  await expect(gift.getByText('Who is the gift for?')).toBeVisible();
  await gift.getByLabel('To').fill('Amina');
  await gift.getByLabel('From').fill('Cam');
  await gift.getByRole('checkbox', { name: 'Gift message' }).check();
  await gift.getByLabel('Message (optional)').fill('Happy birthday!');
  await gift.getByRole('radio', { name: /^Silver box/ }).click();
  await gift.getByRole('button', { name: 'Save' }).click();
  await expect(toast(page)).toHaveText('Gift details saved.');
  await expect(
    page.getByText('To Amina · From Cam · Silver box')
  ).toBeVisible();
  const id = await checkout(page);
  await expect(page.getByTestId('gift-note')).toContainText('Amina');
  await expect(page.getByText('Gift boxes')).toBeVisible();

  await createUser({
    email: 'ops@example.com',
    firstname: 'Ola',
    lastname: 'Orders',
    role: 'order_manager',
  });
  const admin = await freshPage();
  await login(admin, 'ops@example.com', 'Hi, Ola Orders');
  await admin.goto(`/admin/orders/${id}`);
  await expect(admin.getByText('Before dispatch')).toBeVisible();
  await expect(
    admin.getByText('Print on the packing slip: “Happy birthday!”')
  ).toBeVisible();
  await setStatus(admin, 'Processing');
  // Shipping is blocked until the gift is ticked off.
  await admin.getByRole('combobox', { name: 'Status' }).click();
  await admin.getByRole('option', { name: 'Shipped', exact: true }).click();
  await admin.getByRole('button', { name: 'Save' }).click();
  await expect(toast(admin)).toContainText('Prepare the gift');
  const prepared = admin.getByRole('checkbox', {
    name: 'Gift prepared: Canvas tote bag',
  });
  await prepared.click(); // ticks once the server has saved it
  await expect(prepared).toBeChecked();
  await expect(admin.getByText(/Done by ops@example.com/)).toBeVisible();
  await setStatus(admin, 'Shipped');
});

test('support end to end: a customer asks, staff reply, the customer replies back', async ({
  page,
  freshPage,
}) => {
  await customer();
  await login(page, 'cam@example.com', 'Hi, Cam Customer');
  await page.goto('/support');
  await page.getByRole('combobox', { name: 'What is it about?' }).click();
  await page.getByRole('option', { name: 'A product question' }).click();
  await page.getByLabel('Subject').fill('Does the tote bag fit a laptop?');
  await page
    .getByLabel('How can we help?')
    .fill('I have a 15 inch laptop. Will it fit in the canvas tote?');
  await page.getByRole('button', { name: 'Send request' }).click();
  const sent = page.getByTestId('support-sent');
  await expect(sent).toContainText(/SUP-[0-9A-Z]{9}/);
  const number = (await sent.textContent()).match(/SUP-[0-9A-Z]{9}/)[0];
  const { subject } = await linkFromLatestEmail('cam@example.com');
  expect(subject).toContain(number);

  // Support staff see it in the inbox and reply.
  await createUser({
    email: 'help@example.com',
    firstname: 'Hana',
    lastname: 'Help',
    role: 'support',
  });
  const staff = await freshPage();
  await login(staff, 'help@example.com', 'Hi, Hana Help');
  await staff.goto('/admin/support');
  await staff.getByTestId(`support-row-${number}`).click();
  await expect(staff.getByTestId('support-thread')).toContainText(
    '15 inch laptop'
  );
  await staff.getByLabel('Reply').fill('Yes, it fits laptops up to 16 inches.');
  await staff.getByRole('button', { name: 'Send reply' }).click();
  await expect(toast(staff)).toHaveText('Reply sent to cam@example.com.');

  // The customer sees the reply in their account and answers.
  await page.goto('/account/support');
  await expect(page.getByTestId(`support-request-${number}`)).toContainText(
    'New reply'
  );
  await page.getByTestId(`support-request-${number}`).click();
  await expect(page.getByTestId('support-thread')).toContainText(
    'Yes, it fits laptops up to 16 inches.'
  );
  await page.getByLabel('Your reply').fill('Great, thank you!');
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect(toast(page)).toHaveText('Reply sent.');
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
});

test('a promo code made in the back office is used at checkout and traced to the order', async ({
  page,
  freshPage,
}) => {
  await createUser({
    email: 'boss@example.com',
    firstname: 'Bea',
    lastname: 'Boss',
    role: 'admin',
  });
  const admin = await freshPage();
  await login(admin, 'boss@example.com', 'Hi, Bea Boss');
  await admin.goto('/admin/promos');
  await admin.getByRole('button', { name: 'New promo code' }).click();
  const dialog = admin.getByRole('dialog');
  await dialog
    .getByRole('textbox', { name: 'Code', exact: true })
    .fill('fresh15');
  await dialog.getByLabel('Description').fill('15% off for new friends');
  await dialog
    .getByRole('spinbutton', { name: 'Discount', exact: true })
    .fill('15');
  await dialog.getByLabel('Uses per customer').fill('1');
  await dialog.getByRole('button', { name: 'Create code' }).click();
  await expect(toast(admin)).toHaveText('FRESH15 created.');
  await expect(admin).toHaveURL(/\/admin\/promos\/FRESH15$/);
  await expect(admin.getByText('Nobody has used this code yet.')).toBeVisible();

  await customer();
  await login(page, 'cam@example.com', 'Hi, Cam Customer');
  await addToCart(page, 'Canvas tote bag');
  await page.goto('/cart');
  await page.getByLabel('Promo code').fill('fresh15');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(toast(page)).toHaveText('Promo code applied.');
  const id = await checkout(page);

  await admin.reload();
  const use = admin.getByTestId(/^promo-use-WEB-/);
  await expect(use).toContainText('Cam Customer');
  await expect(use).toContainText(/INV-/);
  await use.getByRole('link', { name: /^WEB-/ }).click();
  await expect(admin).toHaveURL(new RegExp(`/admin/orders/${id}$`));

  await admin.goto('/admin/promos?tab=active');
  await expect(admin.getByTestId('promo-row-FRESH15')).toContainText('1');
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

test('a deal added in Store settings shows in the top strip only', async ({
  page,
  freshPage,
}) => {
  await createUser({
    email: 'boss@example.com',
    firstname: 'Bea',
    lastname: 'Boss',
    role: 'admin',
  });
  const admin = await freshPage();
  await login(admin, 'boss@example.com', 'Hi, Bea Boss');
  await admin.goto('/admin/settings?tab=home');
  await admin.getByRole('button', { name: 'Add deal' }).click();
  const dialog = admin.getByRole('dialog');
  await dialog.getByLabel('Title').fill('Flash sale on scarves');
  await dialog.getByLabel('Text', { exact: true }).fill('Today only');
  await dialog.getByLabel('Top strip').check();
  await dialog.getByRole('button', { name: 'Add deal' }).click();
  await expect(toast(admin)).toHaveText('Deal added.');
  const up = admin.getByRole('button', {
    name: 'Move “Flash sale on scarves” up',
  });
  while (await up.isEnabled()) {
    await up.click();
    await admin.waitForTimeout(300);
  }
  await expect(
    admin.getByRole('table', { name: 'Deals' }).getByRole('row').nth(1)
  ).toContainText('Flash sale on scarves');

  await page.goto('/');
  await expect(page.getByLabel('Current offers')).toContainText(
    'Flash sale on scarves'
  );
  await expect(page.getByTestId('promo-banner')).toBeVisible();
  await expect(page.getByTestId('promo-banner')).not.toContainText(
    'Flash sale on scarves'
  );
});

test('payment methods are configured in a dialog, saved and tested', async ({
  page,
}) => {
  await createUser({
    email: 'boss@example.com',
    firstname: 'Bea',
    lastname: 'Boss',
    role: 'admin',
  });
  await login(page, 'boss@example.com', 'Hi, Bea Boss');
  await page.goto('/admin/payment-methods');
  const mpesa = page.getByTestId('payment-provider-mpesa');
  await expect(mpesa).toContainText('M-Pesa (Safaricom Daraja)');
  await mpesa.getByRole('button', { name: /^Configure/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^On|^Off/).check();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(
    dialog.getByText('Please enter the business shortcode.')
  ).toBeVisible();
  await dialog.getByLabel('Business shortcode').fill('174379');
  await dialog.getByLabel('Consumer key').fill('ck_example_123');
  await dialog.getByLabel('Consumer secret').fill('cs_example_456');
  await dialog.getByLabel('Passkey (Lipa na M-Pesa Online)').fill('pk_ex_7890');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(toast(page)).toHaveText('M-Pesa (Safaricom Daraja) saved.');
  // Saved secrets show only their last four characters.
  await expect(
    dialog.getByLabel('Passkey (Lipa na M-Pesa Online)')
  ).toHaveAttribute('placeholder', 'Saved: ••••7890');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(mpesa).toContainText('On');
  await expect(mpesa).toContainText('Sandbox');

  // Card payments without keys: the test says what's missing.
  const stripe = page.getByTestId('payment-provider-stripe');
  await stripe.getByRole('button', { name: /^Configure/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Test connection' })
    .click();
  await expect(page.getByTestId('payment-test-result')).toContainText(
    'Add the secret key first.'
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  // Switch M-Pesa off again so other tests see the default set-up.
  await mpesa.getByRole('button', { name: /^Configure/ }).click();
  await page.getByRole('dialog').getByLabel(/^On/).uncheck();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(mpesa).toContainText('Off');
});

test('reports: sales from a real order, products, inventory history and finance', async ({
  page,
  freshPage,
}) => {
  await customer();
  await login(page, 'cam@example.com', 'Hi, Cam Customer');
  await addToCart(page, 'Canvas tote bag');
  await checkout(page);
  await page.goto('/products?search=unicorn%20saddle');
  await expect(
    page
      .getByText(/No exact matches|didn’t find|0 results|No products/i)
      .first()
  ).toBeVisible();

  await createUser({
    email: 'boss@example.com',
    firstname: 'Bea',
    lastname: 'Boss',
    role: 'admin',
  });
  const admin = await freshPage();
  await login(admin, 'boss@example.com', 'Hi, Bea Boss');
  await admin.goto('/admin/reports/sales');
  await expect(admin.getByTestId('report-card-orders')).toContainText('1');
  await expect(admin.getByTestId('report-chart')).toBeVisible();
  await expect(admin.getByTestId('report-table')).toBeVisible();
  // Another period and no comparison.
  await admin.getByRole('combobox', { name: /^Period/ }).click();
  await admin.getByRole('option', { name: 'Last 7 days' }).click();
  await admin.getByRole('combobox', { name: /^Compare with/ }).click();
  await admin.getByRole('option', { name: 'No comparison' }).click();
  await expect(admin).toHaveURL(/range=7/);
  await expect(admin.getByTestId('report-card-orders')).toContainText('1');

  // Products: the tote sold one.
  await admin
    .getByRole('link', { name: 'Products', exact: true })
    .last()
    .click();
  await expect(admin).toHaveURL(/\/admin\/reports\/products/);
  const products = admin.getByTestId('report-table');
  await expect(
    products.getByRole('row', { name: /Canvas tote bag/ })
  ).toContainText('1');

  // Inventory: open the tote's stock history.
  await admin.goto('/admin/reports/inventory');
  await admin
    .getByTestId('report-table')
    .getByRole('link', { name: 'Canvas tote bag' })
    .click();
  await expect(admin).toHaveURL(/product=\d+/);
  await expect(
    admin.getByRole('table', { name: 'Stock history' })
  ).toContainText('Sold');

  // Searches: what wasn't found.
  await admin.goto('/admin/reports/search');
  await expect(admin.getByTestId('report-table')).toContainText(
    'unicorn saddle'
  );

  // Finance: cash on delivery still to collect.
  await admin.goto('/admin/reports/finance');
  await expect(admin.getByTestId('report-card-cod')).not.toContainText('0.00');
  await expect(
    admin.getByRole('table', { name: 'Cash on delivery to collect' })
  ).toContainText(/WEB-/);
});

test('cost prices are edited in one table, and deal clicks reach the Promotions report', async ({
  page,
  freshPage,
}) => {
  // A shopper clicks the deal in the top strip.
  await page.goto('/');
  const strip = page.getByLabel('Current offers');
  await expect(strip).toBeVisible();
  await strip.getByRole('button', { name: 'View deal' }).click();

  await createUser({
    email: 'boss@example.com',
    firstname: 'Bea',
    lastname: 'Boss',
    role: 'admin',
  });
  const admin = await freshPage();
  await login(admin, 'boss@example.com', 'Hi, Bea Boss');
  await admin.goto('/admin/products');
  await admin.getByRole('link', { name: 'Cost prices' }).click();
  await expect(admin).toHaveURL(/\/admin\/products\/costs$/);
  await admin.getByPlaceholder('Search product or SKU').fill('tote');
  const cost = admin.getByLabel('Cost price for Canvas tote bag');
  await cost.fill('9.5');
  await admin.getByRole('button', { name: 'Save 1 change' }).click();
  await expect(toast(admin)).toHaveText('1 cost price saved.');
  await expect(cost).toHaveValue('9.5');

  await admin.goto('/admin/reports/promotions');
  await expect(admin.getByTestId('report-card-deal_clicks')).toContainText('1');
  await expect(
    admin.getByRole('table', { name: 'Deals: views and clicks' })
  ).toBeVisible();
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
  // Built-in roles can be viewed and duplicated, never deleted.
  await page.getByRole('button', { name: 'Actions for Super admin' }).click();
  await expect(
    page.getByRole('menuitem', { name: 'View permissions' })
  ).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'New role' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Role name').fill('Stock clerk');
  await dialog.getByLabel('What is this role for?').fill('Keeps stock up');
  await dialog.getByRole('checkbox', { name: /^Edit products/ }).check();
  await dialog
    .getByRole('checkbox', { name: 'View products, including drafts' })
    .check();
  await dialog.getByRole('button', { name: 'Save role' }).click();
  await expect(toast(page)).toHaveText('Role created.');
  const row = page.getByTestId('role-row-stock_clerk');
  await expect(row).toContainText('Keeps stock up');
  await expect(row).toContainText('2 of 46');

  // The Permissions tab lists who holds each permission.
  await page.getByRole('tab', { name: /Permissions/ }).click();
  await page
    .getByRole('textbox', { name: 'Search permissions' })
    .fill('drafts');
  await expect(page.getByRole('table', { name: 'Permissions' })).toContainText(
    'Stock clerk'
  );
  await page.getByRole('tab', { name: /Roles/ }).click();

  await page.getByRole('button', { name: 'Actions for Stock clerk' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /delete/i })
    .click();
  await expect(toast(page)).toHaveText('Role deleted.');
  await expect(page.getByText('Keeps stock up')).toHaveCount(0);
});

test('frequently bought together adds the ticked items to the cart in one go', async ({
  page,
}) => {
  await customer();
  await login(page, 'cam@example.com', 'Hi, Cam Customer');
  await page.goto('/products?search=Canvas%20tote');
  await page
    .getByRole('link', { name: /Canvas tote bag/ })
    .first()
    .click();
  const bundle = page.getByTestId('bought-together');
  await expect(bundle).toContainText('Frequently bought together');
  await expect(bundle).toContainText('This item: Canvas tote bag');
  const boxes = bundle.getByRole('checkbox');
  const count = await boxes.count();
  expect(count).toBeGreaterThan(1);
  // Untick one complement; the total and the button follow.
  await boxes.nth(count - 1).uncheck();
  await expect(bundle).toContainText(`Total for ${count - 1} items`);
  await bundle.getByRole('button', { name: 'Add bundle to cart' }).click();
  await expect(toast(page)).toHaveText(
    `${count - 1} items added to your cart.`
  );
  await page.goto('/cart');
  await expect(page.getByTestId('cart-line')).toHaveCount(count - 1);
});
