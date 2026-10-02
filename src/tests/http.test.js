// src/tests/http.test.js — envelope handling and refresh-and-retry.
import { AxiosError } from 'axios';
import { createHttpClient, unwrapEnvelope } from '../api/http';
import {
  getAccessToken,
  onSessionExpired,
  setAccessToken,
} from '../api/session';
import { friendlyError } from '../utils/friendlyError';

jest.unmock('axios');

const respond = (config, status, body, headers = {}) => {
  const response = {
    data: body,
    status,
    statusText: '',
    headers,
    config,
    request: {},
  };
  if (status >= 400) {
    throw new AxiosError('fail', 'ERR_BAD_REQUEST', config, {}, response);
  }
  return response;
};

/** Fake server: routes keyed by "METHOD url". */
const fakeServer = (routes) => {
  const calls = [];
  const adapter = async (config) => {
    calls.push({
      key: `${config.method.toUpperCase()} ${config.url}`,
      auth: config.headers.Authorization,
      xrw: config.headers['X-Requested-With'],
    });
    const handler = routes[`${config.method.toUpperCase()} ${config.url}`];
    return handler(config);
  };
  return { adapter, calls };
};

beforeEach(() => setAccessToken(null));

test('unwraps success and turns envelope errors into friendly errors', async () => {
  const { adapter } = fakeServer({
    'GET /rest/products': (c) =>
      respond(c, 200, { success: 1, error: [], data: [1, 2] }),
    'GET /rest/products/9': (c) =>
      respond(c, 404, { success: 0, error: ['Product not found.'], data: {} }),
  });
  const client = createHttpClient({ baseURL: '/api', adapter });
  expect((await client.get('/rest/products')).data).toEqual([1, 2]);
  const error = await client.get('/rest/products/9').catch((e) => e);
  expect(error.status).toBe(404);
  expect(friendlyError(error)).toBe('Product not found.');
  expect(() =>
    unwrapEnvelope({ success: 0, error: ['No.'], data: {} })
  ).toThrow('No.');
});

test('sends the access token and the CSRF header', async () => {
  const { adapter, calls } = fakeServer({
    'GET /rest/account': (c) =>
      respond(c, 200, { success: 1, error: [], data: {} }),
  });
  setAccessToken('abc');
  await createHttpClient({ adapter }).get('/rest/account');
  expect(calls[0]).toMatchObject({ auth: 'Bearer abc', xrw: 'XMLHttpRequest' });
});

test('on 401 refreshes once, then retries with the new token', async () => {
  let accountCalls = 0;
  const { adapter, calls } = fakeServer({
    'GET /rest/account': (c) => {
      accountCalls += 1;
      return c.headers.Authorization === 'Bearer fresh'
        ? respond(c, 200, { success: 1, error: [], data: { ok: true } })
        : respond(c, 401, {
            success: 0,
            error: ['Your session has expired.'],
            data: {},
          });
    },
    'POST /rest/refresh': (c) =>
      respond(c, 200, {
        success: 1,
        error: [],
        data: { access_token: 'fresh', user: {} },
      }),
  });
  setAccessToken('stale');
  const client = createHttpClient({ adapter });
  // Two requests fail at once; only one refresh happens.
  const [a, b] = await Promise.all([
    client.get('/rest/account'),
    client.get('/rest/account'),
  ]);
  expect(a.data).toEqual({ ok: true });
  expect(b.data).toEqual({ ok: true });
  expect(calls.filter((c) => c.key === 'POST /rest/refresh')).toHaveLength(1);
  expect(accountCalls).toBe(4);
  expect(getAccessToken()).toBe('fresh');
});

test('when refresh fails, signals session expiry and returns the original error', async () => {
  const { adapter } = fakeServer({
    'GET /rest/account': (c) =>
      respond(c, 401, {
        success: 0,
        error: ['Your session has expired. Please sign in again.'],
        data: {},
      }),
    'POST /rest/refresh': (c) =>
      respond(c, 401, {
        success: 0,
        error: ['Please sign in to continue.'],
        data: {},
      }),
  });
  const expired = jest.fn();
  const stop = onSessionExpired(expired);
  setAccessToken('stale');
  const error = await createHttpClient({ adapter })
    .get('/rest/account')
    .catch((e) => e);
  stop();
  expect(expired).toHaveBeenCalledTimes(1);
  expect(friendlyError(error)).toBe(
    'Your session has expired. Please sign in again.'
  );
  expect(getAccessToken()).toBeNull();
});

test('auth endpoints never trigger a refresh', async () => {
  const { adapter, calls } = fakeServer({
    'POST /rest/login': (c) =>
      respond(c, 401, {
        success: 0,
        error: ['The email or password is incorrect. Please try again.'],
        data: {},
      }),
  });
  const error = await createHttpClient({ adapter })
    .post('/rest/login', {})
    .catch((e) => e);
  expect(friendlyError(error)).toMatch(/email or password is incorrect/);
  expect(calls.map((c) => c.key)).toEqual(['POST /rest/login']);
});
