// src/context/AuthContext.js
//
// Sessions come from our backend (backend/src/routes/auth.ts): email and
// password, or Google via Google Identity Services. The access token is kept
// in memory by src/api; a reload restores it from the httpOnly refresh cookie.
import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import {
  account,
  adminUsers,
  auth,
  impersonation,
  onSessionExpired,
} from '../api';
import { canShop } from '../auth/permissions';
import { useNotify } from '../notification/NotificationProvider';
import { MESSAGES } from '../notification/messages';
import { resetToGuest, syncCartAfterSignIn } from '../redux/cartSlice';
import {
  resetWishlistToGuest,
  syncWishlistAfterSignIn,
} from '../redux/wishlistSlice';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const notify = useNotify();
  const [user, setUser] = useState(null); // profile incl. role + permissions
  const [loading, setLoading] = useState(true); // initial session restore
  const dispatch = useDispatch();
  const syncedFor = useRef(null);

  // Cart and wishlist follow the session: merge the guest copies into the
  // account on sign-in, and start a fresh guest cart after sign-out.
  useEffect(() => {
    if (loading) return;
    const id = user?.id ?? null;
    if (id === syncedFor.current) return;
    const wasSignedIn = syncedFor.current !== null;
    syncedFor.current = id;
    if (id !== null && canShop(user)) {
      dispatch(syncCartAfterSignIn());
      dispatch(syncWishlistAfterSignIn());
    } else if (wasSignedIn || id !== null) {
      // Signed out, or a back-office account (they don't shop).
      dispatch(resetToGuest());
      dispatch(resetWishlistToGuest());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading, dispatch]);

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
    if (!created.verificationRequired) setUser(created);
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

  /** Staff: start acting as a customer (their cart, orders and account). */
  const startImpersonation = async (customerId) => {
    const customer = await impersonation.start(customerId);
    setUser(customer);
    return customer;
  };

  /** Back to the staff member's own session (null if it had ended). */
  const stopImpersonation = async () => {
    const staff = await impersonation.stop();
    setUser(staff);
    return staff;
  };

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
    startImpersonation,
    stopImpersonation,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
