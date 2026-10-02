// src/api/config.js
//
// The frontend talks only to our backend (backend/, see src/api/contract.md).
// Default '/api' is same-origin: nginx proxies it in Docker, and the dev
// server proxies it to localhost:4000 (src/setupProxy.js).
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

export const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
