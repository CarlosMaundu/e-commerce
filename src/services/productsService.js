// src/services/productsService.js

import axios from 'axios';

const API_URL = 'https://api.escuelajs.co/api/v1';

/**
 * Fetch all products with optional filters.
 * @param {Object} filters - Filter parameters.
 * @returns {Array} - List of products.
 */
export const getAllProducts = async (filters = {}) => {
  try {
    let url = `${API_URL}/products/`;

    // Initialize query parameters
    const params = {};

    if (filters.title) {
      params.title = filters.title;
    }

    if (filters.price) {
      params.price = filters.price;
    }

    if (filters.price_min) {
      params.price_min = filters.price_min;
    }

    if (filters.price_max) {
      params.price_max = filters.price_max;
    }

    if (filters.categoryId) {
      params.categoryId = filters.categoryId;
    }

    if (filters.limit) {
      params.limit = filters.limit;
    }

    if (filters.offset) {
      params.offset = filters.offset;
    }

    // Construct query string
    const queryString = new URLSearchParams(params).toString();

    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await axios.get(url);
    return response.data; // Returns an array of products
  } catch (error) {
    throw new Error(
      error.response?.data?.message || 'Failed to fetch products'
    );
  }
};

/**
 * Fetch a single product by ID.
 * @param {number} id - Product ID.
 * @returns {Object} - Product details.
 */
export const getProductById = async (id) => {
  try {
    const response = await axios.get(`${API_URL}/products/${id}`);
    return response.data; // Returns product details
  } catch (error) {
    throw new Error(
      error.response?.data?.message || `Failed to fetch product with ID: ${id}`
    );
  }
};

/**
 * Create a new product.
 * @param {Object} productData - Data for the new product.
 * @returns {Object} - Created product details.
 */
export const createProduct = async (productData) => {
  try {
    const response = await axios.post(`${API_URL}/products/`, productData);
    return response.data; // Returns created product details
  } catch (error) {
    throw new Error(
      error.response?.data?.message || 'Failed to create product'
    );
  }
};

/**
 * Update an existing product.
 * @param {number} id - Product ID.
 * @param {Object} updateData - Data to update the product.
 * @returns {Object} - Updated product details.
 */
export const updateProduct = async (id, updateData) => {
  try {
    const response = await axios.put(`${API_URL}/products/${id}`, updateData);
    return response.data; // Returns updated product details
  } catch (error) {
    throw new Error(
      error.response?.data?.message || `Failed to update product with ID: ${id}`
    );
  }
};

/**
 * Delete a product by ID.
 * @param {number} id - Product ID.
 * @returns {boolean} - Returns true if deletion was successful.
 */
export const deleteProduct = async (id) => {
  try {
    const response = await axios.delete(`${API_URL}/products/${id}`);
    return response.data; // Returns true on successful deletion
  } catch (error) {
    throw new Error(
      error.response?.data?.message || `Failed to delete product with ID: ${id}`
    );
  }
};
