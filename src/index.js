// src/index.js

import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { Provider } from 'react-redux';
import store, { persistor } from './redux/store';
import reportWebVitals from './reportWebVitals';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

// Import Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';

// Import ThemeProvider and createTheme from Material-UI
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// For redux-persist
import { PersistGate } from 'redux-persist/integration/react';

// Create a theme instance with palette definitions
const theme = createTheme({
  palette: {
    primary: {
      main: '#007bff', // Bootstrap primary color
    },
    secondary: {
      main: '#6c757d', // Bootstrap secondary color
    },
  },
});

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      {/* PersistGate ensures the store is rehydrated before rendering the app */}
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <App />
        </ThemeProvider>
      </PersistGate>
    </Provider>
  </React.StrictMode>
);

reportWebVitals();
