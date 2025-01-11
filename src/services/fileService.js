// src/services/fileService.js
import axios from 'axios';

const API_URL = 'https://api.escuelajs.co/api/v1';

export const uploadFile = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`${API_URL}/files/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'File upload failed');
  }
};
