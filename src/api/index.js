// src/api/index.js
//
// The only module screens, slices and contexts import data functions from.
// Everything goes to our backend (see contract.md).
import { http } from './http';
import { setAccessToken, clearSession } from './session';
import {
  addressFromApi,
  addressToApi,
  cartFromApi,
  cartItemToApi,
  orderFromApi,
  returnFromApi,
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

export const cart = {
  async get() {
    const { data } = await http().get('/rest/cart');
    return cartFromApi(data);
  },
  async add(item) {
    const { data } = await http().post('/rest/cart', cartItemToApi(item));
    return cartFromApi(data);
  },
  /** Merges a signed-out shopper's cart into their account cart. */
  async addMany(items) {
    const { data } = await http().post(
      '/rest/cart_bulk',
      items.map(cartItemToApi)
    );
    return cartFromApi(data);
  },
  async update(key, quantity) {
    const { data } = await http().put('/rest/cart', { key, quantity });
    return cartFromApi(data);
  },
  async remove(key) {
    const { data } = await http().delete(`/rest/cart/${key}`);
    return cartFromApi(data);
  },
  async empty() {
    const { data } = await http().delete('/rest/cart/empty');
    return cartFromApi(data);
  },
  async applyCoupon(code) {
    const { data } = await http().post('/rest/coupon', { coupon: code.trim() });
    return cartFromApi(data);
  },
  async removeCoupon() {
    const { data } = await http().delete('/rest/coupon');
    return cartFromApi(data);
  },
};

export const wishlist = {
  async list() {
    const { data } = await http().get('/rest/wishlist');
    return (data || []).map(productFromApi);
  },
  async add(productId) {
    await http().post(`/rest/wishlist/${productId}`);
  },
  async remove(productId) {
    await http().delete(`/rest/wishlist/${productId}`);
  },
};

export const addresses = {
  async list() {
    const { data } = await http().get('/rest/account/address');
    return (data || []).map(addressFromApi);
  },
  async create(address) {
    const { data } = await http().post(
      '/rest/account/address',
      addressToApi(address)
    );
    return addressFromApi(data);
  },
  async update(id, address) {
    const { data } = await http().put(
      `/rest/account/address/${id}`,
      addressToApi(address)
    );
    return addressFromApi(data);
  },
  async remove(id) {
    await http().delete(`/rest/account/address/${id}`);
  },
};

export const checkout = {
  async getShippingAddress() {
    const { data } = await http().get('/rest/shippingaddress');
    return {
      addresses: data.addresses.map(addressFromApi),
      selectedId: data.address_id,
    };
  },
  async useShippingAddress(addressId) {
    await http().post('/rest/shippingaddress/existing', {
      address_id: addressId,
    });
  },
  async addShippingAddress(address) {
    const { data } = await http().post(
      '/rest/shippingaddress',
      addressToApi(address)
    );
    return addressFromApi(data.address);
  },
  async usePaymentAddress(addressId) {
    await http().post('/rest/paymentaddress/existing', {
      address_id: addressId,
    });
  },
  async getShippingMethods() {
    const { data } = await http().get('/rest/shippingmethods');
    return { methods: data.shipping_methods, selected: data.shipping_method };
  },
  async setShippingMethod(code, comment) {
    await http().post('/rest/shippingmethods', {
      shipping_method: code,
      ...(comment !== undefined ? { comment } : {}),
    });
  },
  async getPaymentMethods() {
    const { data } = await http().get('/rest/paymentmethods');
    return { methods: data.payment_methods, selected: data.payment_method };
  },
  async setPaymentMethod(code, agree) {
    await http().post('/rest/paymentmethods', { payment_method: code, agree });
  },
  /** Order overview; for cards also { clientSecret, publishableKey }. */
  async review() {
    const { data } = await http().post('/rest/confirm');
    return {
      order: orderFromApi(data.order),
      payment: {
        method: data.payment.method,
        clientSecret: data.payment.client_secret,
        publishableKey: data.payment.publishable_key,
      },
    };
  },
  async placeOrder() {
    const { data } = await http().put('/rest/confirm');
    return orderFromApi(data);
  },
};

export const orders = {
  async list({ page = 1, limit = 10, status } = {}) {
    const { data, headers } = await http().get('/rest/customerorders', {
      params: { page, limit, ...(status ? { status } : {}) },
    });
    return {
      orders: data.map(orderFromApi),
      total: Number(headers['x-total-count'] || 0),
    };
  },
  async get(id) {
    const { data } = await http().get(`/rest/customerorders/${id}`);
    return orderFromApi(data);
  },
  async reorder(id) {
    const { data } = await http().post(`/rest/customerorders/${id}/reorder`);
    return {
      added: data.added,
      skipped: data.skipped,
      cart: cartFromApi(data.cart),
    };
  },
  async statuses() {
    const { data } = await http().get('/rest/order_statuses');
    return data;
  },
  async returnReasons() {
    const { data } = await http().get('/rest/return_reasons');
    return data;
  },
  async requestReturn({
    orderId,
    orderItemId,
    quantity,
    reason,
    opened,
    comment,
  }) {
    const { data } = await http().post('/rest/returns', {
      order_id: orderId,
      order_product_id: orderItemId,
      quantity,
      reason,
      opened,
      comment,
    });
    return returnFromApi(data);
  },
  async listReturns() {
    const { data } = await http().get('/rest/returns');
    return data.map(returnFromApi);
  },
};

export const adminOrders = {
  async list({ page = 1, limit = 20, status, search } = {}) {
    const { data, headers } = await http().get('/admin/orders', {
      params: {
        page,
        limit,
        ...(status ? { status } : {}),
        ...(search ? { search } : {}),
      },
    });
    return {
      orders: data.map(orderFromApi),
      total: Number(headers['x-total-count'] || 0),
    };
  },
  async get(id) {
    const { data } = await http().get(`/admin/orders/${id}`);
    return orderFromApi(data);
  },
  async updateStatus(id, { status, comment = '', notify = false }) {
    const { data } = await http().put(`/admin/orderhistory/${id}`, {
      order_status: status,
      comment,
      notify,
    });
    return orderFromApi(data);
  },
  async listReturns(status) {
    const { data } = await http().get('/admin/returns', {
      params: status ? { status } : {},
    });
    return data.map(returnFromApi);
  },
  async updateReturn(id, status) {
    const { data } = await http().put(`/admin/returns/${id}`, { status });
    return returnFromApi(data);
  },
  async dashboard() {
    const { data } = await http().get('/admin/dashboard');
    return data;
  },
};

export const adminRoles = {
  async permissions() {
    const { data } = await http().get('/admin/permissions');
    return data;
  },
  async get(code) {
    const { data } = await http().get(`/admin/roles/${code}`);
    return data;
  },
  async create(role) {
    const { data } = await http().post('/admin/roles', role);
    return data;
  },
  async update(code, role) {
    const { data } = await http().put(`/admin/roles/${code}`, role);
    return data;
  },
  async duplicate(code, name) {
    const { data } = await http().post(`/admin/roles/${code}/duplicate`, {
      name,
    });
    return data;
  },
  async remove(code) {
    await http().delete(`/admin/roles/${code}`);
  },
};
