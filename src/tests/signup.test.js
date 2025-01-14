// src/tests/signup.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SignupPage from '../pages/SignupPage';
import { AuthContext } from '../context/AuthContext';

// Create mocks for AuthContext functions
const mockSignUp = jest.fn();
const mockSignInWithGoogle = jest.fn();
const mockSendSignInLink = jest.fn();

// Create a dummy navigate function
const mockNavigate = jest.fn();

// Mock react-router-dom hooks
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderWithProviders = (ui) => {
  return render(
    <AuthContext.Provider
      value={{
        signUp: mockSignUp,
        signInWithGoogle: mockSignInWithGoogle,
        sendSignInLink: mockSendSignInLink,
      }}
    >
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={ui} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
};

describe('SignupPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders sign up form', () => {
    renderWithProviders(<SignupPage />);
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();

    // Use custom predicate to target the password field by its name attribute
    const passwordInput = screen.getByLabelText(
      (content, element) =>
        element.tagName.toLowerCase() === 'input' && element.name === 'password'
    );
    expect(passwordInput).toBeInTheDocument();

    const confirmPasswordInput = screen.getByLabelText(
      (content, element) =>
        element.tagName.toLowerCase() === 'input' &&
        element.name === 'confirmPassword'
    );
    expect(confirmPasswordInput).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /create account/i })
    ).toBeInTheDocument();
  });

  test('allows user to sign up with email and password', async () => {
    renderWithProviders(<SignupPage />);

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'John' },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });

    const passwordInput = screen.getByLabelText(
      (content, element) =>
        element.tagName.toLowerCase() === 'input' && element.name === 'password'
    );
    const confirmPasswordInput = screen.getByLabelText(
      (content, element) =>
        element.tagName.toLowerCase() === 'input' &&
        element.name === 'confirmPassword'
    );

    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: 'password123' },
    });

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /i accept the terms and conditions/i,
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  test('shows error message on sign up failure', async () => {
    mockSignUp.mockRejectedValueOnce(new Error('Sign up failed'));
    renderWithProviders(<SignupPage />);

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'John' },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });

    const passwordInput = screen.getByLabelText(
      (content, element) =>
        element.tagName.toLowerCase() === 'input' && element.name === 'password'
    );
    const confirmPasswordInput = screen.getByLabelText(
      (content, element) =>
        element.tagName.toLowerCase() === 'input' &&
        element.name === 'confirmPassword'
    );

    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: 'password123' },
    });

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /i accept the terms and conditions/i,
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/sign up failed/i)).toBeInTheDocument();
    });
  });

  test('allows user to sign up with Google', async () => {
    renderWithProviders(<SignupPage />);
    fireEvent.click(
      screen.getByRole('button', { name: /sign up with google/i })
    );
    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
  });

  test('navigates to login page', () => {
    renderWithProviders(<SignupPage />);
    fireEvent.click(
      screen.getByRole('button', { name: /already have an account\? sign in/i })
    );
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
