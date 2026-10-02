// e2e/auth-and-users.spec.js — sign-in, sessions and admin user management
// against the real backend (see playwright.config.js).
const { test: base, expect } = require('@playwright/test');
const {
  PASSWORD,
  createUser,
  linkFromLatestEmail,
  resetUsers,
  userRow,
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
const pathOf = (link) => {
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
};

async function login(page, email, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
}

async function setPasswordFromEmail(page, email, password) {
  const { link } = await linkFromLatestEmail(email);
  await page.goto(pathOf(link));
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page
    .getByRole('button', { name: /set password|reset password/i })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('sign up creates the account, signs in, and survives a reload', async ({
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

  await expect(toast(page)).toContainText('Your account has been created');
  await expect(page.getByText('Hi, Grace Hopper')).toBeVisible();
  expect(await userRow('grace@example.com')).toMatchObject({
    role: 'customer',
    firstname: 'Grace',
  });

  // Access token is in memory only; the httpOnly cookie restores the session.
  await page.reload();
  await expect(page.getByText('Hi, Grace Hopper')).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'cs_refresh')).toMatchObject({
    httpOnly: true,
    sameSite: 'Lax',
  });
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toMatch(/access_token|Bearer/);
});

test('wrong password shows a friendly message', async ({ page }) => {
  await createUser({ email: 'jane@example.com' });
  await login(page, 'jane@example.com', 'not-the-password');
  await expect(toast(page)).toHaveText(
    'The email or password is incorrect. Please try again.'
  );
  await expect(page).toHaveURL(/\/login$/);
});

test('signing out ends the session for good', async ({ page }) => {
  await createUser({
    email: 'jane@example.com',
    firstname: 'Jane',
    lastname: 'Doe',
  });
  await login(page, 'jane@example.com');
  await expect(page.getByText('Hi, Jane Doe')).toBeVisible();
  await page.getByRole('button', { name: 'User account' }).click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  await expect(toast(page)).toHaveText('You’ve been signed out.');
  await page.reload();
  await expect(
    page
      .getByRole('button', { name: 'Login' })
      .or(page.getByRole('link', { name: 'Login' }))
  ).toBeVisible();
});

test('forgot password: the emailed link sets a new password', async ({
  page,
  freshPage,
}) => {
  await createUser({
    email: 'forgot@example.com',
    firstname: 'For',
    lastname: 'Got',
  });
  await page.goto('/login');
  await page.getByText('Forgot Password?').click();
  await page.getByLabel('Email Address').fill('forgot@example.com');
  await page.getByRole('button', { name: /send reset link/i }).click();
  await expect(toast(page)).toContainText('password reset link');

  await setPasswordFromEmail(page, 'forgot@example.com', 'N3w!Password');

  const page2 = await freshPage();
  await login(page2, 'forgot@example.com', 'N3w!Password');
  await expect(page2.getByText('Hi, For Got')).toBeVisible();
});

test('a used or bogus reset link is explained', async ({ page }) => {
  await page.goto('/reset-password?token=not-a-real-token');
  await expect(
    page.getByRole('heading', { name: 'This link isn’t valid' })
  ).toBeVisible();
});

test('profile password change signs out other devices', async ({
  page,
  freshPage,
}) => {
  await createUser({
    email: 'pat@example.com',
    firstname: 'Pat',
    lastname: 'Change',
  });
  const phone = await freshPage();
  await login(phone, 'pat@example.com');
  await expect(phone.getByText('Hi, Pat Change')).toBeVisible();

  await login(page, 'pat@example.com');
  await expect(page.getByText('Hi, Pat Change')).toBeVisible();
  await page.goto('/profile');
  await page.locator('input[name="currentPassword"]').fill(PASSWORD);
  await page.locator('input[name="newPassword"]').fill('An0ther!Pass');
  await page.locator('input[name="confirmNewPassword"]').fill('An0ther!Pass');
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(toast(page)).toHaveText(
    'Your profile has been updated. Your password has been changed.'
  );

  // The other device's session was revoked.
  await phone.reload();
  await expect(phone.getByText('Hi, Pat Change')).toHaveCount(0);

  const again = await freshPage();
  await login(again, 'pat@example.com', 'An0ther!Pass');
  await expect(again.getByText('Hi, Pat Change')).toBeVisible();
});

test('wrong current password is explained', async ({ page }) => {
  await createUser({
    email: 'lee@example.com',
    firstname: 'Lee',
    lastname: 'Wrong',
  });
  await login(page, 'lee@example.com');
  await expect(page.getByText('Hi, Lee Wrong')).toBeVisible();
  await page.goto('/profile');
  await page.locator('input[name="currentPassword"]').fill('incorrect');
  await page.locator('input[name="newPassword"]').fill('An0ther!Pass');
  await page.locator('input[name="confirmNewPassword"]').fill('An0ther!Pass');
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(toast(page)).toContainText('current password is incorrect');
});

test.describe('admin user management', () => {
  const signInAsAdmin = async (page) => {
    await createUser({
      email: 'boss@example.com',
      firstname: 'Ada',
      lastname: 'Admin',
      role: 'admin',
    });
    await login(page, 'boss@example.com');
    await expect(page.getByText('Hi, Ada Admin')).toBeVisible();
    await page.goto('/profile?section=users');
    await expect(page.getByRole('table', { name: 'Users' })).toBeVisible();
  };

  test('admin adds a user, who sets a password from the email and signs in', async ({
    page,
    freshPage,
  }) => {
    await signInAsAdmin(page);
    await page.getByRole('button', { name: 'Add user' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full name').fill('New Hire');
    await dialog.getByLabel('Email').fill('hire@example.com');
    await dialog.getByRole('combobox', { name: /role/i }).click();
    await page.getByRole('option', { name: 'Support' }).click();
    await dialog.getByRole('button', { name: 'Add user' }).click();

    await expect(toast(page)).toContainText(
      'We emailed hire@example.com a link'
    );
    await expect(page.getByTestId('user-row-hire@example.com')).toContainText(
      'Support'
    );
    await expect(page.getByText('Ada Admin (you)')).toBeVisible();

    const userPage = await freshPage();
    await setPasswordFromEmail(userPage, 'hire@example.com', 'F1rst!Login');
    await login(userPage, 'hire@example.com', 'F1rst!Login');
    await expect(userPage.getByText('Hi, New Hire')).toBeVisible();
  });

  test('admin changes a role and suspends a user, who is signed out', async ({
    page,
    freshPage,
  }) => {
    await createUser({
      email: 'cam@example.com',
      firstname: 'Cam',
      lastname: 'Customer',
    });
    const camPage = await freshPage();
    await login(camPage, 'cam@example.com');
    await expect(camPage.getByText('Hi, Cam Customer')).toBeVisible();

    await signInAsAdmin(page);
    await page.getByRole('button', { name: 'Edit cam@example.com' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox', { name: /role/i }).click();
    await page.getByRole('option', { name: 'Catalog manager' }).click();
    await dialog.getByRole('combobox', { name: /status/i }).click();
    await page.getByRole('option', { name: 'Suspended' }).click();
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(toast(page)).toHaveText('User updated.');
    const row = page.getByTestId('user-row-cam@example.com');
    await expect(row).toContainText('Catalog manager');
    await expect(row).toContainText('Suspended');

    await camPage.reload();
    await expect(camPage.getByText('Hi, Cam Customer')).toHaveCount(0);
    await login(camPage, 'cam@example.com');
    await expect(toast(camPage)).toHaveText(
      'This account has been suspended. Please contact support.'
    );
  });

  test('admin can’t offer the super admin role or change their own role', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.getByRole('button', { name: 'Edit boss@example.com' }).click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('combobox', { name: /role/i })
    ).toHaveAttribute('aria-disabled', 'true');
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Add user' }).click();
    await page
      .getByRole('dialog')
      .getByRole('combobox', { name: /role/i })
      .click();
    await expect(
      page.getByRole('option', { name: 'Admin', exact: true })
    ).toBeVisible();
    await expect(page.getByRole('option', { name: 'Super admin' })).toHaveCount(
      0
    );
  });

  test('password reset email reaches the user', async ({ page }) => {
    await createUser({
      email: 'cam@example.com',
      firstname: 'Cam',
      lastname: 'Customer',
    });
    await signInAsAdmin(page);
    await page
      .getByRole('button', { name: 'Reset password for cam@example.com' })
      .click();
    await page.getByRole('button', { name: 'Send email' }).click();
    await expect(toast(page)).toHaveText(
      'Password reset email sent to cam@example.com.'
    );
    const { subject } = await linkFromLatestEmail('cam@example.com');
    expect(subject).toBe('Reset your Carlos Shop password');
  });

  test('customers can’t reach admin pages', async ({ page }) => {
    await createUser({
      email: 'cus@example.com',
      firstname: 'Cus',
      lastname: 'Tomer',
    });
    await login(page, 'cus@example.com');
    await expect(page.getByText('Hi, Cus Tomer')).toBeVisible();
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/profile?section=users');
    await expect(
      page.getByText('You don’t have permission to manage users.')
    ).toBeVisible();
  });
});
