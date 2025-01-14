// src/test-utils.js
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

// Default auth context values for testing.
const defaultAuthContextValue = {
  signInWithGoogle: jest.fn(),
  signInWithPassword: jest.fn(),
  sendSignInLink: jest.fn(),
  resetPassword: jest.fn(),
  signUp: jest.fn(),
  logout: jest.fn(),
};

const renderWithProviders = (
  ui,
  { route = '/', authContextValue = defaultAuthContextValue, path = '/' } = {}
) => {
  return render(
    <AuthContext.Provider value={authContextValue}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
};

export * from '@testing-library/react';
export { renderWithProviders };
