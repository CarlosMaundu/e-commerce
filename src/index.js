// src/index.js

import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import { Provider } from 'react-redux';
import store from './redux/store';
import reportWebVitals from './reportWebVitals';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

// Import Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';

// Import ThemeProvider and createTheme from Material-UI
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

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

ReactDOM.render(
  <React.StrictMode>
    <Provider store={store}>
      {/* Wrap the app with ThemeProvider */}
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </Provider>
  </React.StrictMode>,
  document.getElementById('root')
);

reportWebVitals();
