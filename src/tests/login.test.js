import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import { AuthContext } from '../context/AuthContext';

// Create mocks for AuthContext functions
const mockSignInWithGoogle = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSendSignInLink = jest.fn();
const mockResetPassword = jest.fn();

// Create a dummy navigate function
const mockNavigate = jest.fn();

// Mock react-router-dom hooks
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: { from: '/dashboard' } }),
  };
});

const renderWithProviders = (ui) => {
  return render(
    <AuthContext.Provider
      value={{
        signInWithGoogle: mockSignInWithGoogle,
        signInWithPassword: mockSignInWithPassword,
        sendSignInLink: mockSendSignInLink,
        resetPassword: mockResetPassword,
      }}
    >
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={ui} />
          {/* Add additional routes if necessary */}
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders login options', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText(/Login/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Sign in with Google/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Sign in with Email & Password/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Sign in with Email Link/i })
    ).toBeInTheDocument();
  });

  test('handles Google login success', async () => {
    mockSignInWithGoogle.mockResolvedValueOnce();
    renderWithProviders(<LoginPage />);

    fireEvent.click(
      screen.getByRole('button', { name: /Sign in with Google/i })
    );

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', {
        replace: true,
      });
    });

    // Check for success notification message presence
    expect(
      await screen.findByText(/Logged in with Google successfully!/i)
    ).toBeInTheDocument();
  });

  test('toggles email/password form and handles validation', async () => {
    renderWithProviders(<LoginPage />);
    fireEvent.click(
      screen.getByRole('button', { name: /Sign in with Email & Password/i })
    );

    // Check that Email and Password fields appear
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();

    // Attempt to submit empty form to trigger validation errors
    fireEvent.click(screen.getByRole('button', { name: /Sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
    });
  });

  test('handles email/password submission success', async () => {
    mockSignInWithPassword.mockResolvedValueOnce();
    renderWithProviders(<LoginPage />);
    fireEvent.click(
      screen.getByRole('button', { name: /Sign in with Email & Password/i })
    );

    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const signInButton = screen.getByRole('button', { name: /Sign in$/i });

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(signInButton);

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith(
        'user@example.com',
        'password123'
      );
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', {
        replace: true,
      });
    });

    // Check for success notification message presence
    expect(
      await screen.findByText(/Logged in successfully!/i)
    ).toBeInTheDocument();
  });

  test('handles email link submission', async () => {
    mockSendSignInLink.mockResolvedValueOnce();
    renderWithProviders(<LoginPage />);

    // Toggle to show email link form
    fireEvent.click(
      screen.getByRole('button', { name: /Sign in with Email Link/i })
    );

    const emailInput = screen.getByPlaceholderText(/Your email/i);
    const sendLinkButton = screen.getByRole('button', { name: /Send Link/i });

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.click(sendLinkButton);

    await waitFor(() => {
      expect(mockSendSignInLink).toHaveBeenCalledWith('user@example.com');
    });

    // Check for info notification message presence
    expect(
      await screen.findByText(/We sent a link to user@example.com/i)
    ).toBeInTheDocument();
  });

  test('handles forgot password submission', async () => {
    mockResetPassword.mockResolvedValueOnce();
    renderWithProviders(<LoginPage />);

    // Trigger forgot password form
    fireEvent.click(screen.getByText(/Forgot Password\?/i));

    const forgotEmailInput = screen.getByPlaceholderText(/Your email/i);
    const resetPasswordButton = screen.getByRole('button', {
      name: /Reset Password/i,
    });

    fireEvent.change(forgotEmailInput, {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(resetPasswordButton);

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('user@example.com');
    });

    // Check for info notification message presence
    expect(
      await screen.findByText(/Password reset email sent to user@example.com/i)
    ).toBeInTheDocument();
  });

  test('handles Google login failure', async () => {
    const errorMessage = 'Google login failed';
    mockSignInWithGoogle.mockRejectedValueOnce(new Error(errorMessage));
    renderWithProviders(<LoginPage />);

    fireEvent.click(
      screen.getByRole('button', { name: /Sign in with Google/i })
    );

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });

    // Check for error notification message presence
    expect(await screen.findByText(errorMessage)).toBeInTheDocument();
  });
});
