// src/context/AuthContext.js
import React, { createContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

/**
 * Example action code settings for email link sign-in
 * You must whitelist the URL in Firebase console -> Authentication -> Sign-in method -> Email link
 */
const actionCodeSettings = {
  url: 'http://localhost:3000/login', // or your production domain + route
  handleCodeInApp: true, // This is required for email link sign-in
};

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Will store { ...firebaseUser, role: ... }
  const [loading, setLoading] = useState(true);

  /**
   * We check if the user came back via Email Link (Passwordless).
   * If so, we finalize sign-in automatically in a useEffect.
   */
  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      // We might have stored the user's email in localStorage
      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        // If email isn't in storage, ask user
        // or prompt for re-entry in real scenario
        email = window.prompt('Please provide your email for confirmation');
      }
      if (email) {
        signInWithEmailLink(auth, email, window.location.href)
          .then(async (result) => {
            window.localStorage.removeItem('emailForSignIn');
            // Optionally create Firestore doc if new user
            const userRef = doc(db, 'users', result.user.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
              await setDoc(userRef, {
                email: result.user.email,
                role: 'customer',
                createdAt: new Date().toISOString(),
              });
            }
          })
          .catch((error) => {
            console.error('Error completing sign-in with email link:', error);
          });
      }
    }
  }, []);

  /**
   * Listen to Firebase auth state changes
   * and retrieve the user's role from Firestore (if any).
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Attempt to read role or other data from Firestore
        let role = 'customer';
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.role) {
            role = userData.role;
          } else {
            // fallback if no role field
            await setDoc(userRef, { role }, { merge: true });
          }
        } else {
          // If no doc, create one with default role
          await setDoc(userRef, {
            email: firebaseUser.email,
            role,
            createdAt: new Date().toISOString(),
          });
        }

        setUser({
          ...firebaseUser,
          role,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Standard Email/Password Signup
   */
  const signUp = async ({ email, password }) => {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    // Optionally create Firestore doc if new
    const userRef = doc(db, userCredential.user.uid);
    await setDoc(userRef, {
      email,
      role: 'customer',
      createdAt: new Date().toISOString(),
    });
    return userCredential;
  };

  /**
   * Standard Email/Password SignIn
   */
  const signInWithPassword = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  /**
   * Password reset (Forgot Password)
   */
  const resetPassword = async (email) => {
    // If you have custom actionCodeSettings for password reset, pass them here
    await sendPasswordResetEmail(
      auth,
      email /*, customActionCodeSettingsIfAny */
    );
  };

  /**
   * Send Email Link for passwordless sign-in
   */
  const sendSignInLink = async (email) => {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    // Store the email locally so we can finish sign-in
    window.localStorage.setItem('emailForSignIn', email);
  };

  /**
   * Google sign-in
   */
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);

    // If new user, create Firestore doc
    const userRef = doc(db, result.user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        email: result.user.email,
        role: 'customer',
        createdAt: new Date().toISOString(),
      });
    }
    return result;
  };

  /**
   * Sign out
   */
  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const value = {
    user,
    loading,
    signUp,
    signInWithPassword,
    resetPassword, // forgot password
    signInWithGoogle,
    sendSignInLink, // for passwordless
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
