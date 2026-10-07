// src/redux/cartSlice.js
//
// Two modes:
//   guest  – items live in the browser (persisted); prices are shown for
//            information only. Promo codes need an account.
//   server – the signed-in user's cart on our backend, priced by the server.
// On sign-in the guest cart is merged into the account (POST /cart_bulk).
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { cart as cartApi } from '../api';
import { friendlyError } from '../utils/friendlyError';

/** Same choice, same line: options in a stable order. */
const optionKey = (options = {}) =>
  Object.keys(options)
    .sort()
    .map((k) => `${k}=${options[k]}`)
    .join('|');

export const guestKey = (productId, options) =>
  `${productId}|${optionKey(options)}`;

/** Price a guest pays for a product or its chosen variant. */
const priceOf = (product, variant) => {
  const source = variant || product;
  const special =
    source.specialPrice !== null && source.specialPrice !== undefined
      ? source.specialPrice
      : null;
  return {
    price: source.price,
    specialPrice: special,
    unitPrice: special ?? source.price,
  };
};

const emptyServer = {
  items: [],
  itemCount: 0,
  totals: [],
  total: 0,
  coupon: null,
  couponProblem: null,
};

const initialState = {
  mode: 'guest', // 'guest' | 'server'
  guestItems: [], // persisted
  server: emptyServer,
  status: 'idle', // 'idle' | 'loading'
  error: null,
};

const run = (fn) => async (arg, thunkApi) => {
  try {
    return await fn(arg, thunkApi);
  } catch (error) {
    return thunkApi.rejectWithValue(friendlyError(error));
  }
};

/** Loads the account cart after sign-in, merging any guest items first. */
export const syncCartAfterSignIn = createAsyncThunk(
  'cart/syncAfterSignIn',
  run(async (_, { getState }) => {
    const guest = getState().cart.guestItems;
    return guest.length ? cartApi.addMany(guest) : cartApi.get();
  })
);

export const loadCart = createAsyncThunk(
  'cart/load',
  run(() => cartApi.get())
);

export const addToCart = createAsyncThunk(
  'cart/add',
  run(
    async (
      { product, quantity = 1, options = {}, variant = null },
      { getState }
    ) => {
      if (getState().cart.mode !== 'server') {
        return { guest: { product, quantity, options, variant } };
      }
      return {
        server: await cartApi.add({ productId: product.id, quantity, options }),
      };
    }
  )
);

export const setCartQuantity = createAsyncThunk(
  'cart/setQuantity',
  run(async ({ key, quantity }, { getState }) => {
    if (getState().cart.mode !== 'server') return { guest: { key, quantity } };
    return { server: await cartApi.update(key, quantity) };
  })
);

export const removeFromCart = createAsyncThunk(
  'cart/remove',
  run(async (key, { getState }) => {
    if (getState().cart.mode !== 'server') return { guest: { key } };
    return { server: await cartApi.remove(key) };
  })
);

/** Gift details for a line (signed-in carts only). */
export const setCartGift = createAsyncThunk(
  'cart/setGift',
  run(({ key, gift }) => cartApi.setGift(key, gift))
);

export const applyCoupon = createAsyncThunk(
  'cart/applyCoupon',
  run((code) => cartApi.applyCoupon(code))
);

export const removeCoupon = createAsyncThunk(
  'cart/removeCoupon',
  run(() => cartApi.removeCoupon())
);

const setServer = (state, cart) => {
  state.mode = 'server';
  state.server = cart;
  state.status = 'idle';
  state.error = null;
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    /** After sign-out: back to an empty guest cart. */
    resetToGuest: (state) => {
      state.mode = 'guest';
      state.server = emptyServer;
      state.guestItems = [];
      state.error = null;
    },
    /** Server cart replaced from elsewhere (e.g. reorder). */
    cartReplaced: (state, action) => setServer(state, action.payload),
    /** Order placed: the server already emptied the cart. */
    clearCart: (state) => {
      state.server = emptyServer;
      state.guestItems = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncCartAfterSignIn.fulfilled, (state, action) => {
        setServer(state, action.payload);
        state.guestItems = []; // merged into the account
      })
      .addCase(loadCart.fulfilled, (state, action) =>
        setServer(state, action.payload)
      )
      .addCase(addToCart.fulfilled, (state, action) => {
        const { guest, server } = action.payload;
        if (server) return setServer(state, server);
        const { product, quantity, options, variant } = guest;
        const key = guestKey(product.id, options);
        const existing = state.guestItems.find((i) => i.key === key);
        if (existing) {
          existing.quantity = Math.min(existing.quantity + quantity, 99);
        } else {
          state.guestItems.push({
            key,
            productId: product.id,
            title: product.title,
            image: variant?.images?.[0] || (product.images || [])[0] || '',
            options,
            quantity,
            ...priceOf(product, variant),
          });
        }
      })
      .addCase(setCartQuantity.fulfilled, (state, action) => {
        const { guest, server } = action.payload;
        if (server) return setServer(state, server);
        const item = state.guestItems.find((i) => i.key === guest.key);
        if (item) item.quantity = Math.max(1, Math.min(guest.quantity, 99));
      })
      .addCase(removeFromCart.fulfilled, (state, action) => {
        const { guest, server } = action.payload;
        if (server) return setServer(state, server);
        state.guestItems = state.guestItems.filter((i) => i.key !== guest.key);
      })
      .addCase(setCartGift.fulfilled, (state, action) =>
        setServer(state, action.payload)
      )
      .addCase(applyCoupon.fulfilled, (state, action) =>
        setServer(state, action.payload)
      )
      .addCase(removeCoupon.fulfilled, (state, action) =>
        setServer(state, action.payload)
      )
      .addMatcher(
        (action) =>
          action.type.startsWith('cart/') && action.type.endsWith('/pending'),
        (state) => {
          state.status = 'loading';
        }
      )
      .addMatcher(
        (action) =>
          action.type.startsWith('cart/') && action.type.endsWith('/rejected'),
        (state, action) => {
          state.status = 'idle';
          state.error = action.payload || 'Something went wrong.';
        }
      )
      .addMatcher(
        (action) =>
          action.type.startsWith('cart/') && action.type.endsWith('/fulfilled'),
        (state) => {
          state.status = 'idle';
        }
      );
  },
});

export const { resetToGuest, cartReplaced, clearCart } = cartSlice.actions;

// ---------- selectors ----------

const guestSubtotal = (items) =>
  Math.round(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) * 100) /
  100;

/** One shape for both modes, so screens don't care where the cart lives. */
export const selectCart = (state) => {
  const c = state.cart;
  if (c.mode === 'server') {
    return { ...c.server, mode: 'server', status: c.status };
  }
  const subtotal = guestSubtotal(c.guestItems);
  return {
    mode: 'guest',
    status: c.status,
    items: c.guestItems.map((i) => ({
      ...i,
      total: Math.round(i.unitPrice * i.quantity * 100) / 100,
    })),
    itemCount: c.guestItems.reduce((s, i) => s + i.quantity, 0),
    totals: [{ code: 'sub_total', title: 'Subtotal', value: subtotal }],
    total: subtotal,
    coupon: null,
    couponProblem: null,
  };
};

export const selectCartCount = (state) =>
  state.cart.mode === 'server'
    ? state.cart.server.itemCount
    : state.cart.guestItems.reduce((s, i) => s + i.quantity, 0);

export default cartSlice.reducer;
