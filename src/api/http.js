// src/api/http.js
//
// Axios client for our API contract (OpenCart-style). It:
//  - attaches the signed-in user's Firebase ID token (replaces OpenCart's
//    static X-Oc-Merchant-Id key, which would be public in a browser app)
//  - sends the shopper's currency and language like OpenCart's X-Oc-* headers
//  - unwraps the { success, error[], data } envelope, turning error[] into a
//    UserFacingError so screens can pass it straight to notify.error().
import axios from 'axios';
import { auth } from '../firebase';
import { UserFacingError } from '../utils/friendlyError';

const readPreference = (key, fallback) => {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

const defaultGetToken = async () =>
  auth?.currentUser ? auth.currentUser.getIdToken() : null;

/** Builds an error from an envelope's error[] (null if it has none). */
export const envelopeError = (body, status) => {
  const raw = Array.isArray(body?.error) ? body.error : [body?.error];
  const messages = raw.filter((m) => typeof m === 'string' && m.trim());
  if (!messages.length) return null;
  const error = new UserFacingError(messages.join(' '), `api/${status}`);
  error.status = status;
  error.fieldErrors = body?.field_errors || {};
  return error;
};

/** Returns envelope data, or throws when the envelope reports failure. */
export const unwrapEnvelope = (body, response) => {
  if (!body || typeof body !== 'object' || !('success' in body)) return body;
  if (body.success === 1 || body.success === true) return body.data;
  throw (
    envelopeError(body, response?.status ?? 200) ||
    Object.assign(new Error('Request failed'), { response })
  );
};

export const createHttpClient = ({
  baseURL,
  adapter,
  getToken = defaultGetToken,
} = {}) => {
  const client = axios.create({ baseURL, adapter, timeout: 20000 });

  client.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    config.headers['X-Oc-Currency'] = readPreference('currency', 'USD');
    config.headers['X-Oc-Merchant-Language'] = readPreference(
      'language',
      'en-gb'
    );
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      response.data = unwrapEnvelope(response.data, response);
      return response;
    },
    (error) =>
      Promise.reject(
        (error.response &&
          envelopeError(error.response.data, error.response.status)) ||
          error
      )
  );

  return client;
};
