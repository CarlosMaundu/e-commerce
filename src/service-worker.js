/* eslint-disable no-restricted-globals */
// src/service-worker.js — makes the shop an installable app that opens
// instantly and keeps working for browsing when the connection drops.
// Built by Create React App (Workbox InjectManifest) in production only.
//
//   - The app itself (HTML, scripts, styles) is stored on install, so it
//     opens without the network; every page falls back to it.
//   - Catalogue data (products, categories, store settings, deals) comes from
//     the network when there is one — fresh prices and stock — and from the
//     last copy when offline.
//   - Photos and fonts are kept for a month.
//   - Cart, checkout, payments, account and sign-in always go to the network:
//     nothing personal or money-related is ever served from a copy.
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
} from 'workbox-strategies';

clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

// Pages: the app shell, except API, uploads and files with an extension.
const fileExtension = /\/[^/?]+\.[^/]+$/;
registerRoute(
  ({ request, url }) => {
    if (request.mode !== 'navigate') return false;
    if (
      url.pathname.startsWith('/api') ||
      url.pathname.startsWith('/uploads')
    ) {
      return false;
    }
    return !url.pathname.match(fileExtension);
  },
  createHandlerBoundToURL(`${process.env.PUBLIC_URL}/index.html`)
);

// Public catalogue reads only (GET). Anything else under /api is untouched.
const CATALOG =
  /^\/api\/rest\/(products|categories|store|manufacturers|product_filters|promotions)(\/|$|\?)/;
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    CATALOG.test(url.pathname) &&
    !url.searchParams.has('suggest'),
  new NetworkFirst({
    cacheName: 'catalog',
    networkTimeoutSeconds: 4,
    plugins: [
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 7 * 24 * 3600 }),
    ],
  })
);

// Product photos, uploads and the app's icons.
registerRoute(
  ({ url, request }) =>
    request.destination === 'image' &&
    (url.origin === self.location.origin || url.protocol === 'https:'),
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 30 * 24 * 3600 }),
    ],
  })
);

// Google Fonts: the stylesheet updates in the background; font files stay.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'font-styles' })
);
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'fonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 }),
    ],
  })
);

// "Reload" on the new-version notice: the waiting version takes over.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
