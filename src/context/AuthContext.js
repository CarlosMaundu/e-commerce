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
  updateProfile, // Import updateProfile for setting displayName
} from 'firebase/auth';
import { logEvent } from 'firebase/analytics';
import { auth, analytics } from '../firebase';

// Import required API service methods
import {
  createUser as createUserInAPI,
  getAllUsers,
} from '../services/userService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // API user profile with role, etc.
  const [firebaseUser, setFirebaseUser] = useState(null); // Firebase user object
  const [loading, setLoading] = useState(true); // Loading indicator for initial auth check

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
              password: 'temporary', // You may omit or handle password differently
              avatar: fbUser.photoURL || '',
            });
          }
          setUser(profile);
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
    // onAuthStateChanged will handle subsequent profile sync
    return result.user;
  };

  const signInWithPassword = async (email, password) => {
    logEvent(analytics, 'login_attempt', { method: 'email_password' });
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      // Firebase error: Likely due to user not registered with Firebase
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
    const user = result.user;
    // Update Firebase profile with display name
    await updateProfile(user, {
      displayName: `${firstName} ${lastName}`,
    });
    // onAuthStateChanged will handle profile sync
    return user;
  };

  const logout = async () => {
    await signOut(auth);
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
    logout,
    updateUser, // Include the new updateUser function
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
