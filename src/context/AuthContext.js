// src/context/AuthContext.js
//
// Sessions come from our backend (backend/src/routes/auth.ts): email and
// password, or Google via Google Identity Services. The access token is kept
// in memory by src/api; a reload restores it from the httpOnly refresh cookie.
import React, { createContext, useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { account, adminUsers, auth, onSessionExpired } from '../api';
import { useNotify } from '../notification/NotificationProvider';
import { MESSAGES } from '../notification/messages';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const notify = useNotify();
  const [user, setUser] = useState(null); // profile incl. role + permissions
  const [loading, setLoading] = useState(true); // initial session restore

  useEffect(() => {
    let active = true;
    auth
      .restore()
      .then((restored) => {
        if (active) setUser(restored);
      })
      .catch((error) => {
        // Server unreachable etc. The shop still works signed out.
        console.error('Session restore failed:', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const stop = onSessionExpired(() => {
      setUser((current) => {
        if (current) notify.info(MESSAGES.auth.sessionExpired);
        return null;
      });
    });
    return () => {
      active = false;
      stop();
    };
    // notify is stable for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithPassword = async (email, password, options) => {
    const signedIn = await auth.login(email.trim(), password, options);
    setUser(signedIn);
    return signedIn;
  };

  /** `credential` comes from the Google button (GoogleSignInButton). */
  const signInWithGoogle = async (credential) => {
    const signedIn = await auth.loginWithGoogle(credential);
    setUser(signedIn);
    return signedIn;
  };

  const signUp = async ({ firstName, lastName, email, password }) => {
    const created = await auth.register({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
    });
    setUser(created);
    return created;
  };

  const logout = async () => {
    try {
      await auth.logout();
    } finally {
      setUser(null);
    }
  };

  /** Emails a reset link. Resolves the same whether or not the email exists. */
  const resetPassword = (email) => auth.requestPasswordReset(email);

  const confirmPasswordReset = (token, password) =>
    auth.resetPassword(token, password);

  const changePassword = (currentPassword, newPassword) =>
    account.changePassword(currentPassword, newPassword);

  /** Admin: the backend creates the user and emails a password-setup link. */
  const adminCreateUser = (input) => adminUsers.create(input);

  /** Admin: emails a reset (or first-time setup) link to the user. */
  const adminSendPasswordReset = (target) =>
    adminUsers.sendPasswordReset(target.id);

  const refreshUser = useCallback(async () => {
    const fresh = await account.getProfile();
    setUser(fresh);
    return fresh;
  }, []);

  // Profile screens replace the user after saving.
  const updateUser = (updatedUser) => {
    setUser((current) => ({ ...current, ...updatedUser }));
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    signInWithPassword,
    resetPassword,
    confirmPasswordReset,
    signUp,
    changePassword,
    adminCreateUser,
    adminSendPasswordReset,
    refreshUser,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
