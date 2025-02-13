// src/context/AuthContext.js
// src/context/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  sendSignInLinkToEmail,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { logEvent } from 'firebase/analytics';
import { auth, analytics } from '../firebase';
import {
  createUser as createUserInAPI,
  getAllUsers,
  fetchUserProfile,
} from '../services/userService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // API user profile with role, etc.
  const [firebaseUser, setFirebaseUser] = useState(null); // Firebase user object
  const [loading, setLoading] = useState(true); // Loading indicator for initial auth check
  const [isLoggingIn, setIsLoggingIn] = useState(false); // New state for login status

  // Helper function to get a user by email using existing API services
  const getUserByEmail = async (email) => {
    const allUsers = await getAllUsers();
    return allUsers.find((u) => u.email === email);
  };

  // Initialize Firebase Auth state change listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        // Log successful sign in event
        logEvent(analytics, 'login_success', { userId: fbUser.uid });

        // Synchronize with external API profile using email
        try {
          let profile = await getUserByEmail(fbUser.email);
          if (!profile) {
            // Create new user profile in API if it doesn't exist
            profile = await createUserInAPI({
              name: fbUser.displayName || 'New User',
              email: fbUser.email,
              password: 'temporary', // Temporary placeholder password
              avatar: fbUser.photoURL || null, // Firebase photoURL
            });
          }

          // Ensure the avatar is properly normalized
          const normalizedProfile = {
            ...profile,
            avatar: profile.avatar || 'https://i.imgur.com/kIaFC3J.png',
          };

          setUser(normalizedProfile);
        } catch (apiError) {
          console.error('API error:', apiError);
          setUser(null);
        }
      } else {
        // User signed out
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Firebase-based authentication functions
  const signInWithGoogle = async () => {
    logEvent(analytics, 'login_attempt', { method: 'google' });
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  };

  const signInWithPassword = async (email, password) => {
    logEvent(analytics, 'login_attempt', { method: 'email_password' });
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      throw new Error(error.message || 'Email/Password sign-in failed.');
    }
  };

  const sendSignInLink = async (email) => {
    const actionCodeSettings = {
      url: window.location.origin + '/finishSignIn', // Adjust redirect URL as necessary
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
  };

  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  const signUp = async ({ firstName, lastName, email, password }) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const fbUser = result.user;

    // Update Firebase profile with display name
    await updateProfile(fbUser, {
      displayName: `${firstName} ${lastName}`,
    });

    // Create API user profile
    const profile = await createUserInAPI({
      name: `${firstName} ${lastName}`,
      email,
      password,
      avatar: null, // Placeholder, can be updated later
    });

    // Ensure the avatar is normalized
    setUser({
      ...profile,
      avatar: profile.avatar || 'https://i.imgur.com/kIaFC3J.png',
    });

    return fbUser;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setFirebaseUser(null);
  };

  const updateUser = async (updatedUser) => {
    try {
      const profile = await fetchUserProfile(
        auth.currentUser.stsTokenManager.accessToken
      );
      const updatedProfile = { ...profile, ...updatedUser };
      setUser(updatedProfile);
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const value = {
    user,
    firebaseUser,
    loading,
    signInWithGoogle,
    signInWithPassword,
    sendSignInLink,
    resetPassword,
    signUp,
    logout,
    updateUser,
    isLoggingIn, // Expose login status
    setIsLoggingIn, // Expose setter for login status
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
