// src/tests/login.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import LoginPage from '../pages/LoginPage';
import { login, fetchUserProfile } from '../services/authService';

// Mock the login and fetchUserProfile functions
jest.mock('../services/authService', () => ({
  login: jest.fn(),
  fetchUserProfile: jest.fn(),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders login form', () => {
    render(
      <AuthProvider>
        <Router>
          <LoginPage />
        </Router>
      </AuthProvider>
    );

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in/i })
    ).toBeInTheDocument();
  });

  test('shows error message on invalid credentials', async () => {
    login.mockRejectedValueOnce(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <Router>
          <LoginPage />
        </Router>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'invalid@mail.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  test('navigates to home page on successful login', async () => {
    login.mockResolvedValueOnce({
      access_token: 'mockAccessToken',
      refresh_token: 'mockRefreshToken',
    });
    fetchUserProfile.mockResolvedValueOnce({
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
    });

    render(
      <AuthProvider>
        <Router>
          <LoginPage />
        </Router>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'valid@mail.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'correctpassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/login successful/i)).toBeInTheDocument();
    });
  });
});
