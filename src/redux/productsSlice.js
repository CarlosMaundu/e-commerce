// src/redux/productsSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct as deleteProductAPI,
} from '../services/productsService';

// 1) Import your local placeholder image:
import placeholderImage from '../images/placeholder.jpg';

/**
 * Async thunk to fetch products with optional filters.
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
 */
export const createProductThunk = createAsyncThunk(
  'products/createProduct',
  async (productData, { dispatch, rejectWithValue }) => {
    try {
      const newProduct = await createProduct(productData);
      // Optionally, refetch products
      dispatch(fetchProducts({ limit: 10, offset: 0 }));
      return newProduct;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Async thunk to update an existing product.
 */
export const updateProductThunk = createAsyncThunk(
  'products/updateProduct',
  async ({ id, updateData }, { dispatch, rejectWithValue }) => {
    try {
      const updatedProduct = await updateProduct(id, updateData);
      // Optionally, refetch products
      dispatch(fetchProducts({ limit: 10, offset: 0 }));
      return updatedProduct;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Async thunk to delete a product.
 */
export const deleteProductThunk = createAsyncThunk(
  'products/deleteProduct',
  async (id, { dispatch, rejectWithValue }) => {
    try {
      await deleteProductAPI(id);
      // Optionally, refetch products
      dispatch(fetchProducts({ limit: 10, offset: 0 }));
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
    hasMore: true,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch Products
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
        // Clear out old products so UI doesn't show stale data
        state.products = [];
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;

        // 2) Transform all product images to use local placeholder if needed:
        const transformed = action.payload.map((product) => {
          if (!product.images) return product;

          // Check each image URL in the product
          const updatedImages = product.images.map((imgUrl) => {
            if (!imgUrl || imgUrl.includes('placeimg.com')) {
              return placeholderImage;
            }
            return imgUrl;
          });

          return {
            ...product,
            images: updatedImages,
          };
        });

        state.products = transformed;

        // If the API returns less items than the limit, assume no more pages
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
        // Product is added via refetch
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
        // Product is updated via refetch
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
        // Product is removed via refetch
      })
      .addCase(deleteProductThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to delete product';
      });
  },
});

export default productsSlice.reducer;
