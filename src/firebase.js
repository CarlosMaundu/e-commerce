// src/firebase.js
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signOut } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

// Set to e.g. "127.0.0.1:9099" to run against the local Auth emulator
// (used by the e2e tests; never set this in production).
const authEmulatorHost = process.env.REACT_APP_FIREBASE_AUTH_EMULATOR_HOST;

// Firebase throws at startup when required config is missing, which blanks the
// whole app. Only initialize when the env vars are present (see .env.example).
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

if (!isFirebaseConfigured) {
  console.warn(
    'Firebase is not configured: set the REACT_APP_FIREBASE_* variables in .env ' +
      '(see .env.example) and restart the dev server. Sign-in is disabled.'
  );
}

const connectEmulator = (authInstance) => {
  if (authEmulatorHost) {
    connectAuthEmulator(authInstance, `http://${authEmulatorHost}`, {
      disableWarnings: true,
    });
  }
};

// Initialize Firebase
const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

// Initialize Firebase Auth
export const auth = app ? getAuth(app) : null;
if (auth) connectEmulator(auth);

// Initialize Firebase Analytics (live binding: null until supported + loaded)
export let analytics = null;
if (app && firebaseConfig.measurementId && !authEmulatorHost) {
  isSupported()
    .then((supported) => {
      if (supported) analytics = getAnalytics(app);
    })
    .catch(() => {});
}

/**
 * Runs `callback` with a throwaway Auth instance so an admin can create
 * accounts without being signed out (createUserWithEmailAndPassword signs the
 * new user in on whichever Auth instance it is given).
 */
export const withSecondaryAuth = async (callback) => {
  if (!isFirebaseConfigured) {
    throw Object.assign(new Error('Firebase is not configured.'), {
      code: 'auth/not-configured',
    });
  }
  const secondaryApp = initializeApp(
    firebaseConfig,
    `secondary-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const secondaryAuth = getAuth(secondaryApp);
  connectEmulator(secondaryAuth);
  try {
    return await callback(secondaryAuth);
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
  }
};
