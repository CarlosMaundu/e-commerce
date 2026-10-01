// e2e/emulator.js — helpers for the Firebase Auth emulator REST API.
const HOST = 'http://127.0.0.1:9099';
const PROJECT_ID = 'demo-carlos-shop';
const ADMIN = { Authorization: 'Bearer owner' };

async function call(path, options = {}) {
  const res = await fetch(`${HOST}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...ADMIN,
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(`${path} -> ${res.status} ${JSON.stringify(body)}`);
  return body;
}

module.exports = {
  PROJECT_ID,
  clearAccounts: () =>
    call(`/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' }),

  createAccount: (email, password, displayName) =>
    call(
      '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key',
      {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          displayName,
          returnSecureToken: true,
        }),
      }
    ),

  listAccounts: async () => {
    const body = await call(
      `/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:query`,
      { method: 'POST', body: JSON.stringify({}) }
    );
    return body.userInfo || [];
  },

  /** Most recent out-of-band code (reset / sign-in link) sent to `email`. */
  latestOobCode: async (email, requestType) => {
    const { oobCodes = [] } = await call(
      `/emulator/v1/projects/${PROJECT_ID}/oobCodes`
    );
    const matches = oobCodes.filter(
      (c) =>
        c.email === email && (!requestType || c.requestType === requestType)
    );
    return matches[matches.length - 1];
  },
};
