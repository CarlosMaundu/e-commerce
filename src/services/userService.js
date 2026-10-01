// src/services/userService.js
//
// User *profiles* (name, avatar, role) live in the store API. Credentials live
// in Firebase Auth only — the API's own password field is unused by this app,
// so we store a random placeholder there and never send real passwords.
import axios from 'axios';

const API_URL = 'https://api.escuelajs.co/api/v1';

export const DEFAULT_AVATAR_URL = 'https://i.imgur.com/kIaFC3J.png';
export const USER_ROLES = ['customer', 'admin'];

// The API requires 4+ letters/numbers; this value is never used to sign in.
const placeholderPassword = () =>
  `p${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;

const isUrl = (value) => /^https?:\/\/\S+$/i.test(value || '');

/** Only send fields the API understands, in the shape it validates. */
const toApiPayload = ({ name, email, avatar, role }) => {
  const payload = {};
  if (name !== undefined) payload.name = name.trim();
  if (email !== undefined) payload.email = email.trim().toLowerCase();
  if (avatar !== undefined) {
    payload.avatar = isUrl(avatar) ? avatar : DEFAULT_AVATAR_URL;
  }
  if (role !== undefined && USER_ROLES.includes(role)) payload.role = role;
  return payload;
};

/**
 * Get all users.
 * @returns {Array} List of users.
 */
export const getAllUsers = async () => {
  const response = await axios.get(`${API_URL}/users`);
  return response.data;
};

/**
 * Find a user profile by email (case-insensitive).
 * @returns {Object|undefined}
 */
export const getUserByEmail = async (email) => {
  const target = (email || '').trim().toLowerCase();
  const users = await getAllUsers();
  return users.find((u) => (u.email || '').toLowerCase() === target);
};

/**
 * Get a single user by ID.
 * @param {number} id - The user ID.
 * @returns {Object} User data.
 */
export const getUserById = async (id) => {
  const response = await axios.get(`${API_URL}/users/${id}`);
  return response.data;
};

/**
 * Create a user profile.
 * @param {{name: string, email: string, avatar?: string, role?: string}} userData
 * @returns {Object} Created user data.
 */
export const createUser = async (userData) => {
  const payload = {
    role: 'customer',
    ...toApiPayload({ avatar: DEFAULT_AVATAR_URL, ...userData }),
    password: placeholderPassword(),
  };
  const response = await axios.post(`${API_URL}/users/`, payload);
  return response.data;
};

/**
 * Update a user profile by ID. Passwords are managed by Firebase and are
 * deliberately not sent.
 * @param {number} id - The user ID.
 * @param {{name?: string, email?: string, avatar?: string, role?: string}} updateData
 * @returns {Object} Updated user data.
 */
export const updateUser = async (id, updateData) => {
  const response = await axios.put(
    `${API_URL}/users/${id}`,
    toApiPayload(updateData)
  );
  return response.data;
};

/**
 * Update the signed-in user's own profile. Role changes are not allowed here.
 */
export const updateUserProfile = async ({ id, name, email, avatar }) =>
  updateUser(id, { name, email, avatar });

/**
 * Check if an email is available.
 * @param {string} email - Email to check.
 * @returns {Object} Availability status.
 */
export const isEmailAvailable = async (email) => {
  const response = await axios.post(`${API_URL}/users/is-available`, { email });
  return response.data;
};
