import axios from 'axios';

const API_URL = 'https://api.escuelajs.co/api/v1';

export const fetchUserProfile = async (accessToken) => {
  const response = await axios.get(`${API_URL}/auth/profile`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
};

export const updateUserProfile = async (data, accessToken) => {
  const { id, name, email, avatar, password } = data;
  const payload = { name, email, avatar };
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
