// src/tests/login.test.js
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../pages/LoginPage';
import { renderWithProviders } from '../test-utils';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const firebaseError = (code) =>
  Object.assign(new Error(`Firebase: Error (${code}).`), { code });

const setup = (overrides = {}) => {
  const auth = {
    user: null,
    signInWithGoogle: jest.fn(),
    signInWithPassword: jest.fn(),
    sendSignInLink: jest.fn(),
    resetPassword: jest.fn(),
    ...overrides,
  };
  renderWithProviders(<LoginPage />, {
    route: '/login',
    path: '/login',
    authContextValue: auth,
  });
  return auth;
};

const fillAndSubmit = (email, password) => {
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: email },
  });
  fireEvent.change(
    screen.getByLabelText(
      (content, el) => el.tagName === 'INPUT' && el.name === 'password'
    ),
    { target: { value: password } }
  );
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
};

describe('LoginPage', () => {
  beforeEach(() => jest.clearAllMocks());

  test('signs in with email and password and redirects', async () => {
    const auth = setup();
    fillAndSubmit('jane@example.com', 'secret123');

    await waitFor(() =>
      expect(auth.signInWithPassword).toHaveBeenCalledWith(
        'jane@example.com',
        'secret123'
      )
    );
    expect(await screen.findByText(/you’re signed in/i)).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  test('shows a friendly message for wrong credentials, never the raw Firebase error', async () => {
    setup({
      signInWithPassword: jest
        .fn()
        .mockRejectedValue(firebaseError('auth/invalid-credential')),
    });
    fillAndSubmit('jane@example.com', 'wrong');

    expect(
      await screen.findByText(
        'The email or password is incorrect. Please try again.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/firebase/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/auth\//i)).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('sends a password reset link', async () => {
    const auth = setup({ resetPassword: jest.fn().mockResolvedValue() });
    fireEvent.click(screen.getByText(/forgot password\?/i));
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() =>
      expect(auth.resetPassword).toHaveBeenCalledWith('jane@example.com')
    );
    expect(
      await screen.findByText(/we’ve sent a password reset link/i)
    ).toBeInTheDocument();
  });

  test('shows a friendly message when too many attempts are made', async () => {
    setup({
      signInWithPassword: jest
        .fn()
        .mockRejectedValue(firebaseError('auth/too-many-requests')),
    });
    fillAndSubmit('jane@example.com', 'whatever');
    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
  });
});
