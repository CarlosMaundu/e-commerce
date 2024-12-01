import axios from 'axios';

const API_URL = 'https://api.escuelajs.co/api/v1/categories/';

export const fetchCategories = async () => {
  try {
    const response = await axios.get(API_URL);
    return response.data; // Returns an array of categories
  } catch (error) {
    console.error('Error fetching categories:', error.message);
    throw error;
  }
};
