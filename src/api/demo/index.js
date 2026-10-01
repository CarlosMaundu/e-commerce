// src/api/demo/index.js
//
// `demo` data source: the public demo store API (api.escuelajs.co). Its
// responses already use the screens' field names, so no mapping is needed.
// It has no auth and anyone can change its data — see the audit page.
// Functions mirror src/api/remote/index.js exactly.
import axios from 'axios';
import { UserFacingError } from '../../utils/friendlyError';
import { MESSAGES } from '../../notification/messages';

const API_URL = 'https://api.escuelajs.co/api/v1';

export const DEFAULT_AVATAR_URL = 'https://i.imgur.com/kIaFC3J.png';

// The demo API requires 4+ letters/numbers; this value is never used to sign
// in (Firebase owns credentials), so a random placeholder is stored.
const placeholderPassword = () =>
  `p${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;

const isUrl = (value) => /^https?:\/\/\S+$/i.test(value || '');

const productQuery = (filters = {}) => {
  const params = {};
  if (filters.search) params.title = filters.search;
  if (filters.price_min) params.price_min = filters.price_min;
  if (filters.price_max) params.price_max = filters.price_max;
  if (filters.categoryId) params.categoryId = filters.categoryId;
  if (filters.offset !== undefined) params.offset = filters.offset;
  if (filters.limit !== undefined) params.limit = filters.limit;
  return params;
};

export const catalog = {
  async getProducts(filters = {}) {
    const { data } = await axios.get(`${API_URL}/products/`, {
      params: productQuery(filters),
    });
    return data;
  },
  // The demo API has no count endpoint, so this downloads every match.
  async countProducts(filters = {}) {
    const { limit, offset, ...rest } = filters;
    const { data } = await axios.get(`${API_URL}/products/`, {
      params: productQuery(rest),
    });
    return data.length;
  },
  async getProduct(id) {
    const { data } = await axios.get(`${API_URL}/products/${id}`);
    return data;
  },
  async getCategories() {
    const { data } = await axios.get(`${API_URL}/categories/`);
    return data;
  },
  async getCategory(id) {
    const { data } = await axios.get(`${API_URL}/categories/${id}`);
    return data;
  },
};

export const adminCatalog = {
  async createProduct(input) {
    const { data } = await axios.post(`${API_URL}/products/`, input);
    return data;
  },
  async updateProduct(id, input) {
    const { data } = await axios.put(`${API_URL}/products/${id}`, input);
    return data;
  },
  async deleteProduct(id) {
    const { data } = await axios.delete(`${API_URL}/products/${id}`);
    return data;
  },
  async createCategory(input) {
    const { data } = await axios.post(`${API_URL}/categories/`, input);
    return data;
  },
  async updateCategory(id, input) {
    const { data } = await axios.put(`${API_URL}/categories/${id}`, input);
    return data;
  },
  async deleteCategory(id) {
    const { data } = await axios.delete(`${API_URL}/categories/${id}`);
    return data;
  },
  async uploadFile(file, onProgress) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await axios.post(`${API_URL}/files/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
    return data;
  },
};

const userPayload = ({ name, email, avatar, role }) => {
  const payload = {};
  if (name !== undefined) payload.name = name.trim();
  if (email !== undefined) payload.email = email.trim().toLowerCase();
  if (avatar !== undefined) {
    payload.avatar = isUrl(avatar) ? avatar : DEFAULT_AVATAR_URL;
  }
  if (role !== undefined && ['customer', 'admin'].includes(role)) {
    payload.role = role;
  }
  return payload;
};

const findUserByEmail = async (email) => {
  const target = (email || '').trim().toLowerCase();
  const { data } = await axios.get(`${API_URL}/users`);
  return data.find((u) => (u.email || '').toLowerCase() === target);
};

const createUser = async (input) => {
  const { data } = await axios.post(`${API_URL}/users/`, {
    role: 'customer',
    // `avatar: undefined` from callers must not wipe out the default.
    ...userPayload({ ...input, avatar: input.avatar || DEFAULT_AVATAR_URL }),
    password: placeholderPassword(),
  });
  return data;
};

const updateUser = async (id, input) => {
  const { data } = await axios.put(
    `${API_URL}/users/${id}`,
    userPayload(input)
  );
  return data;
};

export const account = {
  // The demo API has no notion of "me", so the profile is looked up by email
  // (downloading every user — one reason this source must not ship).
  async getProfile({ email, name, avatar } = {}) {
    return (
      (await findUserByEmail(email)) ||
      createUser({ name: name || 'New User', email, avatar })
    );
  },
  async updateProfile({ id, name, avatar }) {
    return updateUser(id, { name, avatar });
  },
};

export const adminUsers = {
  async list() {
    const { data } = await axios.get(`${API_URL}/users`);
    return data;
  },
  findByEmail: findUserByEmail,
  create: createUser,
  update: updateUser,
};

export const newsletter = {
  async subscribe() {
    throw new UserFacingError(MESSAGES.newsletter.unavailable);
  },
};
