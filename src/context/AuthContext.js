// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  sendSignInLinkToEmail,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  updatePassword,
  signOut,
  onAuthStateChanged,
  updateProfile, // Import updateProfile for setting displayName
} from 'firebase/auth';
import { logEvent } from 'firebase/analytics';
import { auth, analytics, withSecondaryAuth } from '../firebase';
import { useNotify } from '../notification/NotificationProvider';
import { MESSAGES } from '../notification/messages';
import { UserFacingError } from '../utils/friendlyError';

import { account, adminUsers } from '../api';

export const AuthContext = createContext();

const track = (eventName, params) => {
  if (analytics) logEvent(analytics, eventName, params);
};

const requireAuth = () => {
  if (!auth) {
    throw new UserFacingError(
      'Sign-in is unavailable right now. Please try again later.',
      'auth/not-configured'
    );
  }
  return auth;
};

// Where Firebase sends people after they use a password-reset or sign-in link.
const actionUrl = (path) => `${window.location.origin}${path}`;

const randomPassword = () =>
  `${crypto.getRandomValues(new Uint32Array(4)).join('-')}Aa1!`;

export const AuthProvider = ({ children }) => {
  const notify = useNotify();
  const [user, setUser] = useState(null); // API user profile with role, etc.
  const [firebaseUser, setFirebaseUser] = useState(null); // Firebase user object
  const [loading, setLoading] = useState(true); // Loading indicator for initial auth check

  // Name typed on the sign-up form. The auth listener fires before
  // updateProfile() finishes, so it reads the name from here.
  const pendingNameRef = useRef(null);

  // Load the user's store profile, created on first sign-in.
  const syncProfile = (fbUser) =>
    account.getProfile({
      email: fbUser.email,
      name: pendingNameRef.current || fbUser.displayName || 'New User',
      avatar: fbUser.photoURL || undefined,
    });

  // Initialize Firebase Auth state change listener
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        // Keep protected routes waiting until the profile is ready.
        setLoading(true);
        track('login_success', { userId: fbUser.uid });

        try {
          setUser(await syncProfile(fbUser));
        } catch (apiError) {
          console.error('Profile sync failed:', apiError);
          setUser(null);
          notify.error(apiError, MESSAGES.auth.profileSyncFailed);
        } finally {
          pendingNameRef.current = null;
        }
      } else {
        // User signed out
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
    // notify is stable; syncProfile only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Firebase-based authentication functions.
  // These rethrow Firebase errors unchanged so callers can pass them to
  // notify.error()/friendlyError(), which map error.code to friendly text.
  const signInWithGoogle = async () => {
    track('login_attempt', { method: 'google' });
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(requireAuth(), provider);
    // onAuthStateChanged will handle subsequent profile sync
    return result.user;
  };

  const signInWithPassword = async (email, password) => {
    track('login_attempt', { method: 'email_password' });
    const result = await signInWithEmailAndPassword(
      requireAuth(),
      email.trim(),
      password
    );
    return result.user;
  };

  // Email-link sign-in for the web uses the app's own URL; it does not depend
  // on Firebase Dynamic Links (only mobile/Cordova link handling did).
  const sendSignInLink = async (email) => {
    const actionCodeSettings = {
      url: actionUrl('/finishSignIn'),
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(
      requireAuth(),
      email.trim(),
      actionCodeSettings
    );
    window.localStorage.setItem('emailForSignIn', email.trim());
  };

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(requireAuth(), email.trim(), {
        url: actionUrl('/login'),
      });
    } catch (error) {
      // Don't reveal whether an account exists for this email.
      if (error.code === 'auth/user-not-found') return;
      throw error;
    }
  };

  const signUp = async ({ firstName, lastName, email, password }) => {
    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
    pendingNameRef.current = displayName;
    try {
      const result = await createUserWithEmailAndPassword(
        requireAuth(),
        email.trim(),
        password
      );
      // Update Firebase profile with display name
      await updateProfile(result.user, { displayName });
      // onAuthStateChanged will handle profile sync
      return result.user;
    } catch (error) {
      pendingNameRef.current = null;
      throw error;
    }
  };

  /**
   * Change the signed-in user's Firebase password. Firebase requires a recent
   * sign-in for this, so we re-authenticate with the current password first.
   */
  const changePassword = async (currentPassword, newPassword) => {
    const current = requireAuth().currentUser;
    if (!current) {
      throw new UserFacingError(MESSAGES.auth.sessionRequired);
    }
    const hasPassword = current.providerData.some(
      (p) => p.providerId === 'password'
    );
    if (!hasPassword) {
      throw new UserFacingError(MESSAGES.profile.noPasswordAccount);
    }
    if (!currentPassword) {
      throw new UserFacingError(MESSAGES.profile.currentPasswordRequired);
    }
    const credential = EmailAuthProvider.credential(
      current.email,
      currentPassword
    );
    await reauthenticateWithCredential(current, credential);
    await updatePassword(current, newPassword);
  };

  /**
   * Make sure `email` has a Firebase login, then email them a link to choose
   * their password. Uses a secondary Auth instance so the admin stays signed
   * in. Firebase's email-enumeration protection makes reset emails "succeed"
   * silently for unknown addresses, so creating the login first is what
   * guarantees the email actually arrives.
   */
  const ensureLoginAndSendReset = async (email, name) => {
    const requiredAuth = requireAuth();
    try {
      await withSecondaryAuth(async (secondaryAuth) => {
        const { user: created } = await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          randomPassword()
        );
        if (name) await updateProfile(created, { displayName: name.trim() });
      });
    } catch (error) {
      // Already has a login (password or Google) — just send the reset.
      if (error.code !== 'auth/email-already-in-use') throw error;
    }
    await sendPasswordResetEmail(requiredAuth, email, {
      url: actionUrl('/login'),
    });
  };

  /** Admin: create a store profile + login for someone else. */
  const adminCreateUser = async ({ name, email, role, avatar }) => {
    const cleanEmail = email.trim().toLowerCase();
    requireAuth();
    if (await adminUsers.findByEmail(cleanEmail)) {
      throw new UserFacingError(
        'A user with this email already exists.',
        'app/profile-exists'
      );
    }
    const profile = await adminUsers.create({
      name,
      email: cleanEmail,
      role,
      avatar,
    });
    await ensureLoginAndSendReset(cleanEmail, name);
    return profile;
  };

  /** Admin: email a password-reset (or first-time setup) link to a user. */
  const adminSendPasswordReset = async ({ email, name }) => {
    await ensureLoginAndSendReset(email.trim().toLowerCase(), name);
  };

  const logout = async () => {
    if (auth) await signOut(auth);
    setUser(null);
    setFirebaseUser(null);
  };

  // Added updateUser function to update local user state
  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  // The context value provided to descendants
  const value = {
    user, // User profile from API
    firebaseUser, // Raw Firebase user object
    loading,
    signInWithGoogle,
    signInWithPassword,
    sendSignInLink,
    resetPassword,
    signUp,
    changePassword,
    adminCreateUser,
    adminSendPasswordReset,
    logout,
    updateUser, // Include the new updateUser function
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
