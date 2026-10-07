// src/api/session.js
//
// The access token lives in memory only (never localStorage), so injected
// scripts can't lift it from storage. On reload it is re-issued from the
// httpOnly refresh cookie via POST /rest/refresh.

let accessToken = null;
const expiredListeners = new Set();

export const getAccessToken = () => accessToken;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const clearSession = () => {
  accessToken = null;
};

/** Called when the session can't be refreshed (signed out elsewhere, expired). */
export const onSessionExpired = (listener) => {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
};

export const notifySessionExpired = () => {
  accessToken = null;
  expiredListeners.forEach((listener) => listener());
};
