// src/redux/productsSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getAllProducts } from '../services/productsService';

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

const productsSlice = createSlice({
  name: 'products',
  initialState: {
    products: [],
    loading: false,
    error: null,
    total: 0, // Total number of products (useful for pagination)
  },
  reducers: {
    // other synchronous reducers will be added here if needed
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
        // Optionally, clear previous products:
        // state.products = [];
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload;
        state.total = action.payload.length; // Adjust based on API response
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch products';
      });
  },
});

export default productsSlice.reducer;
