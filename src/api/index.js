// src/api/index.js
//
// The only module screens, slices and contexts import data functions from.
// Everything goes to our backend (see contract.md).
import { http } from './http';
import { setAccessToken, clearSession } from './session';
import {
  categoryFromApi,
  categoryToApi,
  productFromApi,
  productQueryToApi,
  productToApi,
  userFromApi,
  userToApi,
} from './mappers';

export { onSessionExpired } from './session';

export const DEFAULT_AVATAR_URL = 'https://i.imgur.com/kIaFC3J.png';

/** Stores the access token and returns the signed-in user. */
const acceptSession = (data) => {
  setAccessToken(data.access_token);
  return userFromApi(data.user);
};

export const auth = {
  async register({ firstName, lastName, email, password }) {
    const { data } = await http().post('/rest/register', {
      firstname: firstName,
      lastname: lastName,
      email,
      password,
    });
    return acceptSession(data);
  },
  async login(email, password, { rememberMe = false } = {}) {
    const { data } = await http().post('/rest/login', {
      email,
      password,
      remember_me: rememberMe,
    });
    return acceptSession(data);
  },
  /** `credential` is the ID token from Google Identity Services. */
  async loginWithGoogle(credential) {
    const { data } = await http().post('/rest/sociallogin', {
      provider: 'google',
      id_token: credential,
    });
    return acceptSession(data);
  },
  /** Restores the session from the refresh cookie; null when signed out. */
  async restore() {
    try {
      return acceptSession(await http().refreshSession());
    } catch (error) {
      if (error.response?.status === 401 || error.status === 401) return null;
      throw error;
    }
  },
  async logout() {
    try {
      await http().post('/rest/logout');
    } finally {
      clearSession();
    }
  },
  async requestPasswordReset(email) {
    await http().post('/rest/forgotten', { email: email.trim() });
  },
  /** { valid, purpose: 'reset' | 'setup', email } or throws for bad links. */
  async checkResetToken(token) {
    const { data } = await http().get('/rest/reset-password', {
      params: { token },
    });
    return data;
  },
  async resetPassword(token, password) {
    await http().post('/rest/reset-password', { token, password });
  },
};

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
  /** Returns { location } like the old upload API, so callers don't change. */
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
  async getProfile() {
    const { data } = await http().get('/rest/account');
    return userFromApi(data);
  },
  async updateProfile({ name, avatar }) {
    const { data } = await http().put(
      '/rest/account',
      userToApi({ name, avatar })
    );
    return userFromApi(data);
  },
  async changePassword(currentPassword, newPassword) {
    await http().put('/rest/account/password', {
      current_password: currentPassword,
      password: newPassword,
    });
  },
};

export const adminUsers = {
  async list() {
    const { data } = await http().get('/admin/users');
    return (data || []).map(userFromApi);
  },
  async listRoles() {
    const { data } = await http().get('/admin/roles');
    return data || [];
  },
  /** Creates the user; the backend emails them a link to set a password. */
  async create(input) {
    const { data } = await http().post('/admin/users', userToApi(input));
    return userFromApi(data);
  },
  async update(id, input) {
    const { data } = await http().put(`/admin/users/${id}`, {
      ...userToApi(input),
      ...(input.status ? { status: input.status } : {}),
    });
    return userFromApi(data);
  },
  /** Emails a reset link (or a first-time setup link if no password yet). */
  async sendPasswordReset(id) {
    const { data } = await http().post(`/admin/users/${id}/reset-password`);
    return data;
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
