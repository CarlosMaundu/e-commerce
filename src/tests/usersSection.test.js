// src/tests/usersSection.test.js
import React from 'react';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import UsersSection from '../components/profile/users/UsersSection';
import { renderWithProviders } from '../test-utils';
import { adminUsers } from '../api';

jest.mock('../api', () => {
  const actual = jest.requireActual('../api');
  return {
    ...actual,
    adminUsers: { ...actual.adminUsers, list: jest.fn(), update: jest.fn() },
  };
});

const admin = {
  id: 1,
  name: 'Ada Admin',
  email: 'ada@example.com',
  role: 'admin',
  avatar: '',
};
const customer = {
  id: 2,
  name: 'Cam Customer',
  email: 'cam@example.com',
  role: 'customer',
  avatar: '',
};

const setup = (overrides = {}) => {
  const auth = {
    user: admin,
    adminCreateUser: jest.fn(),
    adminSendPasswordReset: jest.fn(),
    updateUser: jest.fn(),
    ...overrides,
  };
  renderWithProviders(<UsersSection />, { authContextValue: auth });
  return auth;
};

describe('UsersSection (admin user management)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    adminUsers.list.mockResolvedValue([admin, customer]);
  });

  test('blocks non-admins', () => {
    setup({ user: customer });
    expect(
      screen.getByText(/don’t have permission to manage users/i)
    ).toBeInTheDocument();
    expect(adminUsers.list).not.toHaveBeenCalled();
  });

  test('lists and searches users', async () => {
    setup();
    expect(await screen.findByText('cam@example.com')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/search users/i), {
      target: { value: 'ada' },
    });
    expect(screen.queryByText('cam@example.com')).not.toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  test('creates a user and confirms the invite email', async () => {
    const auth = setup({
      adminCreateUser: jest.fn().mockResolvedValue({
        id: 3,
        name: 'New Person',
        email: 'new@example.com',
        role: 'customer',
      }),
    });
    await screen.findByText('cam@example.com');
    fireEvent.click(screen.getByRole('button', { name: /add user/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/full name/i), {
      target: { value: 'New Person' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^email/i), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /add user/i }));

    await waitFor(() =>
      expect(auth.adminCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Person',
          email: 'new@example.com',
          role: 'customer',
        })
      )
    );
    expect(
      await screen.findByText(/we emailed new@example.com a link/i)
    ).toBeInTheDocument();
    expect(screen.getByText('new@example.com')).toBeInTheDocument();
  });

  test('shows a friendly error when creating fails', async () => {
    setup({
      adminCreateUser: jest.fn().mockRejectedValue(
        Object.assign(new Error('Firebase: Error (auth/invalid-email).'), {
          code: 'auth/invalid-email',
        })
      ),
    });
    await screen.findByText('cam@example.com');
    fireEvent.click(screen.getByRole('button', { name: /add user/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/full name/i), {
      target: { value: 'X' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^email/i), {
      target: { value: 'x@example.com' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /add user/i }));
    expect(
      await screen.findByText('Please enter a valid email address.')
    ).toBeInTheDocument();
  });

  test('edits a user role', async () => {
    adminUsers.update.mockResolvedValue({ ...customer, role: 'admin' });
    setup();
    await screen.findByText('cam@example.com');
    fireEvent.click(
      screen.getByRole('button', { name: /edit cam@example.com/i })
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.mouseDown(within(dialog).getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: 'Admin' }));
    fireEvent.click(
      within(dialog).getByRole('button', { name: /save changes/i })
    );

    await waitFor(() =>
      expect(adminUsers.update).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ role: 'admin', name: 'Cam Customer' })
      )
    );
    expect(await screen.findByText('User updated.')).toBeInTheDocument();
  });

  test('sends a password reset after confirmation', async () => {
    const auth = setup({
      adminSendPasswordReset: jest.fn().mockResolvedValue(),
    });
    await screen.findByText('cam@example.com');
    fireEvent.click(
      screen.getByRole('button', {
        name: /reset password for cam@example.com/i,
      })
    );
    fireEvent.click(await screen.findByRole('button', { name: /send email/i }));

    await waitFor(() =>
      expect(auth.adminSendPasswordReset).toHaveBeenCalledWith({
        email: 'cam@example.com',
        name: 'Cam Customer',
      })
    );
    expect(
      await screen.findByText('Password reset email sent to cam@example.com.')
    ).toBeInTheDocument();
  });
});
