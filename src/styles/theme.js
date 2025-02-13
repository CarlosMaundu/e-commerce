// src/styles/theme.js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      dark: '#1565c0', // Used for hover states
    },
    secondary: {
      main: '#dc004e',
    },
    error: {
      main: '#ff1744',
      light: '#ffe6e9', // Used for hover states
    },
    grey: {
      100: '#f8f9fa', // Used for background colors
      200: '#eee', // Used for borders
      600: '#666666', // Used for text
      800: '#000000', // Used for primary text
    },
    common: {
      white: '#ffffff',
    },
    text: {
      primary: '#000000',
      secondary: '#6c757d',
    },
    background: {
      default: '#f2f2f2',
      paper: '#ffffff',
    },
    divider: 'rgba(0, 0, 0, 0.12)', // Default divider color
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
    h4: {
      fontWeight: 700,
      fontSize: '1.5rem',
    },
    h5: {
      fontWeight: 700,
      fontSize: '1.25rem',
    },
    h6: {
      fontWeight: 700,
      fontSize: '0.875rem',
    },
    subtitle1: {
      fontWeight: 600,
      fontSize: '1rem',
    },
    body1: {
      fontSize: '1rem',
    },
    body2: {
      fontSize: '0.875rem',
    },
    // ...other typography settings
  },
  shape: {
    borderRadius: 4, // Global Border Radius
    modalBorderRadius: 12, // Custom border radius for modals
    cardBorderRadius: 8, // Custom border radius for cards
    imageContainerRadius: 16, // Custom border radius for image containers
    thumbnailRadius: 4, // Custom border radius for thumbnails
    infoBoxRadius: 8, // Shared border radius for info boxes
  },
  spacing: 8, // Default spacing unit (can be used as theme.spacing(n))
  shadows: {
    // Overriding default shadows if necessary
    1: '0px 1px 3px rgba(0,0,0,0.2)',
    2: '0px 3px 6px rgba(0,0,0,0.15)',
    3: '0px 4px 20px rgba(0, 0, 0, 0.1)', // Used for modals
    // ...other shadow levels
  },
  // ...other theme settings
});

export default theme;
