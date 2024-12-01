// src/redux/wishlistSlice.js

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [], // Each item can have id, title, price, etc.
};

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    addToWishlist(state, action) {
      const newItem = action.payload;
      const exists = state.items.find((item) => item.id === newItem.id);
      if (!exists) {
        state.items.push(newItem);
      }
    },
    removeFromWishlist(state, action) {
      const id = action.payload;
      state.items = state.items.filter((item) => item.id !== id);
    },
    clearWishlist(state) {
      state.items = [];
    },
  },
});

export const { addToWishlist, removeFromWishlist, clearWishlist } =
  wishlistSlice.actions;
export default wishlistSlice.reducer;
