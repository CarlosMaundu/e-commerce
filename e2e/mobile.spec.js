// e2e/mobile.spec.js — the shop on a phone (Pixel 7, see playwright.config):
// the app-like shell — bottom menu, Me tab, full-screen search, sheets that
// Back closes, scroll position kept on Back, a header that gets out of the
// way, and no page wider than the screen.
const { test, expect } = require('@playwright/test');

const noSideScroll = async (page) => {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
};

test('the bottom menu opens the Me tab, which holds help and the shop pages', async ({
  page,
}) => {
  await page.goto('/');
  const nav = page.getByTestId('bottom-nav');
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'Me', exact: true }).click();
  await expect(page).toHaveURL(/\/me$/);
  await expect(
    page.getByRole('link', { name: 'Sign in' }).first()
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'FAQs' }).first()).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Your email for the newsletter' })
  ).toHaveCount(1); // on the Me page only, not in the footer too
  await noSideScroll(page);
});

test('search opens full screen with suggestions; Back returns to the page', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search products' }).click();
  const sheet = page.getByRole('dialog', { name: 'Search' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('searchbox', { name: 'Search products' }).fill('denim');
  const suggestion = sheet.getByRole('button', { name: /Denim jacket/ });
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await expect(page).toHaveURL(/\/products\/\d+$/);
  await expect(sheet).toBeHidden();

  // One Back: straight to the home page (the search left no extra step).
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeHidden();

  // Search is on every page, not just home and the product list.
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeHidden();
  await expect(page).toHaveURL(/\/cart$/);
});

test('Back closes the filters sheet instead of leaving the page', async ({
  page,
}) => {
  await page.goto('/');
  await page.goto('/products');
  await page.getByRole('button', { name: /^Filters/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Filters' });
  await expect(sheet).toBeVisible();
  await page.goBack();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/products$/);
  // Closing it with its button leaves history as it was.
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('button', { name: 'Close filters' }).click();
  await expect(sheet).toBeHidden();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test('Back returns to the same spot in the list; the header hides while scrolling down', async ({
  page,
}) => {
  await page.goto('/products');
  const cards = page.getByTestId('product-card');
  await expect(cards.nth(11)).toBeVisible();
  const header = page.getByRole('banner');

  await page.mouse.wheel(0, 900);
  await expect(header).toHaveAttribute('data-hidden', 'true');
  // Bring a card into view first, so clicking it doesn't scroll the page.
  await cards.nth(11).scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => window.scrollY);
  expect(y).toBeGreaterThan(400);

  await cards.nth(11).click({ position: { x: 24, y: 24 } }); // its photo
  await expect(page).toHaveURL(/\/products\/\d+$/);
  // A new page starts at the top.
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);

  await page.goBack();
  await expect(page).toHaveURL(/\/products$/);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(y - 60);

  await page.mouse.wheel(0, -300);
  await expect(header).not.toHaveAttribute('data-hidden', 'true');
});

for (const path of ['/', '/products', '/cart', '/support', '/faq']) {
  test(`${path} fits the screen`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByTestId('bottom-nav')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await noSideScroll(page);
  });
}

test('home on a phone: offer carousel, category circles, a moving picks row, four most viewed', async ({
  page,
}) => {
  await page.goto('/');
  const carousel = page.getByTestId('hero-carousel');
  await expect(carousel).toBeVisible();
  // It moves on by itself.
  await expect(
    carousel.getByRole('button', { name: 'Show offer 1' })
  ).toHaveAttribute('aria-current', 'true');
  await expect(
    carousel.getByRole('button', { name: 'Show offer 2' })
  ).toHaveAttribute('aria-current', 'true', { timeout: 9000 });

  const circles = page.getByRole('navigation', { name: 'Shop by category' });
  await expect(circles.getByRole('link').first()).toBeVisible();

  const train = page.getByTestId('curated-train');
  await expect(train).toBeVisible();
  const moved = await train
    .locator(':scope > div')
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(moved).not.toBe('none');

  // "Why shop with us" stays on desktop.
  await expect(
    page.getByRole('heading', { name: /Innovative solutions/ })
  ).toBeHidden();

  const best = page.getByTestId('best-viewed');
  await expect(best.getByTestId('product-card')).toHaveCount(4);
  await page.getByRole('link', { name: 'View more' }).click();
  await expect(page).toHaveURL(/\/products\?sort=popular$/);
  await expect(
    page.getByRole('heading', { name: 'Best viewed this week', level: 1 })
  ).toBeVisible();
});

test('the phone menu has categories but no second search box', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  const menu = page.locator('.MuiDrawer-paper');
  await expect(menu.getByRole('link', { name: 'All products' })).toBeVisible();
  await expect(menu.getByRole('button', { name: /search/i })).toHaveCount(0);
  await expect(menu.getByRole('textbox')).toHaveCount(0);
});
