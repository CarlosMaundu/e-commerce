// categoriesSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  fetchCategories as fetchCategoriesAPI,
  createCategory,
  updateCategory,
  deleteCategory as deleteCategoryAPI,
} from '../services/categoryService';

// IMPORT my placeholder
import placeholderImage from '../images/placeholder.jpg';

/**
 * Async thunk to fetch all categories.
 */
export const fetchCategories = createAsyncThunk(
  'categories/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const categories = await fetchCategoriesAPI();
      return categories;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Async thunk to create a new category.
 * @param {Object} categoryData - { name, image }
 */
export const createCategoryThunk = createAsyncThunk(
  'categories/createCategory',
  async (categoryData, { dispatch, rejectWithValue }) => {
    try {
      const newCategory = await createCategory(categoryData);
      dispatch(fetchCategories()); // Refresh categories list
      return newCategory;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Async thunk to update an existing category.
 * @param {Object} payload - { id, updateData }
 */
export const updateCategoryThunk = createAsyncThunk(
  'categories/updateCategory',
  async ({ id, updateData }, { dispatch, rejectWithValue }) => {
    try {
      const updatedCategory = await updateCategory(id, updateData);
      dispatch(fetchCategories()); // Refresh categories list
      return updatedCategory;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Async thunk to delete a category.
 * @param {number} id - Category ID.
 */
export const deleteCategoryThunk = createAsyncThunk(
  'categories/deleteCategory',
  async (id, { dispatch, rejectWithValue }) => {
    try {
      await deleteCategoryAPI(id);
      dispatch(fetchCategories()); // Refresh categories list
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const categoriesSlice = createSlice({
  name: 'categories',
  initialState: {
    categories: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch Categories
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.loading = false;

        // Transform placeimg.com -> local placeholder
        const transformed = action.payload.map((cat) => {
          if (!cat.image || cat.image.includes('placeimg.com')) {
            return { ...cat, image: placeholderImage };
          }
          return cat;
        });

        state.categories = transformed;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch categories';
      })
      // Create Category
      .addCase(createCategoryThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createCategoryThunk.fulfilled, (state, action) => {
        state.loading = false;
        // Category is already added via refetch
      })
      .addCase(createCategoryThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to create category';
      })
      // Update Category
      .addCase(updateCategoryThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCategoryThunk.fulfilled, (state, action) => {
        state.loading = false;
        // Category is already updated via refetch
      })
      .addCase(updateCategoryThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to update category';
      })
      // Delete Category
      .addCase(deleteCategoryThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteCategoryThunk.fulfilled, (state, action) => {
        state.loading = false;
        // Category is already removed via refetch
      })
      .addCase(deleteCategoryThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to delete category';
      });
  },
});

export default categoriesSlice.reducer;
