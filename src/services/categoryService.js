// src/services/categoryService.js

import axios from 'axios';

const API_URL = 'https://api.escuelajs.co/api/v1/categories';

/**
 * Get all categories
 */
export const fetchCategories = async () => {
  try {
    const response = await axios.get(API_URL);
    return response.data; // Returns an array of categories
  } catch (error) {
    console.error('Error fetching categories:', error.message);
    throw error;
  }
};

/**
 * Get a single category by ID
 * @param {number} id - Category ID
 */
export const fetchCategory = async (id) => {
  try {
    const response = await axios.get(`${API_URL}${id}`);
    return response.data; // Returns the category object
  } catch (error) {
    console.error(`Error fetching category with id ${id}:`, error.message);
    throw error;
  }
};

/**
 * Create a new category
 * @param {Object} categoryData - { name: string, image: string }
 */
export const createCategory = async (categoryData) => {
  try {
    const response = await axios.post(API_URL, categoryData);
    return response.data; // Returns the created category object
  } catch (error) {
    console.error('Error creating category:', error.message);
    throw error;
  }
};

/**
 * Update an existing category
 * @param {number} id - Category ID
 * @param {Object} updateData - { name?: string, image?: string }
 */
export const updateCategory = async (id, updateData) => {
  try {
    const response = await axios.put(`${API_URL}${id}`, updateData);
    return response.data; // Returns the updated category object
  } catch (error) {
    console.error(`Error updating category with id ${id}:`, error.message);
    throw error;
  }
};

/**
 * Delete a category by ID
 * @param {number} id - Category ID
 */
export const deleteCategory = async (id) => {
  try {
    const response = await axios.delete(`${API_URL}${id}`);
    return response.data; // Returns true on successful deletion
  } catch (error) {
    console.error(`Error deleting category with id ${id}:`, error.message);
    throw error;
  }
};

/**
 * Get all products by category ID
 * @param {number} categoryID - Category ID
 */
export const fetchProductsByCategory = async (categoryID) => {
  try {
    const response = await axios.get(`${API_URL}${categoryID}/products`);
    return response.data; // Returns an array of products
  } catch (error) {
    console.error(
      `Error fetching products for category id ${categoryID}:`,
      error.message
    );
    throw error;
  }
};
