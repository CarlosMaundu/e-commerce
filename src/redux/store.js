// src/redux/store.js

import { configureStore } from '@reduxjs/toolkit';
import cartReducer from './cartSlice';
import wishlistReducer from './wishlistSlice';
import categoriesReducer from './categoriesSlice';
import fileReducer from './fileSlice';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage for web

// Only guest data is kept in the browser; signed-in carts and wishlists are
// reloaded from the server. Version 2 = new cart shape (old data is dropped).
const cartPersistConfig = {
  key: 'cart',
  version: 2,
  storage,
  whitelist: ['guestItems'],
  migrate: (state) =>
    Promise.resolve(state && state._persist?.version === 2 ? state : undefined),
};

const wishlistPersistConfig = {
  key: 'wishlist',
  version: 2,
  storage,
  whitelist: ['items'],
  migrate: (state) =>
    Promise.resolve(state && state._persist?.version === 2 ? state : undefined),
};

const persistedCartReducer = persistReducer(cartPersistConfig, cartReducer);
const persistedWishlistReducer = persistReducer(
  wishlistPersistConfig,
  wishlistReducer
);

const store = configureStore({
  reducer: {
    cart: persistedCartReducer,
    wishlist: persistedWishlistReducer,
    categories: categoriesReducer,
    files: fileReducer,
    // ... add other reducers as needed
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
