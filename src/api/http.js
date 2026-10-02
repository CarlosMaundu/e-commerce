// src/api/http.js
//
// Axios client for our API contract (OpenCart-style). It:
//  - sends the in-memory access token as a Bearer header
//  - sends the shopper's currency and language like OpenCart's X-Oc-* headers
//  - on 401, refreshes the session once (httpOnly cookie) and retries
//  - unwraps the { success, error[], data } envelope, turning error[] into a
//    UserFacingError so screens can pass it straight to notify.error().
import axios from 'axios';
import { API_BASE_URL } from './config';
import {
  getAccessToken,
  notifySessionExpired,
  setAccessToken,
} from './session';
import { UserFacingError } from '../utils/friendlyError';

const readPreference = (key, fallback) => {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

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

// Auth endpoints never trigger a refresh-and-retry.
const NO_REFRESH =
  /\/rest\/(login|register|refresh|logout|sociallogin|forgotten|reset-password)$/;

export const createHttpClient = ({ baseURL = API_BASE_URL, adapter } = {}) => {
  const client = axios.create({ baseURL, adapter, timeout: 20000 });
  // Cookies only matter for /rest/refresh and /rest/logout (cookie path).
  client.defaults.withCredentials = true;
  client.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

  let refreshing = null;
  const refreshSession = () => {
    if (!refreshing) {
      refreshing = client
        .post('/rest/refresh')
        .then(({ data }) => {
          setAccessToken(data.access_token);
          return data;
        })
        .finally(() => {
          refreshing = null;
        });
    }
    return refreshing;
  };
  client.refreshSession = refreshSession;

  client.interceptors.request.use((config) => {
    const token = getAccessToken();
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
    async (error) => {
      const { config, response } = error;
      const canRetry =
        response?.status === 401 &&
        config &&
        !config._retried &&
        !NO_REFRESH.test(config.url || '');
      if (canRetry) {
        try {
          await refreshSession();
          return client({ ...config, _retried: true });
        } catch {
          notifySessionExpired();
        }
      }
      return Promise.reject(
        (response && envelopeError(response.data, response.status)) || error
      );
    }
  );

  return client;
};

let client = null;

/** The app-wide client. Tests can replace it with setHttpClient(). */
export const http = () => {
  if (!client) client = createHttpClient();
  return client;
};

export const setHttpClient = (next) => {
  client = next;
};
