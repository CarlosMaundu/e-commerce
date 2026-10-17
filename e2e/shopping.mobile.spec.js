// e2e/shopping.mobile.spec.js — shopping on a phone: the swipeable gallery,
// the buy bar, sections that fold, category chips, the cart's bottom bar and
// a checkout with its own bar (the bottom menu steps aside).
const { test, expect } = require('@playwright/test');
const { PASSWORD, createUser, resetUsers } = require('./backend');

const toast = (page) => page.getByTestId('app-notification');

const openProduct = async (page, name) => {
  await page.goto(`/products?search=${encodeURIComponent(name)}`);
  await page.getByRole('img', { name, exact: true }).first().click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
};

const signIn = async (page, email) => {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
};

const noSideScroll = async (page) => {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
};

test.beforeEach(async () => {
  await resetUsers();
});

test('product page: swipe gallery opens full screen, buy bar, sections fold', async ({
  page,
}) => {
  await openProduct(page, 'Cotton crew-neck shirt');
  const gallery = page.getByTestId('phone-gallery');
  await expect(gallery).toBeVisible();
  await gallery.getByRole('button', { name: /^Open photo 1 of/ }).click();
  const viewer = page.getByRole('dialog', { name: /photos$/ });
  await expect(viewer).toBeVisible();
  await page.goBack(); // Back closes the photos, not the page
  await expect(viewer).toBeHidden();
  await expect(page).toHaveURL(/\/products\/\d+$/);

  const dock = page.getByTestId('buy-dock');
  await expect(dock).toBeVisible();
  await expect(dock.getByRole('button', { name: 'Add to cart' })).toBeVisible();
  await expect(dock.getByRole('button', { name: 'Buy now' })).toBeVisible();

  // Description is open; Reviews opens from the rating link.
  await expect(
    page.getByRole('button', { name: 'Description' })
  ).toHaveAttribute('aria-expanded', 'true');
  await page
    .getByRole('button', { name: /review/ })
    .first()
    .click();
  await expect(
    page.getByRole('button', { name: /^Reviews \(/ })
  ).toHaveAttribute('aria-expanded', 'true');
  await noSideScroll(page);
});

test('Buy now adds the item and heads to checkout', async ({ page }) => {
  await openProduct(page, 'Nourishing body lotion');
  await page
    .getByTestId('buy-dock')
    .getByRole('button', { name: 'Buy now' })
    .click();
  await expect(toast(page)).toHaveText(
    'Nourishing body lotion added to your cart.'
  );
  // Guests sign in first.
  await expect(page).toHaveURL(/\/(checkout|login)/);
});

test('category chips narrow the list and then show subcategories', async ({
  page,
}) => {
  await page.goto('/products');
  const chips = page.getByRole('navigation', { name: 'Categories' });
  await chips.getByRole('button', { name: 'Men', exact: true }).click();
  await expect(page).toHaveURL(/category=\d+/);
  await expect(
    page.getByRole('heading', { name: 'Men', level: 1 })
  ).toBeVisible();
  await chips.getByRole('button', { name: 'Shirts & tees' }).click();
  await expect(
    page.getByRole('heading', { name: 'Shirts & tees', level: 1 })
  ).toBeVisible();
  await chips.getByRole('button', { name: 'All', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'All products', level: 1 })
  ).toBeVisible();
});

test('the cart and checkout keep their main button at the bottom', async ({
  page,
}) => {
  await createUser({
    email: 'cam@example.com',
    firstname: 'Cam',
    lastname: 'Customer',
  });
  await signIn(page, 'cam@example.com');
  await page.goto('/products?search=Nourishing%20body%20lotion');
  await page
    .getByRole('button', { name: 'Add Nourishing body lotion to cart' })
    .click();
  await expect(toast(page)).toHaveText(
    'Nourishing body lotion added to your cart.'
  );

  await page.goto('/cart');
  const bar = page.getByTestId('cart-bar');
  await expect(bar).toBeVisible();
  // My Cart: Back · title · ⋮; untick the only item and checkout waits.
  await expect(page.getByTestId('page-bar')).toContainText('My Cart');
  await expect(page.getByLabel('Current offers')).toHaveCount(0);
  const lotion = page.getByRole('checkbox', {
    name: 'Buy Nourishing body lotion now',
  });
  await lotion.click(); // saved on the server, then shown
  await expect(lotion).not.toBeChecked();
  await expect(
    bar.getByRole('button', { name: 'Tick items to buy' })
  ).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Buy all items now' }).click();
  await expect(lotion).toBeChecked();
  await bar.getByRole('button', { name: 'Check out', exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  await expect(page.getByTestId('page-bar')).toContainText('Checkout');
  // Checkout: no bottom menu, a step line, and its own action bar.
  await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
  await expect(page.getByText('Step 1 of 3 · Delivery address')).toBeVisible();
  await page.getByLabel('Street address').fill('12 Moi Avenue');
  await page.getByLabel('City or town').fill('Nairobi');
  await page.getByLabel('Phone (for delivery updates)').fill('+254700000000');
  const actions = page.getByTestId('checkout-bar');
  // Same two buttons as before, now in the bottom bar.
  await expect(
    actions.getByRole('link', { name: 'Back to cart' })
  ).toBeVisible();
  await actions.getByRole('button', { name: 'Use this address' }).click();
  await actions.getByRole('button', { name: 'Deliver here' }).click();
  await expect(page.getByText('Step 2 of 3 · Delivery option')).toBeVisible();
  await page.getByTestId('shipping-standard').click();
  await actions.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Step 3 of 3 · Payment')).toBeVisible();
  await expect(
    actions.getByRole('button', { name: /^(Pay|Place order)/ })
  ).toBeVisible();
  await noSideScroll(page);

  // The order total folds open to show the items.
  await page.getByRole('button', { name: /^Order total/ }).click();
  await expect(page.getByTestId('checkout-total')).toBeVisible();
});

test('account pages fit the screen, tables become cards, Sign out is in the row', async ({
  page,
}) => {
  await createUser({
    email: 'cam@example.com',
    firstname: 'Cam',
    lastname: 'Customer',
  });
  await signIn(page, 'cam@example.com');
  for (const path of [
    '/account',
    '/account/orders',
    '/account/returns',
    '/account/invoices',
    '/account/addresses',
    '/wishlist',
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await noSideScroll(page);
  }
  await page.goto('/account/orders');
  await expect(
    page
      .getByRole('navigation', { name: 'Account pages' })
      .getByRole('button', { name: 'Sign out' })
  ).toBeVisible();
});

test('product page bar: Back, the title (the product once scrolled), Share and Wishlist; no deal strip', async ({
  page,
}) => {
  await openProduct(page, 'Cotton crew-neck shirt');
  const bar = page.getByTestId('page-bar');
  await expect(bar).toContainText('Product details');
  await expect(bar.getByRole('button', { name: 'Share' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Back' })).toBeVisible();
  await expect(page.getByLabel('Current offers')).toHaveCount(0);
  await expect(page.getByTestId('phone-greeting')).toHaveCount(0);
  await page.mouse.wheel(0, 900);
  await expect(bar).toContainText('Cotton crew-neck shirt');
  // One photo indicator (dots), and the SKU waits under Specifications.
  await expect(page.getByText(/^SKU /)).toBeHidden();
});
