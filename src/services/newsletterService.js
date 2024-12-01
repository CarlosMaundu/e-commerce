// src/services/newsletterService.js

import axios from 'axios';

const API_BASE_URL = 'https://api.escuelajs.co/api/v1';

export const addNewsletterSubscriber = async (email) => {
  try {
    // Mock API endpoint since none is available at the moment.

    const response = await axios.post(`${API_BASE_URL}/newsletter`, { email });
    return response.data;
  } catch (error) {
    console.error('Error subscribing to newsletter:', error);
    throw error;
  }
};
