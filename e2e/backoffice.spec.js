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

/** Fills a variation card: option name and its values. */
const fillOption = async (card, name, values) => {
  await card.getByRole('combobox', { name: 'Option name' }).fill(name);
  for (const [i, v] of values.entries()) {
    if (i > 0)
      await card.getByRole('button', { name: 'Add another value' }).click();
    await card.getByRole('textbox', { name: `${name} value ${i + 1}` }).fill(v);
  }
};

test('admin adds a product with variants and a new brand; the shop sells those options', async ({
  page,
}) => {
  await signInAdmin(page);
  await page.goto('/admin/products');
  await page.getByRole('link', { name: 'Add product' }).click();

  // 1. Vital info, with a brand added on the spot.
  await page.getByLabel('Brand', { exact: true }).click();
  await page.getByRole('option', { name: 'Add a new brand…' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Brand name').fill('Summit Gear');
  await dialog.getByRole('button', { name: 'Save brand' }).click();
  await expect(toast(page)).toHaveText('Brand added.');
  await expect(page.getByLabel('Brand', { exact: true })).toHaveValue(
    'Summit Gear'
  );
  await page.getByLabel('Manufacturer part number').fill('SG-TR-01');

  // 2. Name and a formatted description.
  await page.getByRole('button', { name: /Name and description/ }).click();
  await page.getByLabel('Product name').fill('Trail runner');
  const editor = page.locator('.tiptap');
  await editor.click();
  await page.getByRole('button', { name: 'Bold' }).click();
  await page.keyboard.type('Grippy');
  await page.getByRole('button', { name: 'Bold' }).click();
  await page.keyboard.type(' soles for wet trails.');

  // 3. Product information.
  await page.getByRole('button', { name: /Product information/ }).click();
  await page.getByLabel('Length value').fill('32');
  await page.getByLabel('Width value').fill('12');
  await page.getByLabel('Height value').fill('11');
  await page.getByLabel('Weight value').fill('0.6');
  await page.getByRole('button', { name: 'Add detail' }).click();
  await page.getByLabel('Detail 1 name').fill('Upper');
  await page.getByLabel('Detail 1 value').fill('Recycled mesh');

  // 4. Variations: Color × Size.
  await page.getByRole('button', { name: /Variations/ }).click();
  await page
    .getByLabel('This product has variants, like size or color')
    .check();
  await fillOption(page.getByTestId('variation-0'), 'Color', ['Red', 'Blue']);
  await page.getByRole('button', { name: 'Add another option' }).click();
  await fillOption(page.getByTestId('variation-1'), 'Size', ['42', '43']);
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
  // Formatted description and the Specifications tab.
  await expect(
    page.getByTestId('product-description').locator('strong')
  ).toHaveText('Grippy');
  await page.getByRole('tab', { name: 'Specifications' }).click();
  const specs = page.getByTestId('specifications');
  await expect(specs).toContainText('32 × 12 × 11 cm');
  await expect(specs).toContainText('0.6 kg');
  await expect(specs).toContainText('Recycled mesh');
  await expect(specs).toContainText('SG-TR-01');
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
    .getByRole('button', { name: 'Actions for cam@example.com' })
    .click();
  await page.getByRole('menuitem', { name: 'View as customer' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'View as customer' })
    .click();
  const banner = page.getByTestId('impersonation-banner');
  await expect(banner).toContainText('You’re viewing the shop as Cam Customer');
  await expect(page.getByText('Hi, Cam')).toBeVisible();

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
    .getByRole('button', { name: 'Actions for cam@example.com' })
    .click();
  await page.getByRole('menuitem', { name: 'Unlock account' }).click();
  await expect(toast(page)).toHaveText('cam@example.com can sign in again.');
  await expect(row).not.toContainText('Locked');
});

test('staff open a customer’s account read-only', async ({ page }) => {
  await createUser({
    email: 'cam@example.com',
    firstname: 'Cam',
    lastname: 'Customer',
  });
  await signInAdmin(page);
  await page.goto('/admin/users');
  await page.getByRole('tab', { name: /Customers/ }).click();
  await page
    .getByRole('button', { name: 'Actions for cam@example.com' })
    .click();
  await page.getByRole('menuitem', { name: 'View account' }).click();
  await expect(page).toHaveURL(/\/admin\/users\/\d+$/);
  await expect(
    page.getByRole('heading', { name: 'Cam Customer', level: 1 })
  ).toBeVisible();
  await expect(
    page.getByText('You’re viewing this account read-only.')
  ).toBeVisible();
  await expect(page.getByRole('table', { name: 'Orders' })).toContainText(
    'No orders yet.'
  );
  // Refunds replaced "In cart": the value, linking to their refunds.
  await expect(page.getByTestId('customer-stat-refunds')).toHaveAttribute(
    'href',
    /\/admin\/refunds\?tab=approved&customer=\d+/
  );
  await page.getByTestId('customer-stat-refunds').click();
  await expect(page.getByText('Customer: Cam Customer')).toBeVisible();
  await page.goBack();
  // Viewing isn't acting: no banner, still the admin.
  await expect(page.getByTestId('impersonation-banner')).toHaveCount(0);
  await page.getByRole('link', { name: 'Users' }).first().click();
  await expect(page).toHaveURL(/\/admin\/users$/);
});

test('categories and brands are tables with add dialogs; variation photos stay linked', async ({
  page,
}) => {
  await signInAdmin(page);
  await page.goto('/admin/categories');
  await page.getByRole('button', { name: 'Add category' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Category name').fill('Garden');
  await expect(dialog.getByRole('button', { name: 'Upload' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save category' }).click();
  await expect(toast(page)).toHaveText('Category added.');
  await page
    .getByRole('textbox', { name: 'Search categories and subcategories' })
    .fill('Garden');
  await expect(page.getByTestId('category-row-Garden')).toBeVisible();

  await page.goto('/admin/brands');
  await expect(
    page.getByRole('table', { name: 'Brands' }).locator('tbody tr')
  ).toHaveCount(10); // first page
  await page.getByRole('button', { name: 'Add brand' }).click();
  await page.getByRole('dialog').getByLabel('Brand name').fill('Summit Gear');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save brand' })
    .click();
  await expect(toast(page)).toHaveText('Brand added.');

  // Linked photos load from the product (regression: they used to show 0).
  await page.goto('/admin/products?search=crew-neck');
  await page.getByRole('link', { name: 'Cotton crew-neck shirt' }).click();
  await page.getByRole('button', { name: /Variations/ }).click();
  await expect(
    page.getByRole('button', { name: 'Link images to Black' })
  ).toHaveText('2 images linked');
  await page.getByRole('button', { name: 'Link images to White' }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Photos for Color: White'
  );
  await expect(page.getByRole('dialog').getByText('1 selected')).toBeVisible();
});

test('store settings rename the shop everywhere and add an announcement', async ({
  page,
}) => {
  await signInAdmin(page);
  await page.goto('/admin/settings');
  await expect(page.getByLabel('Shop name')).toBeDisabled();
  await page.getByRole('button', { name: 'Edit settings' }).click();
  await page.getByLabel('Shop name').fill('Nyota Market');
  await page.getByLabel('Announcement bar').fill('Free delivery this week');
  await page.getByLabel('Instagram').fill('https://instagram.com/nyotamarket');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page)).toHaveText('Store settings saved.');
  await expect(page.getByLabel('Shop name')).toBeDisabled();

  await page.goto('/');
  await expect(
    page.getByRole('link', { name: 'Nyota Market home' })
  ).toBeVisible();
  await expect(page.getByText('Free delivery this week')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Instagram' })).toHaveAttribute(
    'href',
    'https://instagram.com/nyotamarket'
  );
  await expect(page).toHaveTitle(/Nyota Market/);
});

test('the store overview loads its figures and the header search finds products', async ({
  page,
}) => {
  await signInAdmin(page);
  await expect(page.getByTestId('admin-page-title')).toHaveText(
    'Store overview'
  );
  for (const id of [
    'kpi-revenue',
    'kpi-orders',
    'kpi-customers',
    'kpi-conversion',
  ])
    await expect(page.getByTestId(id)).toBeVisible();
  await page.getByLabel('Period').click();
  await page.getByRole('option', { name: '7 days' }).click();
  await expect(page.getByText('Share of net sales in 7 days')).toBeVisible();
  await page.getByLabel('Period').click();
  await page.getByRole('option', { name: '12 months' }).click();
  await expect(page.getByText('Share of net sales in 365 days')).toBeVisible();
  const year = new Date().getFullYear();
  await expect(page.getByText(`This year (${year})`)).toBeVisible();
  await expect(page.getByText(`Last year (${year - 1})`)).toBeVisible();
  await expect(page.getByTestId('recent-orders')).toContainText(
    'No orders here yet.'
  );

  await page.getByLabel('Search the back office').fill('iPhone');
  await page.getByRole('menuitem', { name: /Apple iPhone 14/ }).click();
  await expect(page).toHaveURL(/\/admin\/products\/\d+$/);
});

test('financial settings open read-only and show what a shopper pays', async ({
  page,
}) => {
  await signInAdmin(page);
  await page.goto('/admin/finance');
  await expect(page.getByLabel('Tax rate')).toBeDisabled();
  await page.getByRole('button', { name: 'Edit settings' }).click();
  await page.getByLabel('Tax rate').fill('10');
  // The e2e shop adds tax at checkout: $100 + 10% tax.
  await expect(page.getByTestId('finance-example-total')).toHaveText('$110.00');
  await page.getByRole('radio', { name: /Prices include Tax/ }).check();
  await expect(page.getByTestId('finance-example-total')).toHaveText('$100.00');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByLabel('Tax rate')).toHaveValue('8');
});

test('the help card closes to an icon and opens again', async ({ page }) => {
  await signInAdmin(page);
  await page.getByRole('button', { name: 'Close help' }).click();
  await expect(page.getByText('Need some help?')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Open help' }).click();
  await expect(page.getByText('Need some help?')).toBeVisible();
});

test('staff create an order for a customer, invoice it, take an M-Pesa payment and the ledger balances', async ({
  page,
}) => {
  await createUser({
    email: 'jane@example.com',
    firstname: 'Jane',
    lastname: 'Doe',
  });
  await signInAdmin(page);
  await page.goto('/admin/orders/new');
  await page.getByLabel('Customer').fill('Jane');
  await page.getByRole('option', { name: /Jane Doe/ }).click();
  await page.getByLabel('Find a product').fill('Canvas tote');
  await page.getByRole('option', { name: /Canvas tote bag/ }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Street address').fill('1 Market St');
  await page.getByLabel('City or town').fill('Nairobi');
  await page.getByRole('button', { name: 'Create order and invoice' }).click();
  await expect(toast(page)).toContainText('created and invoiced');
  await expect(page).toHaveURL(/\/admin\/orders\/\d+$/);
  await expect(page.getByTestId('order-customer-link')).toHaveText('Jane Doe');
  // Staff-made orders are numbered STF-…, invoices INV-date-time-code.
  await expect(
    page.getByRole('heading', { name: /Order STF-[0-9A-Z]{9}/ })
  ).toBeVisible();

  await page.getByRole('link', { name: 'Invoice', exact: true }).click();
  await expect(page.getByTestId('invoice-document')).toContainText(
    'Canvas tote bag'
  );
  await expect(page.getByTestId('invoice-document')).toContainText(
    /INV-\d{8}-\d{6}-[0-9A-Z]{4}/
  );
  await page.getByRole('button', { name: 'Record payment' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('M-Pesa code').fill('QFT1234XYZ');
  await dialog.getByRole('button', { name: 'Record payment' }).click();
  await expect(toast(page)).toHaveText('Payment recorded.');
  await expect(page.getByTestId('invoice-balance')).toContainText('0.00');
  // The paid/due box isn't repeated inside the invoice in the back office.
  await expect(page.getByTestId('invoice-document')).not.toContainText(
    'Amount due'
  );
  await expect(page.getByTestId('invoice-document')).not.toContainText(
    'Amount paid'
  );

  await page.goto('/admin/payments?search=QFT1234XYZ');
  await expect(page.locator('[data-testid^="payment-"]')).toHaveCount(1);
  await page.goto('/admin/ledger');
  await expect(page.getByTestId('ledger-balanced')).toHaveText(
    'Debits equal credits'
  );
  // One simple row per entry; the details open on click.
  await page.getByRole('row', { name: /Jane Doe paid by M-Pesa/ }).click();
  const journal = page.getByRole('dialog');
  await expect(journal).toContainText('Jane Doe paid by M-Pesa');
  await expect(
    journal.getByRole('cell', { name: 'Mobile money (M-Pesa)' })
  ).toBeVisible();

  await journal.getByRole('button', { name: 'Close' }).click();

  // The bell lists the new order; it can be dismissed and cleared.
  await page.getByRole('button', { name: /^Notifications/ }).click();
  const bell = page.getByTestId('notification-list');
  await expect(bell).toContainText(/New order STF-/);
  // "View all" opens every notification in the standard table.
  await page.getByRole('button', { name: /^View all/ }).click();
  await expect(page).toHaveURL(/\/admin\/notifications$/);
  await expect(
    page.getByRole('table', { name: 'Notifications' })
  ).toContainText(/New order STF-/);
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(
    page.getByRole('table', { name: 'Notifications' })
  ).toContainText('You’re all caught up.');

  // SLA: the new order is open, so its time is "elapsed" and on track.
  await page.goto('/admin/orders');
  await expect(page.getByRole('columnheader', { name: 'SLA' })).toBeVisible();
  await expect(page.getByTestId('sla-cell').first()).toContainText('elapsed');
  await page.getByRole('combobox', { name: 'Date range' }).click();
  await page.getByRole('option', { name: 'Custom range…' }).click();
  await expect(page.getByLabel('From')).toHaveValue(/\d{4}-\d{2}-\d{2}/);
  await expect(page.locator('[data-testid^="admin-order-"]')).toHaveCount(1);

  await page.getByRole('link', { name: 'SLA performance' }).click();
  await expect(page.getByTestId('sla-stat-pending')).toContainText('1');
  await page.locator('[data-testid^="sla-row-"]').first().click();
  await expect(page.getByTestId('sla-stage-row-confirm')).toContainText(
    'In progress'
  );
  await expect(page.getByTestId('sla-stage-row-confirm')).toContainText(
    'On track'
  );
});

test('product search updates as you type, suggests matches and falls back to close matches', async ({
  page,
}) => {
  await signInAdmin(page);
  await page.goto('/admin/products');
  const rows = page.locator('[data-testid^="product-row-"]');
  await expect(rows).toHaveCount(10);
  const box = page.getByRole('combobox', { name: 'Search products' });

  // No Enter: the list and the suggestions follow the typing.
  await box.fill('Canvas low');
  await expect(
    page.getByRole('listbox', { name: 'Suggestions' }).getByRole('option', {
      name: /Canvas low-top sneakers/,
    })
  ).toBeVisible();
  await expect(rows).toHaveCount(1);

  // A SKU that doesn't exist shows its product family instead of nothing.
  await box.fill('ST-CNV-LOW-WHI-99');
  await expect(
    page.getByText('No exact match for “ST-CNV-LOW-WHI-99”')
  ).toBeVisible();
  await expect(rows.first()).toContainText('Canvas low-top sneakers');

  // Clearing brings the full list straight back.
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(rows).toHaveCount(10);
  await expect(page).not.toHaveURL(/search=/);
});

test('idle staff are warned, can stay signed in, and are signed out at the timeout', async ({
  page,
}) => {
  await page.clock.install();
  await signInAdmin(page);
  await page.goto('/admin/orders');
  // Default idle timeout: 60 minutes; the warning comes 2 minutes before.
  await page.clock.fastForward('58:30');
  const dialog = page.getByTestId('session-timeout');
  await expect(dialog).toContainText('Are you still there?');
  await expect(page.getByTestId('session-countdown')).toHaveText(/^1:\d\d$/);
  await dialog.getByRole('button', { name: 'Stay signed in' }).click();
  await expect(dialog).toHaveCount(0);

  // No activity at all this time: signed out with an explanation.
  await page.clock.fastForward(61 * 60 * 1000);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId('app-notification')).toContainText(
    'signed out after 60 minutes without activity'
  );
});

test('SLA targets are set in Store settings and shown on the report', async ({
  page,
}) => {
  await signInAdmin(page);
  await page.goto('/admin/settings');
  await page.getByRole('tab', { name: 'Fulfilment SLA' }).click();
  await page.getByRole('button', { name: 'Edit SLA' }).click();
  const confirm = page.getByTestId('sla-stage-confirm');
  await confirm.getByLabel('Target').fill('12');
  await page.getByRole('button', { name: 'Save SLA' }).click();
  await expect(page.getByTestId('app-notification')).toHaveText(
    'SLA settings saved.'
  );
  await expect(page.getByRole('button', { name: 'Edit SLA' })).toBeVisible();

  await page.goto('/admin/reports/sla');
  await expect(page.getByText('target 12 h')).toBeVisible();
});

test('legal pages: full built-in wording on the shop, edited with formatting in the back office', async ({
  page,
}) => {
  // The shop's Terms page: full wording, settings filled in, a section list.
  await page.goto('/policies/terms');
  await expect(
    page.getByRole('heading', { name: 'Terms and Conditions', level: 1 })
  ).toBeVisible();
  const content = page.getByTestId('policy-content');
  await expect(
    content.getByRole('heading', { name: '12. Limitation of liability' })
  ).toBeVisible();
  await expect(content).not.toContainText('{{');
  await expect(
    page.getByRole('navigation', { name: 'On this page' }).getByRole('link', {
      name: '22. Governing law and disputes',
    })
  ).toBeVisible();

  // Edit the privacy policy with headings, bold text and a setting.
  await signInAdmin(page);
  await page.goto('/admin/legal');
  await page.getByTestId('legal-row-privacy').click();
  await page.getByRole('button', { name: 'Edit page' }).click();
  await page.getByLabel('Page title').fill('Privacy notice');
  const editor = page.locator('.tiptap');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.getByRole('combobox', { name: 'Text style' }).click();
  await page.getByRole('option', { name: 'Heading', exact: true }).click();
  await page.keyboard.type('How we protect you');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Bold' }).click();
  await page.keyboard.type('We never sell your data.');
  await page.getByRole('button', { name: 'Bold' }).click();
  await page.keyboard.type(' Questions: ');
  await page.getByRole('button', { name: 'Insert setting' }).click();
  await page.getByRole('menuitem', { name: /Shop name/ }).click();
  await page.getByRole('tab', { name: 'Preview' }).click();
  await expect(page.getByTestId('legal-preview')).toContainText(
    'Questions: Carlos Shop'
  );
  await page.getByRole('button', { name: 'Save page' }).click();
  await expect(page.getByTestId('app-notification')).toContainText(
    'Privacy notice saved'
  );

  await page.goto('/policies/privacy');
  await expect(
    page.getByRole('heading', { name: 'Privacy notice', level: 1 })
  ).toBeVisible();
  const privacy = page.getByTestId('policy-content');
  await expect(
    privacy.getByRole('heading', { name: 'How we protect you', level: 2 })
  ).toBeVisible();
  await expect(privacy.locator('strong')).toHaveText(
    'We never sell your data.'
  );
  await expect(privacy).toContainText('Questions: Carlos Shop');

  // Back to the built-in wording.
  await page.goto('/admin/legal/privacy');
  await page.getByRole('button', { name: 'Edit page' }).click();
  await page.getByRole('button', { name: 'Reset to built-in wording' }).click();
  await page.getByRole('button', { name: 'Reset page' }).click();
  await expect(page.getByTestId('app-notification')).toHaveText(
    'The built-in wording is back.'
  );
});
