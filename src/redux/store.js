// src/redux/store.js

import { configureStore } from '@reduxjs/toolkit';
import cartReducer from './cartSlice';
import productsReducer from './productsSlice';
import wishlistReducer from './wishlistSlice';
import categoriesReducer from './categoriesSlice';
import usersReducer from './usersSlice';
import fileReducer from './fileSlice';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage for web

const cartPersistConfig = {
  key: 'cart',
  storage,
};

const wishlistPersistConfig = {
  key: 'wishlist',
  storage,
};

const persistedCartReducer = persistReducer(cartPersistConfig, cartReducer);
const persistedWishlistReducer = persistReducer(
  wishlistPersistConfig,
  wishlistReducer
);

const store = configureStore({
  reducer: {
    cart: persistedCartReducer,
    products: productsReducer,
    wishlist: persistedWishlistReducer,
    categories: categoriesReducer,
    users: usersReducer,
    files: fileReducer,
    // ... other reducers as needed
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore actions from redux-persist that contain non-serializable values
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export const persistor = persistStore(store);
export default store;
