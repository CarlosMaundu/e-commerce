// e2e/fakeStoreApi.js
// In-memory stand-in for the store API's /users endpoints. It enforces the
// same validation rules as https://api.escuelajs.co (checked by hand), so the
// tests catch payloads the real API would reject — without writing test users
// to a shared public service.
const USERS = /https:\/\/api\.escuelajs\.co\/api\/v1\/users(\/[^?]*)?(\?.*)?$/;

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');
const isUrl = (v) => /^https?:\/\/\S+$/.test(v || '');

function validate(body, { partial }) {
  const errors = [];
  const has = (k) => body[k] !== undefined;
  if (!partial || has('email'))
    if (!isEmail(body.email)) errors.push('email must be an email');
  if (!partial || has('name'))
    if (!body.name) errors.push('name should not be empty');
  if (!partial || has('avatar')) {
    if (!body.avatar) errors.push('avatar should not be empty');
    if (!isUrl(body.avatar)) errors.push('avatar must be a URL address');
  }
  if (!partial || has('password')) {
    if (!body.password || body.password.length < 4)
      errors.push('password must be longer than or equal to 4 characters');
    if (!/^[a-zA-Z0-9]+$/.test(body.password || ''))
      errors.push('password must contain only letters and numbers');
  }
  if (has('role') && !['admin', 'customer'].includes(body.role))
    errors.push('role must be one of the following values: admin, customer');
  return errors;
}

function createFakeStoreApi(seed = []) {
  let nextId = 1000;
  const users = seed.map((u) => ({ id: nextId++, role: 'customer', ...u }));
  const json = (route, status, body) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body),
    });
  const badRequest = (route, message) =>
    json(route, 400, { message, error: 'Bad Request', statusCode: 400 });

  async function handler(route) {
    const req = route.request();
    const method = req.method();
    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,PUT,DELETE',
          'access-control-allow-headers': '*',
        },
      });
    }
    const [, pathPart = ''] = req.url().match(USERS) || [];
    const id = Number((pathPart.match(/^\/(\d+)$/) || [])[1]);
    const body = req.postDataJSON?.() || {};

    if (method === 'GET' && !pathPart.replace('/', ''))
      return json(route, 200, users);
    if (method === 'GET' && id) {
      const u = users.find((x) => x.id === id);
      return u
        ? json(route, 200, u)
        : badRequest(route, 'Could not find any entity');
    }
    if (method === 'POST' && pathPart === '/is-available') {
      return json(route, 201, {
        isAvailable: !users.some((u) => u.email === body.email),
      });
    }
    if (method === 'POST') {
      const errors = validate(body, { partial: false });
      if (errors.length) return badRequest(route, errors);
      const user = { id: nextId++, role: 'customer', ...body };
      users.push(user);
      return json(route, 201, user);
    }
    if (method === 'PUT' && id) {
      const errors = validate(body, { partial: true });
      if (errors.length) return badRequest(route, errors);
      const u = users.find((x) => x.id === id);
      if (!u) return badRequest(route, 'Could not find any entity');
      Object.assign(u, body);
      return json(route, 200, u);
    }
    return json(route, 404, { message: 'Not found' });
  }

  return {
    users,
    install: (contextOrPage) => contextOrPage.route(USERS, handler),
    find: (email) => users.find((u) => u.email === email),
  };
}

module.exports = { createFakeStoreApi };
