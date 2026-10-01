// src/api/remote/index.js
//
// Implementation of the app's data functions against our API contract
// (src/api/contract.md). Used in `mock` and `api` modes.
import { getRemoteClient } from './client';
import {
  categoryFromApi,
  categoryToApi,
  productFromApi,
  productQueryToApi,
  productToApi,
  userFromApi,
  userToApi,
} from './mappers';

const http = () => getRemoteClient();

export const catalog = {
  async getProducts(filters = {}) {
    const { data } = await http().get('/rest/products', {
      params: productQueryToApi(filters),
    });
    return (data || []).map(productFromApi);
  },

  async countProducts(filters = {}) {
    const { headers } = await http().get('/rest/products', {
      params: { ...productQueryToApi(filters), limit: 1, page: 1 },
    });
    return Number(headers['x-total-count'] || 0);
  },

  async getProduct(id) {
    const { data } = await http().get(`/rest/products/${id}`);
    return productFromApi(data);
  },

  async getCategories() {
    const { data } = await http().get('/rest/categories');
    return (data || []).map(categoryFromApi);
  },

  async getCategory(id) {
    const { data } = await http().get(`/rest/categories/${id}`);
    return categoryFromApi(data);
  },
};

export const adminCatalog = {
  async createProduct(input) {
    const { data } = await http().post('/admin/products', productToApi(input));
    return productFromApi(data);
  },
  async updateProduct(id, input) {
    const { data } = await http().put(
      `/admin/products/${id}`,
      productToApi(input)
    );
    return productFromApi(data);
  },
  async deleteProduct(id) {
    await http().delete(`/admin/products/${id}`);
    return true;
  },
  async createCategory(input) {
    const { data } = await http().post(
      '/admin/categories',
      categoryToApi(input)
    );
    return categoryFromApi(data);
  },
  async updateCategory(id, input) {
    const { data } = await http().put(
      `/admin/categories/${id}`,
      categoryToApi(input)
    );
    return categoryFromApi(data);
  },
  async deleteCategory(id) {
    await http().delete(`/admin/categories/${id}`);
    return true;
  },
  /** Returns { location } like the demo API, so callers don't change. */
  async uploadFile(file, onProgress) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await http().post('/admin/files', form, {
      onUploadProgress: onProgress,
    });
    return { location: data.url, ...data };
  },
};

export const account = {
  /**
   * The signed-in user's profile, created on first sign-in. `hint` supplies
   * the name typed at sign-up (the backend only knows the token's claims).
   */
  async getProfile(hint = {}) {
    try {
      const { data } = await http().get('/rest/account');
      return userFromApi(data);
    } catch (error) {
      if (error.status !== 404) throw error;
      const { data } = await http().post(
        '/rest/account',
        userToApi({ name: hint.name, avatar: hint.avatar })
      );
      return userFromApi(data);
    }
  },
  async updateProfile({ name, avatar }) {
    const { data } = await http().put(
      '/rest/account',
      userToApi({ name, avatar })
    );
    return userFromApi(data);
  },
};

export const adminUsers = {
  async list() {
    const { data } = await http().get('/admin/users');
    return (data || []).map(userFromApi);
  },
  async findByEmail(email) {
    const { data } = await http().get('/admin/users', {
      params: { email: email.trim().toLowerCase() },
    });
    return data && data.length ? userFromApi(data[0]) : undefined;
  },
  async create(input) {
    const { data } = await http().post('/admin/users', userToApi(input));
    return userFromApi(data);
  },
  async update(id, input) {
    const { data } = await http().put(`/admin/users/${id}`, userToApi(input));
    return userFromApi(data);
  },
};

export const newsletter = {
  async subscribe(email) {
    await http().put('/rest/newsletter/subscribe', {
      email: email.trim().toLowerCase(),
    });
    return true;
  },
};
