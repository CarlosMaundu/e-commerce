// src/services/userService.js
import axios from 'axios';

const API_URL = 'https://api.escuelajs.co/api/v1';
const DEFAULT_AVATAR_URL = 'https://i.imgur.com/kIaFC3J.png'; // Fallback avatar

/**
 * Fetch the profile of the currently logged-in user.
 * @param {string} accessToken - Bearer token for authorization.
 * @returns {Object} User profile data.
 */
export const fetchUserProfile = async (accessToken) => {
  const response = await axios.get(`${API_URL}/auth/profile`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return {
    ...response.data,
    avatar: response.data.avatar || DEFAULT_AVATAR_URL,
  };
};

/**
 * Update an existing user profile.
 * @param {Object} data - User data to update.
 * @param {string} accessToken - Bearer token for authorization.
 * @returns {Object} Updated user data.
 */
export const updateUserProfile = async (data, accessToken) => {
  const { id, name, email, avatar, password } = data;
  const payload = { name, email, avatar: avatar || DEFAULT_AVATAR_URL };
  if (password && password.trim() !== '') {
    payload.password = password;
  }
  const response = await axios.put(`${API_URL}/users/${id}`, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
};

/**
 * Get all users.
 * @returns {Array} List of users.
 */
export const getAllUsers = async () => {
  const response = await axios.get(`${API_URL}/users`);
  return response.data.map((user) => ({
    ...user,
    avatar: user.avatar || DEFAULT_AVATAR_URL,
  }));
};

/**
 * Get a single user by ID.
 * @param {number} id - The user ID.
 * @returns {Object} User data.
 */
export const getUserById = async (id) => {
  const response = await axios.get(`${API_URL}/users/${id}`);
  return {
    ...response.data,
    avatar: response.data.avatar || DEFAULT_AVATAR_URL,
  };
};

/**
 * Create a new user.
 * @param {Object} userData - New user details.
 * @returns {Object} Created user data.
 */
export const createUser = async (userData) => {
  const payload = {
    ...userData,
    avatar: userData.avatar || DEFAULT_AVATAR_URL,
  };
  const response = await axios.post(`${API_URL}/users/`, payload);
  return response.data;
};

/**
 * Update an existing user by ID.
 * @param {number} id - The user ID.
 * @param {Object} updateData - Data to update for the user.
 * @returns {Object} Updated user data.
 */
export const updateUser = async (id, updateData) => {
  const payload = {
    ...updateData,
    avatar: updateData.avatar || DEFAULT_AVATAR_URL,
  };
  const response = await axios.put(`${API_URL}/users/${id}`, payload);
  return response.data;
};

/**
 * Delete a user by ID.
 * @param {number} id - The user ID.
 * @returns {Object} Deletion confirmation.
 */
export const deleteUser = async (id) => {
  const response = await axios.delete(`${API_URL}/users/${id}`);
  return response.data;
};

/**
 * Check if an email is available.
 * @param {string} email - Email to check.
 * @returns {Object} Availability status.
 */
export const isEmailAvailable = async (email) => {
  const response = await axios.post(`${API_URL}/users/is-available`, { email });
  return response.data;
};
