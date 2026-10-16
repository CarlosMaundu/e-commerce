// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AppErrorBoundary } from './monitoring';
import reportWebVitals from './reportWebVitals';
import { register as registerServiceWorker } from './serviceWorkerRegistration';

// App.js provides the theme, store and router.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);

// Installable app: offline browsing and a notice when a new version is ready.
registerServiceWorker();

reportWebVitals();
