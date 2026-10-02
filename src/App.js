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
import { canShop, isStaff } from './auth/permissions';

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
import UsersSection from './components/profile/users/UsersSection';
import ProductsAdminLayout from './pages/admin/products/ProductsAdminLayout';
import ProductListPage from './pages/admin/products/ProductListPage';
import ProductFormPage from './pages/admin/products/ProductFormPage';
import BrandsPage from './pages/admin/products/BrandsPage';
import CategoriesPage from './pages/admin/products/CategoriesPage';
import StaffProfilePage from './pages/admin/StaffProfilePage';
import SecuritySettingsPage from './pages/admin/SecuritySettingsPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import UserAccountPage from './pages/admin/UserAccountPage';
import StaffNotice from './components/StaffNotice';

const ORDERS_VIEW = ['orders.orders.view'];
const USERS_VIEW = ['admin.users.view'];

/** /admin lands on the dashboard, or the first screen the user may open. */
const AdminHome = () => {
  const { user } = useContext(AuthContext);
  const first = adminNav(user)[0]?.items[0];
  if (first?.to === '/admin') return <AdminDashboardPage />;
  return <Navigate to={first ? first.to : '/admin/profile'} replace />;
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

/**
 * Shopping and the customer account are for customers. Back-office users
 * get their own profile (/admin/profile) and a note on shopping pages.
 */
const ShopperOnly = ({ children, account = false }) => {
  const { user } = useContext(AuthContext);
  if (user && !canShop(user)) {
    return account ? <Navigate to="/admin/profile" replace /> : <StaffNotice />;
  }
  return children;
};

const Account = ({ children }) => (
  <Private>
    <ShopperOnly account>{children}</ShopperOnly>
  </Private>
);

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
                  <Route
                    path="/cart"
                    element={
                      <ShopperOnly>
                        <CartPage />
                      </ShopperOnly>
                    }
                  />
                  <Route
                    path="/wishlist"
                    element={
                      <ShopperOnly>
                        <WishlistPage />
                      </ShopperOnly>
                    }
                  />
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
                        <ShopperOnly>
                          <CheckoutPage />
                        </ShopperOnly>
                      </Private>
                    }
                  />

                  <Route
                    path="/account"
                    element={
                      <Account>
                        <AccountOverviewPage />
                      </Account>
                    }
                  />
                  <Route
                    path="/account/profile"
                    element={
                      <Account>
                        <ProfilePage />
                      </Account>
                    }
                  />
                  <Route
                    path="/account/security"
                    element={
                      <Account>
                        <SecurityPage />
                      </Account>
                    }
                  />
                  <Route
                    path="/account/addresses"
                    element={
                      <Account>
                        <AddressesPage />
                      </Account>
                    }
                  />
                  <Route
                    path="/account/orders"
                    element={
                      <Account>
                        <OrdersPage />
                      </Account>
                    }
                  />
                  <Route
                    path="/account/orders/:id"
                    element={
                      <Account>
                        <OrderDetailPage />
                      </Account>
                    }
                  />
                  <Route
                    path="/account/returns"
                    element={
                      <Account>
                        <ReturnsPage />
                      </Account>
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
                      <AdminRoute permissions={['orders.returns.view']}>
                        <AdminReturnsPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="products"
                    element={
                      <AdminRoute prefix="catalog.">
                        <ProductsAdminLayout />
                      </AdminRoute>
                    }
                  >
                    <Route index element={<ProductListPage />} />
                    <Route path="new" element={<ProductFormPage />} />
                    <Route path="categories" element={<CategoriesPage />} />
                    <Route path="brands" element={<BrandsPage />} />
                    <Route path=":id" element={<ProductFormPage />} />
                  </Route>
                  <Route path="profile" element={<StaffProfilePage />} />
                  <Route
                    path="security"
                    element={
                      <AdminRoute permissions={['admin.security.view']}>
                        <SecuritySettingsPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="audit"
                    element={
                      <AdminRoute permissions={['admin.audit.view']}>
                        <AuditLogPage />
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
                    path="users/:id"
                    element={
                      <AdminRoute permissions={USERS_VIEW}>
                        <UserAccountPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="roles"
                    element={
                      <AdminRoute permissions={['admin.roles.view']}>
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
