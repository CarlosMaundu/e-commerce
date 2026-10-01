// src/services/productsService.js

import axios from 'axios';

const API_URL = 'https://api.escuelajs.co/api/v1';

/**
 * Fetch all products with optional filters (search, price, categoryId, etc.).
 * Note: This API does not support direct sorting by price; we do that client-side.
 * @param {Object} filters - Filter parameters (search, price_min, price_max, categoryId, limit, offset, etc.).
 * @returns {Array} - List of products.
 */
export const getAllProducts = async (filters = {}) => {
  try {
    let url = `${API_URL}/products/`;

    // Initialize query parameters
    const params = {};

    // Map 'filters.search' to 'title' for searching by title
    if (filters.search) {
      params.title = filters.search;
    }

    // For filtering by exact price or by range:
    if (filters.price_min) {
      params.price_min = filters.price_min;
    }
    if (filters.price_max) {
      params.price_max = filters.price_max;
    }
    if (filters.price) {
      params.price = filters.price;
    }

    if (filters.categoryId) {
      params.categoryId = filters.categoryId;
    }

    // Ensure offset is included even if 0
    if (typeof filters.offset !== 'undefined') {
      params.offset = filters.offset;
    }

    // Same for limit
    if (typeof filters.limit !== 'undefined') {
      params.limit = filters.limit;
    }

    // Construct query string
    const queryString = new URLSearchParams(params).toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await axios.get(url);
    return response.data; // Returns an array of products
  } catch (error) {
    // Keep the axios error intact so friendlyError() can read the response.
    throw error;
  }
};

/**
 * Fetch a single product by ID.
 */
export const getProductById = async (id) => {
  try {
    const response = await axios.get(`${API_URL}/products/${id}`);
    return response.data; // Returns product details
  } catch (error) {
    // Keep the axios error intact so friendlyError() can read the response.
    throw error;
  }
};

/**
 * Create a new product.
 */
export const createProduct = async (productData) => {
  try {
    const response = await axios.post(`${API_URL}/products/`, productData);
    return response.data; // Returns created product details
  } catch (error) {
    // Keep the axios error intact so friendlyError() can read the response.
    throw error;
  }
};

/**
 * Update an existing product.
 */
export const updateProduct = async (id, updateData) => {
  try {
    const response = await axios.put(`${API_URL}/products/${id}`, updateData);
    return response.data; // Returns updated product details
  } catch (error) {
    // Keep the axios error intact so friendlyError() can read the response.
    throw error;
  }
};

/**
 * Delete a product by ID.
 */
export const deleteProduct = async (id) => {
  try {
    const response = await axios.delete(`${API_URL}/products/${id}`);
    return response.data; // Returns true on successful deletion
  } catch (error) {
    // Keep the axios error intact so friendlyError() can read the response.
    throw error;
  }
};
