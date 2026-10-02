// src/setupProxy.js — used only by `npm start` (Create React App dev server).
// Forwards API and upload requests to the backend so the app and API share an
// origin, exactly as nginx does in Docker. Override with API_PROXY_TARGET.
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  const target = process.env.API_PROXY_TARGET || 'http://localhost:4000';
  app.use(
    createProxyMiddleware({
      target,
      changeOrigin: false,
      pathFilter: ['/api', '/uploads'],
    })
  );
};
