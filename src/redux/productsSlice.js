// src/redux/productsSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct as deleteProductAPI,
} from '../services/productsService';

/**
 * Async thunk to fetch products with optional filters.
 * @param {Object} filters - Filter parameters.
 */
export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const products = await getAllProducts(filters);
      console.log('Fetched products with filters:', filters, products); // Debugging
      return products;
    } catch (error) {
      console.error('Error fetching products:', error.message);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Async thunk to create a new product.
 * @param {Object} productData - Data for the new product.
 */
export const createProductThunk = createAsyncThunk(
  'products/createProduct',
  async (productData, { dispatch, rejectWithValue }) => {
    try {
      const newProduct = await createProduct(productData);
      // Optionally, refetch products
      dispatch(fetchProducts({ limit: 10, offset: 0 })); // Adjust limit and offset as needed
      return newProduct;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Async thunk to update an existing product.
 * @param {Object} payload - { id, updateData }
 */
export const updateProductThunk = createAsyncThunk(
  'products/updateProduct',
  async ({ id, updateData }, { dispatch, rejectWithValue }) => {
    try {
      const updatedProduct = await updateProduct(id, updateData);
      // Optionally, refetch products
      dispatch(fetchProducts({ limit: 10, offset: 0 })); // Adjust limit and offset as needed
      return updatedProduct;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Async thunk to delete a product.
 * @param {number} id - Product ID.
 */
export const deleteProductThunk = createAsyncThunk(
  'products/deleteProduct',
  async (id, { dispatch, rejectWithValue }) => {
    try {
      await deleteProductAPI(id);
      // Optionally, refetch products
      dispatch(fetchProducts({ limit: 10, offset: 0 })); // Adjust limit and offset as needed
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const productsSlice = createSlice({
  name: 'products',
  initialState: {
    products: [],
    loading: false,
    error: null,
    hasMore: true, // Indicates if more products are available for pagination
  },
  reducers: {
    // Add synchronous reducers here if needed
  },
  extraReducers: (builder) => {
    builder
      // Fetch Products
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload;
        // Determine if there are more products to fetch
        state.hasMore = action.payload.length > 0;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch products';
      })
      // Create Product
      .addCase(createProductThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProductThunk.fulfilled, (state, action) => {
        state.loading = false;
        // Product is already added via refetch
      })
      .addCase(createProductThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to create product';
      })
      // Update Product
      .addCase(updateProductThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProductThunk.fulfilled, (state, action) => {
        state.loading = false;
        // Product is already updated via refetch
      })
      .addCase(updateProductThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to update product';
      })
      // Delete Product
      .addCase(deleteProductThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteProductThunk.fulfilled, (state, action) => {
        state.loading = false;
        // Product is already removed via refetch
      })
      .addCase(deleteProductThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to delete product';
      });
  },
});

export default productsSlice.reducer;
