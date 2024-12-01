// src/services/authService.js
import axios from 'axios';

const API_URL = 'https://api.escuelajs.co/api/v1';

// Login service: Handles user login and returns tokens
export const login = async (email, password) => {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email,
      password,
    });
    return response.data; // Contains access_token and refresh_token
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Login failed');
  }
};

// Fetch user profile: Gets authenticated user details using access token
export const fetchUserProfile = async (token) => {
  try {
    const response = await axios.get(`${API_URL}/auth/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data; // Contains user details
  } catch (error) {
    throw new Error(
      error.response?.data?.message || 'Failed to fetch user profile'
    );
  }
};

// Refresh token: Handles token refresh for session management
export const refreshToken = async (refreshToken) => {
  try {
    const response = await axios.post(`${API_URL}/auth/refresh-token`, {
      refreshToken,
    });
    return response.data; // Contains new access_token and refresh_token
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to refresh token');
  }
};
