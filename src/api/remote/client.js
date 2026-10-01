// src/api/remote/client.js
import { API_BASE_URL, DATA_SOURCE } from '../config';
import { createHttpClient } from '../http';

let client = null;

// Loaded on first use so the fake backend and its sample data stay out of
// the main bundle (only mock mode ever downloads them).
const lazyFakeBackend = async (config) => {
  const { fakeBackendAdapter } = await import('../mock/fakeBackend');
  return fakeBackendAdapter(config);
};

/**
 * The contract client: our real backend in `api` mode, the in-browser fake
 * backend otherwise (mock mode, and demo-mode features the demo API lacks).
 */
export const getRemoteClient = () => {
  if (!client) {
    client =
      DATA_SOURCE === 'api'
        ? createHttpClient({ baseURL: API_BASE_URL })
        : createHttpClient({ baseURL: '/api', adapter: lazyFakeBackend });
  }
  return client;
};

/** Tests can swap in a client with their own adapter/token. */
export const setRemoteClient = (next) => {
  client = next;
};
