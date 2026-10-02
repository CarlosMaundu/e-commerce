// src/redux/wishlistSlice.js
//
// Guests keep a wishlist in the browser; signed-in users' wishlists live on
// the server. Guest items are copied to the account on sign-in.
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { wishlist as wishlistApi } from '../api';
import { friendlyError } from '../utils/friendlyError';

const initialState = {
  mode: 'guest',
  items: [], // products (screen shape)
  error: null,
};

const run = (fn) => async (arg, thunkApi) => {
  try {
    return await fn(arg, thunkApi);
  } catch (error) {
    return thunkApi.rejectWithValue(friendlyError(error));
  }
};

export const syncWishlistAfterSignIn = createAsyncThunk(
  'wishlist/syncAfterSignIn',
  run(async (_, { getState }) => {
    const { mode, items } = getState().wishlist;
    if (mode === 'guest') {
      for (const product of items) {
        // eslint-disable-next-line no-await-in-loop
        await wishlistApi.add(product.id).catch(() => {});
      }
    }
    return wishlistApi.list();
  })
);

export const addToWishlist = createAsyncThunk(
  'wishlist/add',
  run(async (product, { getState }) => {
    if (getState().wishlist.mode === 'server')
      await wishlistApi.add(product.id);
    return product;
  })
);

export const removeFromWishlist = createAsyncThunk(
  'wishlist/remove',
  run(async (productId, { getState }) => {
    if (getState().wishlist.mode === 'server') {
      await wishlistApi.remove(productId);
    }
    return productId;
  })
);

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    resetWishlistToGuest: (state) => {
      state.mode = 'guest';
      state.items = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncWishlistAfterSignIn.fulfilled, (state, action) => {
        state.mode = 'server';
        state.items = action.payload;
        state.error = null;
      })
      .addCase(addToWishlist.fulfilled, (state, action) => {
        if (!state.items.some((p) => p.id === action.payload.id)) {
          state.items.unshift(action.payload);
        }
      })
      .addCase(removeFromWishlist.fulfilled, (state, action) => {
        state.items = state.items.filter((p) => p.id !== action.payload);
      })
      .addMatcher(
        (action) =>
          action.type.startsWith('wishlist/') &&
          action.type.endsWith('/rejected'),
        (state, action) => {
          state.error = action.payload || 'Something went wrong.';
        }
      );
  },
});

export const { resetWishlistToGuest } = wishlistSlice.actions;

export const isInWishlist = (state, productId) =>
  state.wishlist.items.some((p) => p.id === productId);

export default wishlistSlice.reducer;
