// src/utils/friendlyError.js
//
// Turns any error the app can hit (Firebase Auth, axios/HTTP, Stripe, plain
// strings) into a sentence that is safe to show to a user. Raw codes such as
// "Firebase: Error (auth/invalid-credential)." must never reach the UI.

export const GENERIC_ERROR = 'Something went wrong. Please try again.';

const FIREBASE_AUTH_MESSAGES = {
  // Sign-in
  'auth/invalid-credential':
    'The email or password is incorrect. Please try again.',
  'auth/invalid-login-credentials':
    'The email or password is incorrect. Please try again.',
  'auth/wrong-password':
    'The email or password is incorrect. Please try again.',
  'auth/user-not-found':
    'We couldn’t find an account with that email. Please check it or create an account.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/missing-email': 'Please enter your email address.',
  'auth/missing-password': 'Please enter your password.',
  'auth/user-disabled':
    'This account has been disabled. Please contact support.',
  'auth/too-many-requests':
    'Too many attempts. Please wait a few minutes and try again, or reset your password.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method. Try signing in another way.',

  // Popups / redirects
  'auth/popup-closed-by-user':
    'The sign-in window was closed before finishing. Please try again.',
  'auth/cancelled-popup-request':
    'The sign-in window was closed before finishing. Please try again.',
  'auth/popup-blocked':
    'Your browser blocked the sign-in window. Please allow pop-ups for this site and try again.',
  'auth/unauthorized-domain':
    'Sign-in isn’t enabled for this website address yet. Please contact support.',
  'auth/operation-not-allowed':
    'This sign-in method isn’t enabled. Please choose another way to sign in.',

  // Sign-up / password rules
  'auth/email-already-in-use':
    'An account with this email already exists. Please sign in instead.',
  'auth/weak-password':
    'Your password is too weak. Use at least 8 characters with a mix of letters, numbers and symbols.',
  'auth/password-does-not-meet-requirements':
    'Your password doesn’t meet the requirements. Use upper and lower case letters, a number and a symbol.',
  'auth/requires-recent-login':
    'For your security, please sign in again before making this change.',
  'auth/credential-already-in-use':
    'This sign-in method is already linked to another account.',

  // Email links / password reset
  'auth/invalid-action-code':
    'This link is invalid or has already been used. Please request a new one.',
  'auth/expired-action-code':
    'This link has expired. Please request a new one.',
  'auth/missing-continue-uri':
    'We couldn’t create the link. Please try again later.',
  'auth/invalid-continue-uri':
    'We couldn’t create the link. Please try again later.',
  'auth/unauthorized-continue-uri':
    'We couldn’t create the link for this website address. Please contact support.',
  'auth/quota-exceeded':
    'We’re sending too many emails right now. Please try again later.',

  // Environment / connectivity
  'auth/network-request-failed':
    'We couldn’t reach the server. Check your internet connection and try again.',
  'auth/internal-error': GENERIC_ERROR,
  'auth/invalid-api-key':
    'Sign-in is temporarily unavailable. Please try again later.',
  'auth/app-not-authorized':
    'Sign-in is temporarily unavailable. Please try again later.',
  'auth/not-configured':
    'Sign-in is unavailable right now. Please try again later.',
};

const HTTP_STATUS_MESSAGES = {
  400: 'Some of the details you entered aren’t valid. Please check them and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You don’t have permission to do that.',
  404: 'We couldn’t find what you were looking for. It may have been removed.',
  409: 'That already exists. Please use a different value.',
  413: 'That file is too large. Please choose a smaller one.',
  422: 'Some of the details you entered aren’t valid. Please check them and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
};

// Validation messages from the store API (e.g. "avatar must be a URL address")
// are written for developers; rewrite the common ones for people.
const API_FIELD_MESSAGES = [
  [/email must be an email/i, 'Please enter a valid email address.'],
  [
    /avatar .*URL/i,
    'Please provide a valid image link for the profile picture.',
  ],
  [/password .*(longer|short|length)/i, 'The password is too short.'],
  [
    /password must contain only letters and numbers/i,
    'The password can only contain letters and numbers.',
  ],
  [
    /price must be a positive number/i,
    'Please enter a price greater than zero.',
  ],
  [/images? .*(URL|empty)/i, 'Please add at least one valid product image.'],
  [/title should not be empty/i, 'Please enter a product title.'],
  [/name should not be empty/i, 'Please enter a name.'],
];

const translateApiMessage = (message) => {
  const match = API_FIELD_MESSAGES.find(([pattern]) => pattern.test(message));
  return match ? match[1] : null;
};

const looksTechnical = (message) =>
  /firebase|auth\/|status code|request failed|network error|undefined|null|exception|typeerror|cannot read|unexpected token|ERR_/i.test(
    message
  );

/**
 * @param {unknown} error - anything thrown or rejected
 * @param {string} [fallback] - context-specific message used when the error
 *   carries nothing user-presentable (e.g. "We couldn't save the product.")
 * @returns {string}
 */
export const friendlyError = (error, fallback = GENERIC_ERROR) => {
  if (!error) return fallback;

  if (typeof error === 'string') {
    return looksTechnical(error) ? fallback : error;
  }

  // Firebase Auth (and anything else exposing a namespaced code)
  const code = error.code || '';
  if (FIREBASE_AUTH_MESSAGES[code]) return FIREBASE_AUTH_MESSAGES[code];
  if (code.startsWith('auth/')) return fallback;

  // Errors we created ourselves and already worded for users
  if (error.userMessage) return error.userMessage;

  // Stripe.js errors
  if (error.type === 'card_error' || error.type === 'validation_error') {
    return error.message || fallback;
  }

  // axios
  if (error.isAxiosError || error.response || error.request) {
    if (!error.response) {
      return 'We couldn’t reach the server. Check your internet connection and try again.';
    }
    const { status, data } = error.response;
    const apiMessages = Array.isArray(data?.message)
      ? data.message
      : data?.message
        ? [data.message]
        : [];
    const translated = apiMessages.map(translateApiMessage).filter(Boolean);
    if (translated.length) return [...new Set(translated)].join(' ');
    if (status >= 500) {
      return 'The server ran into a problem. Please try again in a few minutes.';
    }
    return HTTP_STATUS_MESSAGES[status] || fallback;
  }

  if (error.message && !looksTechnical(error.message)) return error.message;
  return fallback;
};

/** Error whose message is already safe to show to users. */
export class UserFacingError extends Error {
  constructor(userMessage, code) {
    super(userMessage);
    this.userMessage = userMessage;
    if (code) this.code = code;
  }
}
