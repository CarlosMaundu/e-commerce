// src/tests/apiContract.test.js
//
// Exercises the real HTTP client (headers, envelope unwrapping, error
// mapping) and the contract modules against the fake backend.
import { createHttpClient, unwrapEnvelope } from '../api/http';
import { setRemoteClient } from '../api/remote/client';
import * as remote from '../api/remote';
import * as demo from '../api/demo';
import {
  fakeBackendAdapter,
  resetFakeBackend,
  getFakeBackendState,
} from '../api/mock/fakeBackend';
import { MOCK_ADMIN_EMAIL } from '../api/mock/fixtures';
import { friendlyError } from '../utils/friendlyError';

jest.unmock('axios');

const fakeToken = (email) => {
  const enc = (o) =>
    btoa(JSON.stringify(o))
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  return `${enc({ alg: 'none' })}.${enc({ email, user_id: email })}.sig`;
};

let currentEmail = null;
let lastRequest = null;
const signInAs = (email) => {
  currentEmail = email;
};

beforeEach(() => {
  resetFakeBackend();
  currentEmail = null;
  setRemoteClient(
    createHttpClient({
      baseURL: '/api',
      adapter: (config) => {
        lastRequest = config;
        return fakeBackendAdapter(config);
      },
      getToken: async () => (currentEmail ? fakeToken(currentEmail) : null),
    })
  );
});

const { catalog, adminCatalog, account, adminUsers, newsletter } = remote;

describe('HTTP client', () => {
  test('sends the user token and OpenCart-style locale headers', async () => {
    signInAs('someone@example.com');
    await catalog.getCategories();
    expect(lastRequest.headers.Authorization).toBe(
      `Bearer ${fakeToken('someone@example.com')}`
    );
    expect(lastRequest.headers['X-Oc-Currency']).toBe('USD');
    expect(lastRequest.headers['X-Oc-Merchant-Language']).toBe('en-gb');
  });

  test('sends no Authorization header for guests', async () => {
    await catalog.getCategories();
    expect(lastRequest.headers.Authorization).toBeUndefined();
  });

  test('treats success:0 as a failure even with HTTP 200', () => {
    expect(() =>
      unwrapEnvelope({ success: 0, error: ['Out of stock.'], data: {} })
    ).toThrow('Out of stock.');
    expect(unwrapEnvelope({ success: 1, error: [], data: { a: 1 } })).toEqual({
      a: 1,
    });
  });

  test('turns envelope errors into friendly, user-facing errors', async () => {
    const error = await catalog.getProduct(99999).catch((e) => e);
    expect(error.status).toBe(404);
    expect(friendlyError(error)).toBe('Product not found.');
  });
});

describe('catalog', () => {
  test('maps contract products to the screen model', async () => {
    const [first] = await catalog.getProducts({ search: 'denim jacket' });
    expect(first).toMatchObject({
      id: 2,
      title: 'Denim jacket',
      price: 79,
      specialPrice: 59,
      discountPercentage: 25,
      category: { id: 2, name: 'Men' },
      inStock: true,
    });
    expect(first.images.length).toBeGreaterThan(0);
    expect(first.creationAt).toBeTruthy();
  });

  test('filters by category including subcategories, and paginates with a total', async () => {
    const all = await catalog.getProducts({});
    const women = await catalog.getProducts({ categoryId: 1 });
    expect(women.every((p) => p.category.name === 'Women')).toBe(true);
    expect(women.length).toBeLessThan(all.length);

    const page2 = await catalog.getProducts({ limit: 5, offset: 5 });
    expect(page2.map((p) => p.id)).toEqual(all.slice(5, 10).map((p) => p.id));
    expect(await catalog.countProducts({})).toBe(all.length);
    expect(await catalog.countProducts({ search: 'dress' })).toBe(2);
  });

  test('marks out-of-stock products', async () => {
    const lamp = await catalog.getProduct(5);
    expect(lamp.inStock).toBe(false);
  });

  test('returns categories with nested subcategories', async () => {
    const categories = await catalog.getCategories();
    const women = categories.find((c) => c.name === 'Women');
    expect(women.subcategories.map((s) => s.name)).toEqual(['Dresses']);
    expect(categories.some((c) => c.name === 'Dresses')).toBe(false);
  });
});

describe('admin catalog', () => {
  test('customers are refused with a friendly 403', async () => {
    signInAs('customer@example.com');
    const error = await adminCatalog
      .createProduct({ title: 'X', price: 10 })
      .catch((e) => e);
    expect(error.status).toBe(403);
    expect(friendlyError(error)).toBe('You don’t have permission to do that.');
  });

  test('guests must sign in', async () => {
    const error = await adminCatalog.deleteProduct(1).catch((e) => e);
    expect(error.status).toBe(401);
    expect(friendlyError(error)).toBe('Please sign in to continue.');
  });

  test('validates products and reports every problem', async () => {
    signInAs(MOCK_ADMIN_EMAIL);
    const error = await adminCatalog
      .createProduct({ title: '', price: 0 })
      .catch((e) => e);
    expect(error.status).toBe(400);
    expect(friendlyError(error)).toBe(
      'Please enter a product name. Please enter a price greater than zero.'
    );
  });

  test('creates, discounts and deletes a product', async () => {
    signInAs(MOCK_ADMIN_EMAIL);
    const created = await adminCatalog.createProduct({
      title: 'Rain jacket',
      description: 'Light and packable',
      price: 100,
      stock: 3,
      discount: 0,
      categoryId: 2,
      images: ['https://example.com/rain.png'],
      sizes: ['M'],
      colors: ['Navy'],
    });
    expect(created).toMatchObject({
      title: 'Rain jacket',
      price: 100,
      quantity: 3,
      category: { id: 2, name: 'Men' },
      sizes: ['M'],
      colors: ['Navy'],
    });

    const updated = await adminCatalog.updateProduct(created.id, {
      price: 100,
      discount: 20,
    });
    expect(updated.specialPrice).toBe(80);
    expect(updated.discountPercentage).toBe(20);

    await adminCatalog.deleteProduct(created.id);
    const error = await catalog.getProduct(created.id).catch((e) => e);
    expect(error.status).toBe(404);
  });

  test('refuses to delete a category that still has products', async () => {
    signInAs(MOCK_ADMIN_EMAIL);
    const error = await adminCatalog.deleteCategory(1).catch((e) => e);
    expect(error.status).toBe(409);
    expect(friendlyError(error)).toMatch(/still has products/);
  });

  test('creates categories with subcategories', async () => {
    signInAs(MOCK_ADMIN_EMAIL);
    const created = await adminCatalog.createCategory({
      name: 'Outdoor',
      image: 'https://example.com/o.png',
      subcategories: ['Tents', ' '],
    });
    expect(created.name).toBe('Outdoor');
    expect(created.subcategories.map((s) => s.name)).toEqual(['Tents']);
  });
});

describe('account', () => {
  test('creates the profile on first sign-in using the sign-up name', async () => {
    signInAs('new.person@example.com');
    const profile = await account.getProfile({ name: 'New Person' });
    expect(profile).toMatchObject({
      name: 'New Person',
      email: 'new.person@example.com',
      role: 'customer',
    });
    const again = await account.getProfile({ name: 'Ignored' });
    expect(again.id).toBe(profile.id);
  });

  test('updates the signed-in user only', async () => {
    signInAs('customer@example.com');
    const updated = await account.updateProfile({ name: 'Cam Renamed' });
    expect(updated.name).toBe('Cam Renamed');
    expect(
      getFakeBackendState().users.find((u) => u.email === MOCK_ADMIN_EMAIL)
        .firstname
    ).toBe('Ada');
  });
});

describe('admin users', () => {
  test('finds, creates and rejects duplicates', async () => {
    signInAs(MOCK_ADMIN_EMAIL);
    expect(await adminUsers.findByEmail('CUSTOMER@example.com')).toMatchObject({
      name: 'Cam Customer',
    });
    expect(await adminUsers.findByEmail('nobody@example.com')).toBeUndefined();

    const created = await adminUsers.create({
      name: 'Nia Staff',
      email: 'nia@example.com',
      role: 'admin',
    });
    expect(created).toMatchObject({ name: 'Nia Staff', role: 'admin' });

    const error = await adminUsers
      .create({ name: 'Dup', email: 'nia@example.com' })
      .catch((e) => e);
    expect(error.status).toBe(409);
  });

  test('admins cannot change their own role', async () => {
    signInAs(MOCK_ADMIN_EMAIL);
    const me = await adminUsers.findByEmail(MOCK_ADMIN_EMAIL);
    const error = await adminUsers
      .update(me.id, { role: 'customer' })
      .catch((e) => e);
    expect(friendlyError(error)).toBe('You can’t change your own role.');
  });
});

describe('newsletter', () => {
  test('validates and subscribes', async () => {
    const error = await newsletter.subscribe('not-an-email').catch((e) => e);
    expect(friendlyError(error)).toBe('Please enter a valid email address.');
    await newsletter.subscribe(' Fan@Example.com ');
    expect(getFakeBackendState().subscribers).toContain('fan@example.com');
  });

  test('demo mode explains that sign-up is not available yet', async () => {
    const error = await demo.newsletter.subscribe('a@b.co').catch((e) => e);
    expect(friendlyError(error)).toMatch(/isn’t available yet/);
  });
});

describe('demo source', () => {
  test('creating a profile without a photo still sends the default avatar', async () => {
    const axios = require('axios');
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: {} });
    jest.spyOn(axios, 'get').mockResolvedValue({ data: [] });
    await demo.account.getProfile({
      email: 'x@example.com',
      name: 'X Person',
      avatar: undefined,
    });
    expect(post.mock.calls[0][1].avatar).toBe(demo.DEFAULT_AVATAR_URL);
    jest.restoreAllMocks();
  });
});
