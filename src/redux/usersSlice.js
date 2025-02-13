// src/redux/usersSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  getAllUsers,
  deleteUser as deleteUserAPI,
  updateUser as updateUserAPI,
  createUser as createUserAPI,
  updateUserProfile,
  fetchUserProfile as fetchUserProfileAPI,
} from '../services/userService';

const initialState = {
  list: [],
  currentUser: null, // Stores the logged-in user's profile
  loading: false,
  error: null,
};

/**
 * Fetch all users (admin functionality).
 */
export const fetchAllUsers = createAsyncThunk(
  'users/fetchAll',
  async (_, thunkAPI) => {
    try {
      const response = await getAllUsers();
      return response;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Remove a user by ID (admin functionality).
 */
export const removeUser = createAsyncThunk(
  'users/remove',
  async (id, thunkAPI) => {
    try {
      await deleteUserAPI(id);
      return id;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Update a user by ID (admin functionality).
 */
export const updateUserThunk = createAsyncThunk(
  'users/update',
  async ({ id, data }, thunkAPI) => {
    try {
      const updated = await updateUserAPI(id, data);
      return updated;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Create a new user (admin functionality).
 */
export const createUserThunk = createAsyncThunk(
  'users/create',
  async (userData, thunkAPI) => {
    try {
      const created = await createUserAPI(userData);
      return created;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch the current logged-in user's profile.
 */
export const fetchUserProfileThunk = createAsyncThunk(
  'users/fetchProfile',
  async (accessToken, thunkAPI) => {
    try {
      const profile = await fetchUserProfileAPI(accessToken);
      return profile;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Update the current logged-in user's profile.
 * @param {Object} data - The profile data to update.
 * @param {string} accessToken - The access token for authorization.
 */
export const updateProfileThunk = createAsyncThunk(
  'users/updateProfile',
  async ({ data, accessToken }, thunkAPI) => {
    try {
      const updatedProfile = await updateUserProfile(data, accessToken);
      return updatedProfile;
    } catch (error) {
      // NEW: Check for Escuelajs "EntityNotFoundError"
      if (
        error?.response?.status === 400 &&
        error?.response?.data?.name === 'EntityNotFoundError'
      ) {
        return thunkAPI.rejectWithValue(
          'User not found on the server. Please refresh or contact support.'
        );
      }
      // Otherwise, fallback to original error message
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    clearCurrentUser(state) {
      state.currentUser = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch All Users (Admin)
      .addCase(fetchAllUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchAllUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Remove User (Admin)
      .addCase(removeUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeUser.fulfilled, (state, action) => {
        state.loading = false;
        state.list = state.list.filter((user) => user.id !== action.payload);
      })
      .addCase(removeUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update User (Admin)
      .addCase(updateUserThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUserThunk.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.list.findIndex((u) => u.id === action.payload.id);
        if (index !== -1) {
          state.list[index] = action.payload;
        }
      })
      .addCase(updateUserThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Create User (Admin)
      .addCase(createUserThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createUserThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.list.push(action.payload);
      })
      .addCase(createUserThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch Current User Profile
      .addCase(fetchUserProfileThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserProfileThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload;
      })
      .addCase(fetchUserProfileThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update Current User Profile
      .addCase(updateProfileThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfileThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload;
        // Optionally, update in the list if the current user is part of the list
        const index = state.list.findIndex((u) => u.id === action.payload.id);
        if (index !== -1) {
          state.list[index] = action.payload;
        }
      })
      .addCase(updateProfileThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearCurrentUser } = usersSlice.actions;

export default usersSlice.reducer;
