// src/services/productsService.js

import axios from 'axios';

const API_URL = 'https://api.escuelajs.co/api/v1';

// Get all products
export const getAllProducts = async () => {
  try {
    const response = await axios.get(`${API_URL}/products/`);
    return response.data; // Contains list of products
  } catch (error) {
    throw new Error(
      error.response?.data?.message || 'Failed to fetch products'
    );
  }
};

// Get a single product by ID
export const getProductById = async (id) => {
  try {
    const response = await axios.get(`${API_URL}/products/${id}`);
    return response.data; // Contains product details
  } catch (error) {
    throw new Error(
      error.response?.data?.message || `Failed to fetch product with ID: ${id}`
    );
  }
};

// Create a new product
export const createProduct = async (productData) => {
  try {
    const response = await axios.post(`${API_URL}/products/`, productData);
    return response.data; // Contains created product details
  } catch (error) {
    throw new Error(
      error.response?.data?.message || 'Failed to create product'
    );
  }
};
