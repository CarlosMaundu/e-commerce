// src/redux/cartSlice.js

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [], // Each item should have id, size, quantity, etc.
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (state, action) => {
      const item = action.payload;
      const existingItem = state.items.find(
        (i) => i.id === item.id && i.size === item.size
      );
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        state.items.push({ ...item, quantity: 1 });
      }
    },
    removeItem: (state, action) => {
      const { id, size } = action.payload;
      state.items = state.items.filter(
        (item) => !(item.id === id && item.size === size)
      );
    },
    incrementQuantity: (state, action) => {
      const { id, size } = action.payload;
      const item = state.items.find((i) => i.id === id && i.size === size);
      if (item) {
        item.quantity += 1;
      }
    },
    decrementQuantity: (state, action) => {
      const { id, size } = action.payload;
      const item = state.items.find((i) => i.id === id && i.size === size);
      if (item && item.quantity > 1) {
        item.quantity -= 1;
      }
    },
  },
});

export const { addItem, removeItem, incrementQuantity, decrementQuantity } =
  cartSlice.actions;

export default cartSlice.reducer;
