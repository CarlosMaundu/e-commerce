// e2e/auth-and-users.spec.js
const { test: base, expect } = require('@playwright/test');
const emulator = require('./emulator');
const { createFakeStoreApi } = require('./fakeStoreApi');

const AVATAR = 'https://i.imgur.com/kIaFC3J.png';
const PASSWORD = 'Str0ng!Pass1';
const uniqueEmail = (prefix) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`;

const test = base.extend({
  api: async ({}, use) => {
    await use(createFakeStoreApi());
  },
  // Each call returns a page in a fresh browser context (= signed out).
  freshPage: async ({ browser, api }, use) => {
    const contexts = [];
    await use(async () => {
      const context = await browser.newContext();
      contexts.push(context);
      await api.install(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});

test.beforeEach(async () => {
  await emulator.clearAccounts();
});

const toast = (page) => page.getByTestId('app-notification');

async function login(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
}

async function expectNoRawErrors(page) {
  await expect(page.locator('body')).not.toContainText(/firebase|auth\//i);
}

test('sign up creates a Firebase login and a valid store profile', async ({
  freshPage,
  api,
}) => {
  const page = await freshPage();
  const email = uniqueEmail('signup');
  await page.goto('/register');
  await page.getByLabel('First Name').fill('Grace');
  await page.getByLabel('Last Name').fill('Hopper');
  await page.getByLabel('Email Address').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="confirmPassword"]').fill(PASSWORD);
  await page.getByRole('checkbox', { name: /terms and conditions/i }).check();
  await page.getByRole('button', { name: /create account/i }).click();

  await expect(toast(page)).toContainText('Your account has been created');
  await expect(page.getByText('Hi, Grace Hopper')).toBeVisible();

  const profile = api.find(email);
  expect(profile).toMatchObject({ name: 'Grace Hopper', role: 'customer' });
  expect(profile.avatar).toMatch(/^https:\/\//);
  expect(profile.password).toMatch(/^[a-zA-Z0-9]+$/);
  expect(profile.password).not.toBe(PASSWORD);

  const accounts = await emulator.listAccounts();
  expect(accounts.map((a) => a.email)).toContain(email);
});

test('wrong password shows a friendly message, never the Firebase error', async ({
  freshPage,
}) => {
  const page = await freshPage();
  const email = uniqueEmail('wrongpw');
  await emulator.createAccount(email, PASSWORD);
  await login(page, email, 'not-the-password');

  await expect(toast(page)).toHaveText(
    'The email or password is incorrect. Please try again.'
  );
  await expectNoRawErrors(page);
  await expect(page).toHaveURL(/\/login$/);
});

test('forgot password: email link lets the user set a new password', async ({
  freshPage,
  api,
}) => {
  const page = await freshPage();
  const email = uniqueEmail('forgot');
  await emulator.createAccount(email, PASSWORD);
  api.users.push({ id: 1, email, name: 'Forgot Me', role: 'customer', avatar: AVATAR });

  await page.goto('/login');
  await page.getByText('Forgot Password?').click();
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: /send reset link/i }).click();
  await expect(toast(page)).toContainText('password reset link');

  const oob = await emulator.latestOobCode(email, 'PASSWORD_RESET');
  expect(oob).toBeTruthy();

  const newPassword = 'N3w!Password';
  await page.goto(`/reset-password?mode=resetPassword&oobCode=${oob.oobCode}`);
  await page.locator('input[name="password"]').fill(newPassword);
  await page.locator('input[name="confirmPassword"]').fill(newPassword);
  await page.getByRole('button', { name: /reset password/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  const page2 = await freshPage();
  await login(page2, email, newPassword);
  await expect(page2.getByText('Hi, Forgot Me')).toBeVisible();
});

test('profile: password change goes to Firebase (old password stops working)', async ({
  freshPage,
  api,
}) => {
  const page = await freshPage();
  const email = uniqueEmail('changepw');
  await emulator.createAccount(email, PASSWORD);
  api.users.push({ id: 2, email, name: 'Pat Change', role: 'customer', avatar: AVATAR });

  await login(page, email, PASSWORD);
  await expect(page.getByText('Hi, Pat Change')).toBeVisible();
  await page.goto('/profile');

  const newPassword = 'An0ther!Pass';
  await page.locator('input[name="currentPassword"]').fill(PASSWORD);
  await page.locator('input[name="newPassword"]').fill(newPassword);
  await page.locator('input[name="confirmNewPassword"]').fill(newPassword);
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(toast(page)).toHaveText(
    'Your profile has been updated. Your password has been changed.'
  );

  const oldLogin = await freshPage();
  await login(oldLogin, email, PASSWORD);
  await expect(toast(oldLogin)).toContainText('email or password is incorrect');

  const newLogin = await freshPage();
  await login(newLogin, email, newPassword);
  await expect(newLogin.getByText('Hi, Pat Change')).toBeVisible();
});

test('profile: wrong current password is explained, profile still saved', async ({
  freshPage,
  api,
}) => {
  const page = await freshPage();
  const email = uniqueEmail('badcurrent');
  await emulator.createAccount(email, PASSWORD);
  api.users.push({ id: 3, email, name: 'Lee Wrong', role: 'customer', avatar: AVATAR });

  await login(page, email, PASSWORD);
  await expect(page.getByText('Hi, Lee Wrong')).toBeVisible();
  await page.goto('/profile');
  await page.locator('input[name="currentPassword"]').fill('incorrect');
  await page.locator('input[name="newPassword"]').fill('An0ther!Pass');
  await page.locator('input[name="confirmNewPassword"]').fill('An0ther!Pass');
  await page.getByRole('button', { name: /save changes/i }).click();

  await expect(toast(page)).toContainText('current password is incorrect');
  await expect(page.getByText('Your current password is incorrect.')).toBeVisible();
  await expectNoRawErrors(page);
});

test('email-link sign-in works on the web without Dynamic Links', async ({
  freshPage,
  api,
}) => {
  const page = await freshPage();
  const email = uniqueEmail('emaillink');
  api.users.push({ id: 4, email, name: 'Link User', role: 'customer', avatar: AVATAR });

  await page.goto('/login');
  await page.getByRole('button', { name: /sign in with email link/i }).click();
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: /send login link/i }).click();
  await expect(toast(page)).toContainText(`We sent a sign-in link to ${email}`);

  const oob = await emulator.latestOobCode(email, 'EMAIL_SIGNIN');
  expect(oob).toBeTruthy();
  // The link's continue URL is our own /finishSignIn page (no Dynamic Links).
  expect(decodeURIComponent(oob.oobLink)).toContain('/finishSignIn');

  await page.goto(
    `/finishSignIn?apiKey=demo-api-key&mode=signIn&oobCode=${oob.oobCode}`
  );
  await expect(page.getByText('Hi, Link User')).toBeVisible();
});

test.describe('admin user management', () => {
  const adminEmail = 'admin-e2e@example.com';

  const signInAsAdmin = async (freshPage, api) => {
    await emulator.createAccount(adminEmail, PASSWORD);
    api.users.push({
      id: 10,
      email: adminEmail,
      name: 'Ada Admin',
      role: 'admin',
      avatar: AVATAR,
    });
    const page = await freshPage();
    await login(page, adminEmail, PASSWORD);
    await expect(page.getByText('Hi, Ada Admin')).toBeVisible();
    await page.goto('/profile?section=users');
    await expect(page.getByRole('table', { name: 'Users' })).toBeVisible();
    return page;
  };

  test('admin can create a user, who gets a password-setup email', async ({
    freshPage,
    api,
  }) => {
    const page = await signInAsAdmin(freshPage, api);
    const email = uniqueEmail('created');

    await page.getByRole('button', { name: 'Add user' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full name').fill('New Hire');
    await dialog.getByLabel('Email').fill(email);
    await dialog.getByRole('button', { name: 'Add user' }).click();

    await expect(toast(page)).toContainText(`We emailed ${email} a link`);
    await expect(page.getByTestId(`user-row-${email}`)).toBeVisible();
    // Admin is still signed in as themselves.
    await expect(page.getByText('Ada Admin (you)')).toBeVisible();

    expect(api.find(email)).toMatchObject({ name: 'New Hire', role: 'customer' });
    const accounts = await emulator.listAccounts();
    expect(accounts.map((a) => a.email)).toContain(email);
    const oob = await emulator.latestOobCode(email, 'PASSWORD_RESET');
    expect(oob).toBeTruthy();

    // The new user can set a password from that email and sign in.
    const userPage = await freshPage();
    await userPage.goto(
      `/reset-password?mode=resetPassword&oobCode=${oob.oobCode}`
    );
    await userPage.locator('input[name="password"]').fill('F1rst!Login');
    await userPage.locator('input[name="confirmPassword"]').fill('F1rst!Login');
    await userPage.getByRole('button', { name: /reset password/i }).click();
    await expect(userPage.getByRole('dialog')).toBeVisible();
    await login(userPage, email, 'F1rst!Login');
    await expect(userPage.getByText('Hi, New Hire')).toBeVisible();
  });

  test('duplicate email gives a clear message', async ({ freshPage, api }) => {
    const page = await signInAsAdmin(freshPage, api);
    await page.getByRole('button', { name: 'Add user' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full name').fill('Dup');
    await dialog.getByLabel('Email').fill(adminEmail);
    await dialog.getByRole('button', { name: 'Add user' }).click();
    await expect(toast(page)).toHaveText('A user with this email already exists.');
  });

  test('admin can edit a user and change their role', async ({
    freshPage,
    api,
  }) => {
    const email = uniqueEmail('editme');
    api.users.push({ id: 11, email, name: 'Edit Me', role: 'customer', avatar: AVATAR });
    const page = await signInAsAdmin(freshPage, api);

    await page.getByRole('button', { name: `Edit ${email}` }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full name').fill('Edited Name');
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Admin' }).click();
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(toast(page)).toHaveText('User updated.');
    const row = page.getByTestId(`user-row-${email}`);
    await expect(row).toContainText('Edited Name');
    await expect(row).toContainText('Admin');
    expect(api.find(email)).toMatchObject({ name: 'Edited Name', role: 'admin' });
  });

  test('admin password reset works even for users with no login yet', async ({
    freshPage,
    api,
  }) => {
    const email = uniqueEmail('nologin');
    api.users.push({ id: 12, email, name: 'No Login', role: 'customer', avatar: AVATAR });
    const page = await signInAsAdmin(freshPage, api);

    await page.getByRole('button', { name: `Reset password for ${email}` }).click();
    await page.getByRole('button', { name: 'Send email' }).click();

    await expect(toast(page)).toHaveText(`Password reset email sent to ${email}.`);
    expect(await emulator.latestOobCode(email, 'PASSWORD_RESET')).toBeTruthy();
  });

  test('customers cannot reach admin pages', async ({ freshPage, api }) => {
    const email = uniqueEmail('customer');
    await emulator.createAccount(email, PASSWORD);
    api.users.push({ id: 13, email, name: 'Cus Tomer', role: 'customer', avatar: AVATAR });
    const page = await freshPage();
    await login(page, email, PASSWORD);
    await expect(page.getByText('Hi, Cus Tomer')).toBeVisible();

    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/profile?section=users');
    await expect(
      page.getByText('You don’t have permission to manage users.')
    ).toBeVisible();
  });
});
