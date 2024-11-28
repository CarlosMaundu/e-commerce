const axios = require('axios');

const API_URL = 'https://dummyjson.com/auth';

exports.login = async (username, password) => {
  const response = await axios.post(`${API_URL}/login`, { username, password });
  return response.data;
};

exports.fetchUserDetails = async (token) => {
  const response = await axios.get(`${API_URL}/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

exports.refreshToken = async (refreshToken) => {
  const response = await axios.post(`${API_URL}/refresh`, { refreshToken });
  return response.data;
};
