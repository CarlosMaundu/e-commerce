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
  giftToApi,
  cartItemToApi,
  orderFromApi,
  returnFromApi,
  activityFromApi,
  brandFromApi,
  categoryFromApi,
  categoryToApi,
  productFromApi,
  promotionFromApi,
  reviewFromApi,
  sessionFromApi,
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
    // The shop may ask new accounts to confirm their email first.
    if (data.verification_required) {
      return { verificationRequired: true, email: data.email };
    }
    return acceptSession(data);
  },
  async verifyEmail(token) {
    const { data } = await http().post('/rest/verify-email', { token });
    return data;
  },
  async resendVerification(email) {
    await http().post('/rest/verify-email/resend', { email: email.trim() });
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
  /** { products, total } for the filters (see productQueryToApi). */
  async listProducts(filters = {}) {
    const { data, headers } = await http().get('/rest/products', {
      params: productQueryToApi(filters),
    });
    return {
      products: (data || []).map(productFromApi),
      total: Number(headers['x-total-count'] || 0),
    };
  },
  async getProducts(filters = {}) {
    return (await catalog.listProducts(filters)).products;
  },
  async getProduct(id) {
    const { data } = await http().get(`/rest/products/${id}`);
    return productFromApi(data);
  },
  async related(id) {
    const { data } = await http().get(`/rest/products/${id}/related`);
    return (data || []).map(productFromApi);
  },
  /** Brands, price range, attribute values and tags for the filter panel. */
  async filters(categoryId) {
    const { data } = await http().get('/rest/product_filters', {
      params: categoryId ? { category: categoryId } : {},
    });
    return {
      brands: data.brands.map(brandFromApi),
      price: data.price,
      attributes: data.attributes,
      tags: data.tags,
    };
  },
  async brands() {
    const { data } = await http().get('/rest/manufacturers');
    return (data || []).map(brandFromApi);
  },
  async promotions() {
    const { data } = await http().get('/rest/promotions');
    return (data || []).map(promotionFromApi);
  },
  async reviews(id, { page = 1, limit = 10 } = {}) {
    const { data } = await http().get(`/rest/products/${id}/reviews`, {
      params: { page, limit },
    });
    return { summary: data.summary, reviews: data.reviews.map(reviewFromApi) };
  },
  async addReview(id, { rating, title, text }) {
    const { data } = await http().post(`/rest/products/${id}/review`, {
      rating,
      title,
      text,
    });
    return data;
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
  /** { products, total, counts } including drafts. */
  async listProducts(filters = {}) {
    const { data } = await http().get('/admin/products', {
      params: productQueryToApi(filters),
    });
    return {
      products: data.products.map(productFromApi),
      total: data.total,
      counts: data.counts,
    };
  },
  async getProduct(id) {
    const { data } = await http().get(`/admin/products/${id}`);
    return productFromApi(data);
  },
  async createProduct(form) {
    const { data } = await http().post('/admin/products', productToApi(form));
    return productFromApi(data);
  },
  async updateProduct(id, form) {
    const { data } = await http().put(
      `/admin/products/${id}`,
      productToApi(form)
    );
    return productFromApi(data);
  },
  /** Partial update with contract field names, e.g. { status: 'draft' }. */
  async patchProduct(id, fields) {
    const { data } = await http().put(`/admin/products/${id}`, fields);
    return productFromApi(data);
  },
  async deleteProduct(id) {
    await http().delete(`/admin/products/${id}`);
    return true;
  },
  async tags() {
    const { data } = await http().get('/admin/product_tags');
    return data || [];
  },
  async brands() {
    const { data } = await http().get('/admin/brands');
    return (data || []).map(brandFromApi);
  },
  async createBrand({ name, logo = '' }) {
    const { data } = await http().post('/admin/brands', { name, logo });
    return brandFromApi(data);
  },
  async updateBrand(id, { name, logo }) {
    const { data } = await http().put(`/admin/brands/${id}`, { name, logo });
    return brandFromApi(data);
  },
  async deleteBrand(id) {
    await http().delete(`/admin/brands/${id}`);
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
  async updateProfile({ name, firstName, lastName, avatar, phone }) {
    const body =
      firstName !== undefined
        ? { firstname: firstName, lastname: lastName ?? '' }
        : userToApi({ name });
    const { data } = await http().put('/rest/account', {
      ...body,
      ...(avatar !== undefined ? { avatar } : {}),
      ...(phone !== undefined ? { telephone: phone } : {}),
    });
    return userFromApi(data);
  },
  async changePassword(currentPassword, newPassword) {
    await http().put('/rest/account/password', {
      current_password: currentPassword,
      password: newPassword,
    });
  },
  async uploadAvatar(file) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await http().post('/rest/account/avatar', form);
    return userFromApi(data);
  },
  async sessions() {
    const { data } = await http().get('/rest/account/sessions');
    return (data || []).map(sessionFromApi);
  },
  async endSession(id) {
    await http().delete(`/rest/account/sessions/${id}`);
  },
  async endOtherSessions() {
    const { data } = await http().delete('/rest/account/sessions');
    return data.revoked;
  },
  async activity() {
    const { data } = await http().get('/rest/account/activity');
    return (data || []).map(activityFromApi);
  },
};

/** Staff acting as a customer ("View as customer"). */
export const impersonation = {
  async start(userId) {
    const { data } = await http().post(`/admin/users/${userId}/impersonate`);
    return acceptSession(data);
  },
  /** Returns the staff user again, or null when their session had ended. */
  async stop() {
    const { data } = await http().post('/rest/impersonation/stop');
    if (!data.restored) {
      clearSession();
      return null;
    }
    return acceptSession(data);
  },
};

export const adminSecurity = {
  async unlock(userId) {
    await http().post(`/admin/users/${userId}/unlock`);
  },
  async signOutEverywhere(userId) {
    const { data } = await http().post(`/admin/users/${userId}/signout`);
    return data.signed_out;
  },
  async userActivity(userId) {
    const { data } = await http().get(`/admin/users/${userId}/activity`);
    return {
      activity: data.activity.map(activityFromApi),
      sessions: data.sessions.map(sessionFromApi),
    };
  },
  async audit({ search, action, from, to, page = 1, limit = 50 } = {}) {
    const { data } = await http().get('/admin/audit', {
      params: {
        search: search || undefined,
        action: action || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit,
      },
    });
    return {
      total: data.total,
      activity: data.activity.map(activityFromApi),
      actions: data.actions,
    };
  },
  async sessions() {
    const { data } = await http().get('/admin/security/sessions');
    return { stats: data.stats, sessions: data.sessions.map(sessionFromApi) };
  },
  async endSession(id) {
    await http().delete(`/admin/security/sessions/${id}`);
  },
  async settings() {
    const { data } = await http().get('/admin/security/settings');
    return data;
  },
  async saveSettings(sections) {
    const { data } = await http().put('/admin/security/settings', sections);
    return data.settings;
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
  /** Read-only account overview (no impersonation). */
  async account(id) {
    const { data } = await http().get(`/admin/users/${id}/account`);
    return {
      user: userFromApi(data.user),
      staff: data.staff,
      stats: {
        orders: data.stats.orders,
        spent: Number(data.stats.spent),
        lastOrder: data.stats.last_order,
        wishlist: data.stats.wishlist,
        cart: data.stats.cart,
        returns: data.stats.returns,
        refunds: data.stats.refunds,
        refunded: Number(data.stats.refunded || 0),
        reviews: data.stats.reviews,
        sessions: data.stats.sessions,
      },
      addresses: (data.addresses || []).map(addressFromApi),
      orders: data.orders ? data.orders.map(orderFromApi) : null,
    };
  },
  /** Emails a reset link (or a first-time setup link if no password yet). */
  async sendPasswordReset(id) {
    const { data } = await http().post(`/admin/users/${id}/reset-password`);
    return data;
  },
};

const storeFromApi = (d) => ({
  name: d.name,
  tagline: d.tagline || '',
  logo: d.logo || '',
  favicon: d.favicon || '',
  email: d.email || '',
  phone: d.phone || '',
  address: d.address || '',
  footerText: d.footer_text || '',
  announcement: d.announcement || '',
  social: d.social || {},
  finance: d.finance && {
    currency: d.finance.currency,
    taxLabel: d.finance.tax_label,
    taxRate: Number(d.finance.tax_rate),
    pricesIncludeTax: Boolean(d.finance.prices_include_tax),
    freeShippingOver: Number(d.finance.free_shipping_over || 0),
  },
  returns: d.returns && {
    windowDays: Number(d.returns.window_days),
    refundDelivery: Boolean(d.returns.refund_delivery),
    restockingFeePercent: Number(d.returns.restocking_fee_percent),
  },
  hero: d.hero && {
    main: { ...d.hero.main, ctaLabel: d.hero.main?.cta_label ?? '' },
    side: { ...d.hero.side },
    member: { ...d.hero.member },
  },
});

const storeToApi = (s) => ({
  name: s.name,
  tagline: s.tagline,
  logo: s.logo,
  favicon: s.favicon,
  email: s.email,
  phone: s.phone,
  address: s.address,
  footer_text: s.footerText,
  announcement: s.announcement,
  social: s.social,
  hero: s.hero && {
    main: (({ ctaLabel, ...rest }) => ({ ...rest, cta_label: ctaLabel }))(
      s.hero.main
    ),
    side: s.hero.side,
    member: s.hero.member,
  },
});

const financeFromApi = (f) => ({
  currency: f.currency,
  taxLabel: f.tax_label,
  taxRate: Number(f.tax_rate),
  pricesIncludeTax: Boolean(f.prices_include_tax),
});

/** Currency, tax and delivery prices (Back office → Financial settings). */
export const finance = {
  async adminGet() {
    const { data } = await http().get('/admin/finance-settings');
    return {
      settings: financeFromApi(data.settings),
      updatedAt: data.updated_at,
      updatedBy: data.updated_by,
    };
  },
  async save(f) {
    const { data } = await http().put('/admin/finance-settings', {
      currency: f.currency,
      tax_label: f.taxLabel,
      tax_rate: f.taxRate,
      prices_include_tax: f.pricesIncludeTax,
    });
    return financeFromApi(data.settings);
  },
};

/** Delivery options: standard, express and pick up (raw API shape). */
export const delivery = {
  async adminGet() {
    const { data } = await http().get('/admin/delivery-settings');
    return {
      settings: data.settings,
      updatedAt: data.updated_at,
      updatedBy: data.updated_by,
    };
  },
  async save(settings) {
    const { data } = await http().put('/admin/delivery-settings', settings);
    return data.settings;
  },
};

/** The shop's name, logo, favicon and contact details. */
export const store = {
  async get() {
    const { data } = await http().get('/rest/store');
    return storeFromApi(data);
  },
  async adminGet() {
    const { data } = await http().get('/admin/store-settings');
    return {
      settings: storeFromApi(data.settings),
      updatedAt: data.updated_at,
      updatedBy: data.updated_by,
    };
  },
  async save(settings) {
    const { data } = await http().put(
      '/admin/store-settings',
      storeToApi(settings)
    );
    return storeFromApi(data.settings);
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
  /** Sends a line as a gift, or stops (gift = null). */
  async setGift(key, gift) {
    const { data } = await http().put(`/rest/cart/${key}/gift`, {
      gift: giftToApi(gift),
    });
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
  async list({ page = 1, limit = 10, status, days } = {}) {
    const { data, headers } = await http().get('/rest/customerorders', {
      params: {
        page,
        limit,
        ...(status ? { status } : {}),
        ...(days ? { days } : {}),
      },
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
  /** The customer's refunds, newest first. */
  async refunds() {
    const { data } = await http().get('/rest/refunds');
    return data.map((r) => ({
      id: r.refund_id,
      orderId: r.order_id,
      orderNumber: r.order_number,
      invoiceNumber: r.invoice_number,
      returnId: r.return_id,
      product: r.product,
      image: r.image,
      status: r.status,
      amount: Number(r.amount),
      method: r.method,
      reference: r.reference,
      currency: r.currency,
      date: r.date_added,
      processedAt: r.date_processed,
    }));
  },
};

export const adminOrders = {
  /** Filters: status, search, paymentStatus, shippingMethod, paymentMethod, days. */
  async list({
    page = 1,
    limit = 10,
    status,
    search,
    paymentStatus,
    shippingMethod,
    paymentMethod,
    days,
    customer,
  } = {}) {
    const { data, headers } = await http().get('/admin/orders', {
      params: {
        page,
        limit,
        ...(status ? { status } : {}),
        ...(search ? { search } : {}),
        ...(paymentStatus ? { payment_status: paymentStatus } : {}),
        ...(shippingMethod ? { shipping_method: shippingMethod } : {}),
        ...(paymentMethod ? { payment_method: paymentMethod } : {}),
        ...(days ? { days } : {}),
        ...(customer ? { customer } : {}),
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
  /** Ticks a gift line's instructions off (or reopens them). */
  async giftDone(orderId, itemId, done) {
    const { data } = await http().put(
      `/admin/orders/${orderId}/items/${itemId}/gift`,
      { done }
    );
    return orderFromApi(data);
  },
  async listReturns(status, customer) {
    const { data } = await http().get('/admin/returns', {
      params: {
        ...(status ? { status } : {}),
        ...(customer ? { customer } : {}),
      },
    });
    return data.map(returnFromApi);
  },
  /** Paged: { page, limit, status, search, days, customer } → { returns, total, counts } */
  async returnsPage(params = {}) {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    );
    const { data } = await http().get('/admin/returns', { params: clean });
    return { ...data, returns: data.returns.map(returnFromApi) };
  },
  async updateReturn(id, status, { restock } = {}) {
    const { data } = await http().put(`/admin/returns/${id}`, {
      status,
      ...(restock === false ? { restock: false } : {}),
    });
    return returnFromApi(data);
  },
  /** Store overview for the last `days` (7, 30 or 90), raw API shape. */
  async dashboard(days = 30) {
    const { data } = await http().get('/admin/dashboard', {
      params: { days },
    });
    return data;
  },
  /** Attention counts for the bell; null where you lack the permission. */
  /** The bell's newest 10, or every notification with { all: true }. */
  async notifications({ all = false } = {}) {
    const { data } = await http().get('/admin/notifications', {
      params: all ? { all: 1 } : {},
    });
    return data;
  },
  async notificationsRead() {
    await http().post('/admin/notifications/read');
  },
  async notificationsClear() {
    await http().post('/admin/notifications/clear');
  },
  async dismissNotification(key) {
    await http().delete(`/admin/notifications/${encodeURIComponent(key)}`);
  },
};

/** Invoices, payments, refunds, the ledger and staff-made orders (raw API shapes). */
export const adminFinance = {
  async deliveryOptions() {
    const { data } = await http().get('/admin/delivery-options');
    return data;
  },
  async createOrder(body) {
    const { data } = await http().post('/admin/orders', body);
    return orderFromApi(data);
  },
  async editOrder(id, body) {
    const { data } = await http().put(`/admin/orders/${id}`, body);
    return orderFromApi(data);
  },
  async orderMoney(id) {
    const { data } = await http().get(`/admin/orders/${id}/finance`);
    return data;
  },
  async invoices(params = {}) {
    const { data } = await http().get('/admin/invoices', { params });
    return data;
  },
  async invoice(id) {
    const { data } = await http().get(`/admin/invoices/${id}`);
    return { ...data, order: orderFromApi(data.order) };
  },
  async recordPayment(invoiceId, body) {
    const { data } = await http().post(
      `/admin/invoices/${invoiceId}/payments`,
      body
    );
    return data;
  },
  async payments(params = {}) {
    const { data } = await http().get('/admin/payments', { params });
    return data;
  },
  /** { status, search, method, days, customer, page, limit } → { refunds, total, counts } */
  async refunds(params = {}) {
    const { data } = await http().get('/admin/refunds', { params });
    return data;
  },
  async refund(orderId, body) {
    const { data } = await http().post(
      `/admin/orders/${orderId}/refunds`,
      body
    );
    return data;
  },
  async decideRefund(id, action) {
    const { data } = await http().put(`/admin/refunds/${id}`, { action });
    return data;
  },
  async refundSettings() {
    const { data } = await http().get('/admin/refund-settings');
    return data.settings;
  },
  async saveRefundSettings(settings) {
    const { data } = await http().put('/admin/refund-settings', settings);
    return data.settings;
  },
  async ledger(params = {}) {
    const { data } = await http().get('/admin/ledger', { params });
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
