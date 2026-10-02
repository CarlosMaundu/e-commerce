// e2e/fixtures.js — shared Playwright fixtures and page helpers.
const { test: base, expect } = require('@playwright/test');
const { PASSWORD } = require('./backend');

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

const toast = (page) => page.getByTestId('app-notification');

async function login(page, email, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
}

/** Opens a product page by searching for its exact name. */
async function openProduct(page, name) {
  await page.goto(`/products?search=${encodeURIComponent(name)}`);
  await page.getByRole('img', { name, exact: true }).first().click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
}

/** Opens a row's ⋮ menu and picks an item (the standard admin table). */
async function rowAction(page, rowLabel, item) {
  await page.getByRole('button', { name: `Actions for ${rowLabel}` }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}

module.exports = { test, expect, toast, login, openProduct, rowAction };
