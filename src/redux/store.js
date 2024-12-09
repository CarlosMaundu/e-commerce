// src/redux/store.js

import { configureStore } from '@reduxjs/toolkit';
import cartReducer from './cartSlice';
import productsReducer from './productsSlice';
import wishlistReducer from './wishlistSlice';

const store = configureStore({
  reducer: {
    cart: cartReducer,
    products: productsReducer,
    wishlist: wishlistReducer,
  },
});

export default store;
