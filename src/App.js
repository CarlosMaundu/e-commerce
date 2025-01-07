import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import Header from './components/layout/Header';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import CartPage from './pages/CartPage';
import WishlistPage from './pages/WishlistPage';
import ProfilePage from './pages/ProfilePage';
import PrivateRoute from './components/PrivateRoute';
import Footer from './components/layout/Footer';
import CheckoutPage from './pages/CheckoutPage';

import { Provider } from 'react-redux';
import store, { persistor } from './redux/store';
import { PersistGate } from 'redux-persist/integration/react';

import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './styles/theme';

// 1. Define a small wrapper to conditionally render the Header
const ConditionalHeader = () => {
  const location = useLocation();
  // list or logic to hide on specific paths
  const hideOnPaths = ['/profile', '/dashboard'];

  // check if the current path starts with or matches any of these
  const shouldHideHeader = hideOnPaths.some((path) =>
    location.pathname.startsWith(path)
  );

  if (shouldHideHeader) {
    return null;
  }
  return <Header />;
};

// 2. (Optional) Hide the footer on certain paths too
const HideFooterOnPaths = () => {
  const location = useLocation();
  const hideOnPaths = ['/profile', '/dashboard'];
  const shouldHideFooter = hideOnPaths.some((path) =>
    location.pathname.startsWith(path)
  );

  if (shouldHideFooter) {
    return null; // do not render Footer
  }
  return <Footer />;
};

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <Router>
              <ScrollToTop />

              {/* Conditionally hide the header */}
              <ConditionalHeader />

              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<LoginPage />} />

                <Route path="/" element={<HomePage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/products/:id" element={<ProductDetailsPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/wishlist" element={<WishlistPage />} />

                <Route
                  path="/profile"
                  element={
                    <PrivateRoute>
                      <ProfilePage />
                    </PrivateRoute>
                  }
                />

                <Route
                  path="/checkout"
                  element={
                    <PrivateRoute>
                      <CheckoutPage />
                    </PrivateRoute>
                  }
                />
              </Routes>

              {/* Optionally hide the footer */}
              <HideFooterOnPaths />
            </Router>
          </PersistGate>
        </Provider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
