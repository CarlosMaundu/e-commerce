// src/App.js
import React, { useContext } from 'react';
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import theme from './styles/theme';
import store, { persistor } from './redux/store';
import { AuthContext, AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './notification/NotificationProvider';
import ScrollToTop from './components/ScrollToTop';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import { isStaff } from './auth/permissions';

import StorefrontLayout from './layouts/StorefrontLayout';
import AdminLayout, { adminNav } from './layouts/AdminLayout';

import HomePage from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import CartPage from './pages/CartPage';
import WishlistPage from './pages/WishlistPage';
import CheckoutPage from './pages/CheckoutPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ResetPassword from './components/password/ResetPassword';
import InformationPage from './pages/InformationPage';
import NotFoundPage from './pages/NotFoundPage';

import AccountOverviewPage from './pages/account/AccountOverviewPage';
import {
  AddressesPage,
  ProfilePage,
  SecurityPage,
} from './pages/account/AccountSettingsPages';
import {
  OrderDetailPage,
  OrdersPage,
  ReturnsPage,
} from './pages/account/OrderPages';

import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import {
  AdminOrderDetailPage,
  AdminOrdersPage,
  AdminReturnsPage,
} from './pages/admin/AdminOrderPages';
import AdminRolesPage from './pages/admin/AdminRolesPage';
import ProductsSection from './components/profile/ProductsSection';
import UsersSection from './components/profile/users/UsersSection';

const ORDERS_VIEW = ['orders.orders.view'];
const USERS_VIEW = ['admin.users.view'];

/** /admin lands on the dashboard, or the first screen the user may open. */
const AdminHome = () => {
  const { user } = useContext(AuthContext);
  const first = adminNav(user)[0]?.items[0];
  if (first?.to === '/admin') return <AdminDashboardPage />;
  return first ? (
    <Navigate to={first.to} replace />
  ) : (
    <Navigate to="/" replace />
  );
};

/** Old /profile?section=… links go to their new homes. */
const LegacyProfileRedirect = () => {
  const { user } = useContext(AuthContext);
  const section = new URLSearchParams(useLocation().search).get('section');
  const map = {
    users: '/admin/users',
    products: '/admin/products',
    reports: '/admin',
    orders: '/account/orders',
    profile: '/account/profile',
  };
  const target =
    map[section] ||
    (section === 'dashboard' && isStaff(user) ? '/admin' : '/account');
  return <Navigate to={target} replace />;
};

const Private = ({ children }) => <PrivateRoute>{children}</PrivateRoute>;

const App = () => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <NotificationProvider>
          <AuthProvider>
            <Router>
              <ScrollToTop />
              <Routes>
                <Route element={<StorefrontLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/products" element={<ProductsPage />} />
                  <Route
                    path="/products/:id"
                    element={<ProductDetailsPage />}
                  />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/wishlist" element={<WishlistPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<SignupPage />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route
                    path="/information/:slug"
                    element={<InformationPage />}
                  />
                  <Route
                    path="/checkout"
                    element={
                      <Private>
                        <CheckoutPage />
                      </Private>
                    }
                  />

                  <Route
                    path="/account"
                    element={
                      <Private>
                        <AccountOverviewPage />
                      </Private>
                    }
                  />
                  <Route
                    path="/account/profile"
                    element={
                      <Private>
                        <ProfilePage />
                      </Private>
                    }
                  />
                  <Route
                    path="/account/security"
                    element={
                      <Private>
                        <SecurityPage />
                      </Private>
                    }
                  />
                  <Route
                    path="/account/addresses"
                    element={
                      <Private>
                        <AddressesPage />
                      </Private>
                    }
                  />
                  <Route
                    path="/account/orders"
                    element={
                      <Private>
                        <OrdersPage />
                      </Private>
                    }
                  />
                  <Route
                    path="/account/orders/:id"
                    element={
                      <Private>
                        <OrderDetailPage />
                      </Private>
                    }
                  />
                  <Route
                    path="/account/returns"
                    element={
                      <Private>
                        <ReturnsPage />
                      </Private>
                    }
                  />

                  <Route path="*" element={<NotFoundPage />} />
                </Route>

                <Route
                  path="/admin"
                  element={
                    <Private>
                      <AdminRoute>
                        <AdminLayout />
                      </AdminRoute>
                    </Private>
                  }
                >
                  <Route index element={<AdminHome />} />
                  <Route
                    path="orders"
                    element={
                      <AdminRoute permissions={ORDERS_VIEW}>
                        <AdminOrdersPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="orders/:id"
                    element={
                      <AdminRoute permissions={ORDERS_VIEW}>
                        <AdminOrderDetailPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="returns"
                    element={
                      <AdminRoute permissions={ORDERS_VIEW}>
                        <AdminReturnsPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="products"
                    element={
                      <AdminRoute prefix="catalog.">
                        <ProductsSection />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="users"
                    element={
                      <AdminRoute permissions={USERS_VIEW}>
                        <UsersSection />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="roles"
                    element={
                      <AdminRoute permissions={USERS_VIEW}>
                        <AdminRolesPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="dashboard"
                    element={<Navigate to="/admin" replace />}
                  />
                  <Route path="*" element={<Navigate to="/admin" replace />} />
                </Route>

                <Route
                  path="/profile"
                  element={
                    <Private>
                      <LegacyProfileRedirect />
                    </Private>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <Private>
                      <LegacyProfileRedirect />
                    </Private>
                  }
                />
              </Routes>
            </Router>
          </AuthProvider>
        </NotificationProvider>
      </PersistGate>
    </Provider>
  </ThemeProvider>
);

export default App;
