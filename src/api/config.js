// src/api/config.js
//
// Where the app's data comes from. Screens never need to know:
//   demo – the public demo store API (current behaviour; no auth on the server)
//   mock – an in-browser fake backend that implements our API contract
//   api  – our own backend (REACT_APP_API_BASE_URL)
// See src/api/contract.md.

export const DATA_SOURCES = ['demo', 'mock', 'api'];

const requested = process.env.REACT_APP_DATA_SOURCE;

export const DATA_SOURCE = DATA_SOURCES.includes(requested)
  ? requested
  : 'demo';

// Base URL of our backend. Storefront routes live under /rest (OpenCart
// layout), admin routes under /admin.
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

export const usesRemoteContract = DATA_SOURCE !== 'demo';
