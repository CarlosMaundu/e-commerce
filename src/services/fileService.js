// src/services/fileService.js
import axios from 'axios';

const API_URL = 'https://api.escuelajs.co/api/v1';

export const uploadFile = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  // Errors propagate unchanged so friendlyError() can read the response.
  const response = await axios.post(`${API_URL}/files/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  });
  return response.data;
};
