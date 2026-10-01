// src/api/mock/fakeBackend.js
//
// In-browser implementation of our API contract (src/api/contract.md), used
// as an axios adapter in `mock` mode and in contract tests. It behaves like
// the real backend should: same routes, envelope, status codes, validation
// and permission checks. Data persists in localStorage so admin edits survive
// a reload; call resetFakeBackend() to start over.
import { AxiosError } from 'axios';
import { createSeedState } from './fixtures';

const STORAGE_KEY = 'carlos-shop:mock-db';
const ADMIN_ROLES = ['admin', 'super_admin'];

let state = null;

const load = () => {
  if (state) return state;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    state = saved ? JSON.parse(saved) : createSeedState();
  } catch {
    state = createSeedState();
  }
  return state;
};

const save = () => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode, tests): keep in memory only.
  }
};

export const resetFakeBackend = (next = createSeedState()) => {
  state = next;
  save();
};

export const getFakeBackendState = () => load();

// ---------- helpers ----------

class HttpError extends Error {
  constructor(status, messages) {
    super(messages[0]);
    this.status = status;
    this.messages = messages;
  }
}
const fail = (status, ...messages) => {
  throw new HttpError(status, messages);
};

const ok = (data, status = 200, headers = {}) => ({
  status,
  headers,
  body: { success: 1, error: [], data },
});

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');
const now = () => new Date().toISOString();

/** Reads the caller from the Firebase ID token (not verified: mock only). */
const identify = (authorization) => {
  const token = (authorization || '').replace(/^Bearer\s+/i, '');
  const [, payload] = token.split('.');
  if (!payload) return null;
  try {
    const json = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    );
    return json.email
      ? { email: json.email.toLowerCase(), uid: json.user_id }
      : null;
  } catch {
    return null;
  }
};

const requireUser = (caller) => {
  if (!caller) fail(401, 'Please sign in to continue.');
  return caller;
};

const requireAdmin = (db, caller) => {
  requireUser(caller);
  const me = db.users.find((u) => u.email === caller.email);
  if (!me || !ADMIN_ROLES.includes(me.role)) {
    fail(403, 'You don’t have permission to do that.');
  }
  return me;
};

const findOr404 = (list, key, id, label) => {
  const item = list.find((x) => String(x[key]) === String(id));
  if (!item) fail(404, `${label} not found.`);
  return item;
};

const withChildren = (db, category) => ({
  ...category,
  categories: db.categories
    .filter((c) => c.parent_id === category.category_id)
    .map((c) => withChildren(db, c)),
});

const categoryTree = (db, rootId) => {
  const ids = [Number(rootId)];
  for (let i = 0; i < ids.length; i += 1) {
    db.categories
      .filter((c) => c.parent_id === ids[i])
      .forEach((c) => ids.push(c.category_id));
  }
  return ids;
};

// ---------- validation ----------

const validateProduct = (body, { partial }) => {
  const errors = [];
  if ((!partial || body.name !== undefined) && !body.name) {
    errors.push('Please enter a product name.');
  }
  if (!partial || body.price !== undefined) {
    if (!(Number(body.price) > 0))
      errors.push('Please enter a price greater than zero.');
  }
  if (body.special !== undefined && body.special !== null) {
    if (
      !(Number(body.special) > 0) ||
      Number(body.special) >= Number(body.price)
    ) {
      errors.push('The sale price must be lower than the regular price.');
    }
  }
  if (body.images !== undefined && !Array.isArray(body.images)) {
    errors.push('Images must be a list of links.');
  }
  if (errors.length) fail(400, ...errors);
};

// ---------- routes ----------

const routes = [
  // Storefront: catalog
  [
    'GET',
    /^\/rest\/products$/,
    ({ db, query }) => {
      let list = db.products;
      if (query.search) {
        const q = String(query.search).toLowerCase();
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description || '').toLowerCase().includes(q)
        );
      }
      if (query.category) {
        const ids = categoryTree(db, query.category);
        list = list.filter((p) =>
          p.category.some((c) => ids.includes(c.category_id))
        );
      }
      const effective = (p) => p.special ?? p.price;
      if (query.price_min)
        list = list.filter((p) => effective(p) >= Number(query.price_min));
      if (query.price_max)
        list = list.filter((p) => effective(p) <= Number(query.price_max));
      const total = list.length;
      if (query.limit) {
        const limit = Number(query.limit);
        const page = Math.max(1, Number(query.page) || 1);
        list = list.slice((page - 1) * limit, page * limit);
      }
      return ok(list, 200, { 'x-total-count': String(total) });
    },
  ],
  [
    'GET',
    /^\/rest\/products\/(\w+)$/,
    ({ db, params }) =>
      ok(findOr404(db.products, 'product_id', params[0], 'Product')),
  ],
  [
    'GET',
    /^\/rest\/categories$/,
    ({ db }) =>
      ok(
        db.categories
          .filter((c) => c.parent_id === 0)
          .map((c) => withChildren(db, c))
      ),
  ],
  [
    'GET',
    /^\/rest\/categories\/(\w+)$/,
    ({ db, params }) =>
      ok(
        withChildren(
          db,
          findOr404(db.categories, 'category_id', params[0], 'Category')
        )
      ),
  ],

  // Storefront: account (the caller's own profile)
  [
    'GET',
    /^\/rest\/account$/,
    ({ db, caller }) => {
      requireUser(caller);
      return ok(findOr404(db.users, 'email', caller.email, 'Account'));
    },
  ],
  [
    'POST',
    /^\/rest\/account$/,
    ({ db, caller, body }) => {
      requireUser(caller);
      if (db.users.some((u) => u.email === caller.email)) {
        fail(409, 'An account with this email already exists.');
      }
      const user = {
        customer_id: db.nextIds.customer++,
        firstname: body.firstname || 'New',
        lastname: body.lastname || 'User',
        email: caller.email,
        role: 'customer',
        avatar: body.avatar || '',
        status: 'active',
        date_added: now(),
      };
      db.users.push(user);
      return ok(user, 201);
    },
  ],
  [
    'PUT',
    /^\/rest\/account$/,
    ({ db, caller, body }) => {
      requireUser(caller);
      const user = findOr404(db.users, 'email', caller.email, 'Account');
      if (body.firstname !== undefined && !body.firstname)
        fail(400, 'Please enter your first name.');
      ['firstname', 'lastname', 'avatar'].forEach((k) => {
        if (body[k] !== undefined) user[k] = body[k];
      });
      return ok(user);
    },
  ],

  // Storefront: newsletter (contract extension: guests send an email)
  [
    'PUT',
    /^\/rest\/newsletter\/subscribe$/,
    ({ db, caller, body }) => {
      const email = (body.email || caller?.email || '').toLowerCase();
      if (!isEmail(email)) fail(400, 'Please enter a valid email address.');
      if (!db.subscribers.includes(email)) db.subscribers.push(email);
      return ok({ email, subscribed: true });
    },
  ],

  // Admin: catalog
  [
    'POST',
    /^\/admin\/products$/,
    ({ db, caller, body }) => {
      requireAdmin(db, caller);
      validateProduct(body, { partial: false });
      const category = db.categories.find(
        (c) => String(c.category_id) === String(body.category_id)
      );
      const productRow = {
        product_id: db.nextIds.product++,
        name: body.name,
        description: body.description || '',
        price: Number(body.price),
        special: body.special ?? null,
        image: (body.images || [])[0] || '',
        images: body.images || [],
        category: category
          ? [{ category_id: category.category_id, name: category.name }]
          : [],
        quantity: body.quantity ?? 0,
        rating: 0,
        reviews: 0,
        manufacturer: body.manufacturer || '',
        options: body.options || { sizes: [], colors: [] },
        date_added: now(),
        date_modified: now(),
      };
      db.products.unshift(productRow);
      return ok(productRow, 201);
    },
  ],
  [
    'PUT',
    /^\/admin\/products\/(\w+)$/,
    ({ db, caller, body, params }) => {
      requireAdmin(db, caller);
      const productRow = findOr404(
        db.products,
        'product_id',
        params[0],
        'Product'
      );
      validateProduct({ ...productRow, ...body }, { partial: true });
      Object.assign(productRow, body, { date_modified: now() });
      if (body.images) productRow.image = body.images[0] || '';
      if (body.category_id !== undefined) {
        const category = db.categories.find(
          (c) => String(c.category_id) === String(body.category_id)
        );
        productRow.category = category
          ? [{ category_id: category.category_id, name: category.name }]
          : [];
        delete productRow.category_id;
      }
      return ok(productRow);
    },
  ],
  [
    'DELETE',
    /^\/admin\/products\/(\w+)$/,
    ({ db, caller, params }) => {
      requireAdmin(db, caller);
      findOr404(db.products, 'product_id', params[0], 'Product');
      db.products = db.products.filter(
        (p) => String(p.product_id) !== String(params[0])
      );
      return ok(true);
    },
  ],
  [
    'POST',
    /^\/admin\/categories$/,
    ({ db, caller, body }) => {
      requireAdmin(db, caller);
      if (!body.name) fail(400, 'Please enter a category name.');
      const category = {
        category_id: db.nextIds.category++,
        name: body.name,
        image: body.image || '',
        parent_id: 0,
      };
      db.categories.push(category);
      (body.subcategories || []).forEach((name) =>
        db.categories.push({
          category_id: db.nextIds.category++,
          name,
          image: '',
          parent_id: category.category_id,
        })
      );
      return ok(withChildren(db, category), 201);
    },
  ],
  [
    'PUT',
    /^\/admin\/categories\/(\w+)$/,
    ({ db, caller, body, params }) => {
      requireAdmin(db, caller);
      const category = findOr404(
        db.categories,
        'category_id',
        params[0],
        'Category'
      );
      if (body.name !== undefined) {
        if (!body.name) fail(400, 'Please enter a category name.');
        category.name = body.name;
      }
      if (body.image !== undefined) category.image = body.image;
      if (body.subcategories) {
        db.categories = db.categories.filter(
          (c) => c.parent_id !== category.category_id
        );
        body.subcategories.forEach((name) =>
          db.categories.push({
            category_id: db.nextIds.category++,
            name,
            image: '',
            parent_id: category.category_id,
          })
        );
      }
      return ok(withChildren(db, category));
    },
  ],
  [
    'DELETE',
    /^\/admin\/categories\/(\w+)$/,
    ({ db, caller, params }) => {
      requireAdmin(db, caller);
      const ids = categoryTree(
        db,
        findOr404(db.categories, 'category_id', params[0], 'Category')
          .category_id
      );
      if (
        db.products.some((p) =>
          p.category.some((c) => ids.includes(c.category_id))
        )
      ) {
        fail(
          409,
          'This category still has products. Move or delete them first.'
        );
      }
      db.categories = db.categories.filter((c) => !ids.includes(c.category_id));
      return ok(true);
    },
  ],
  [
    'POST',
    /^\/admin\/files$/,
    ({ db, caller, body }) => {
      requireAdmin(db, caller);
      const file = body instanceof FormData ? body.get('file') : null;
      if (!file) fail(400, 'Please choose a file to upload.');
      if (file.size > 5 * 1024 * 1024)
        fail(413, 'That file is too large. Please choose one under 5 MB.');
      // Session-only URL: fine for mock mode, never persisted by a real backend.
      const url =
        typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(file)
          : `mock://${file.name}`;
      return ok({ url, filename: file.name, size: file.size }, 201);
    },
  ],

  // Admin: users
  [
    'GET',
    /^\/admin\/users$/,
    ({ db, caller, query }) => {
      requireAdmin(db, caller);
      let list = db.users;
      if (query.email)
        list = list.filter(
          (u) => u.email === String(query.email).toLowerCase()
        );
      return ok(list);
    },
  ],
  [
    'POST',
    /^\/admin\/users$/,
    ({ db, caller, body }) => {
      requireAdmin(db, caller);
      if (!isEmail(body.email))
        fail(400, 'Please enter a valid email address.');
      if (!body.firstname) fail(400, 'Please enter a name.');
      if (db.users.some((u) => u.email === body.email))
        fail(409, 'A user with this email already exists.');
      const user = {
        customer_id: db.nextIds.customer++,
        firstname: body.firstname,
        lastname: body.lastname || '',
        email: body.email,
        role: body.role || 'customer',
        avatar: body.avatar || '',
        status: 'active',
        date_added: now(),
      };
      db.users.push(user);
      return ok(user, 201);
    },
  ],
  [
    'PUT',
    /^\/admin\/users\/(\w+)$/,
    ({ db, caller, body, params }) => {
      const me = requireAdmin(db, caller);
      const user = findOr404(db.users, 'customer_id', params[0], 'User');
      if (
        body.role !== undefined &&
        user.customer_id === me.customer_id &&
        body.role !== me.role
      ) {
        fail(403, 'You can’t change your own role.');
      }
      ['firstname', 'lastname', 'avatar', 'role'].forEach((k) => {
        if (body[k] !== undefined) user[k] = body[k];
      });
      return ok(user);
    },
  ],
];

/** Pure request handler: { method, path, query, body, headers } → response. */
export const handleRequest = ({
  method,
  path,
  query = {},
  body = {},
  headers = {},
}) => {
  const db = load();
  const caller = identify(headers.Authorization || headers.authorization);
  const upper = method.toUpperCase();
  try {
    for (const [routeMethod, pattern, handler] of routes) {
      const match = routeMethod === upper && path.match(pattern);
      if (match) {
        const result = handler({
          db,
          caller,
          query,
          body,
          params: match.slice(1),
        });
        if (upper !== 'GET') save();
        return result;
      }
    }
    fail(404, 'Not found.');
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    return {
      status: error.status,
      headers: {},
      body: { success: 0, error: error.messages, data: {} },
    };
  }
  return null;
};

const parseBody = (data) => {
  if (data instanceof FormData) return data;
  if (typeof data === 'string' && data) {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  return data || {};
};

/** Axios adapter that answers requests from the fake backend. */
export const fakeBackendAdapter = async (config) => {
  const url = new URL(config.url, 'http://mock.local/');
  const query = {
    ...Object.fromEntries(url.searchParams),
    ...(config.params || {}),
  };
  const headers =
    typeof config.headers?.toJSON === 'function'
      ? config.headers.toJSON()
      : config.headers || {};
  const result = handleRequest({
    method: config.method || 'get',
    path: url.pathname.replace(/^\/api/, ''),
    query,
    body: parseBody(config.data),
    headers,
  });
  // Small delay so loading states are visible in mock mode.
  await new Promise((resolve) => setTimeout(resolve, 60));
  const response = {
    data: result.body,
    status: result.status,
    statusText: String(result.status),
    headers: result.headers,
    config,
    request: {},
  };
  if (result.status >= 400) {
    throw new AxiosError(
      `Request failed with status code ${result.status}`,
      result.status >= 500
        ? AxiosError.ERR_BAD_RESPONSE
        : AxiosError.ERR_BAD_REQUEST,
      config,
      response.request,
      response
    );
  }
  return response;
};
