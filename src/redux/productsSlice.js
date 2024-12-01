// src/redux/productsSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getAllProducts } from '../services/productsService';

// Async thunk to fetch products
export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (_, { rejectWithValue }) => {
    try {
      const products = await getAllProducts();
      console.log('Fetched products:', products); // Debugging line
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
  },
  reducers: {
    // Add synchronous reducers if needed
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch products';
      });
  },
});

export default productsSlice.reducer;
