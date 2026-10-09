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
import VerifyEmailPage from './pages/VerifyEmailPage';
import PolicyPage from './pages/PolicyPage';
import CustomerRefundsPage from './pages/account/RefundsPage';
import AdminNotificationsPage from './pages/admin/NotificationsPage';
import { LegalPageEditor, LegalPagesPage } from './pages/admin/LegalPages';
import SlaReportPage from './pages/admin/reports/SlaReportPage';
import SlaOrderPage from './pages/admin/reports/SlaOrderPage';
import InformationPage from './pages/InformationPage';
import NotFoundPage from './pages/NotFoundPage';

import AccountOverviewPage from './pages/account/AccountOverviewPage';
import AccountLayout from './layouts/AccountLayout';
import {
  InvoicePage,
  InvoicesPage,
  TrackOrderPage,
} from './pages/account/AccountExtraPages';
import { AccountWishlistPage } from './pages/WishlistPage';
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
import ProductListPage from './pages/admin/products/ProductListPage';
import ProductFormPage from './pages/admin/products/ProductFormPage';
import BrandsPage from './pages/admin/products/BrandsPage';
import CategoriesPage from './pages/admin/products/CategoriesPage';
import StaffProfilePage from './pages/admin/StaffProfilePage';
import SecuritySettingsPage from './pages/admin/SecuritySettingsPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import StoreSettingsPage from './pages/admin/StoreSettingsPage';
import FinanceSettingsPage from './pages/admin/FinanceSettingsPage';
import DeliverySettingsPage from './pages/admin/DeliverySettingsPage';
import ComingSoonPage from './pages/admin/ComingSoonPage';
import CreateOrderPage from './pages/admin/orders/CreateOrderPage';
import {
  InvoiceDetailPage,
  InvoicesPage as AdminInvoicesPage,
  LedgerPage,
  PaymentsPage,
  RefundSettingsPage,
  RefundsPage,
} from './pages/admin/finance/FinancePages';
import { StoreProvider } from './context/StoreContext';
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
            <StoreProvider>
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
                    <Route path="/verify-email" element={<VerifyEmailPage />} />
                    <Route path="/policies/:slug" element={<PolicyPage />} />
                    <Route
                      path="/information/terms"
                      element={<Navigate to="/policies/terms" replace />}
                    />
                    <Route
                      path="/information/privacy"
                      element={<Navigate to="/policies/privacy" replace />}
                    />
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
                          <AccountLayout />
                        </Account>
                      }
                    >
                      <Route index element={<AccountOverviewPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="security" element={<SecurityPage />} />
                      <Route path="addresses" element={<AddressesPage />} />
                      <Route path="orders" element={<OrdersPage />} />
                      <Route path="orders/:id" element={<OrderDetailPage />} />
                      <Route path="track" element={<TrackOrderPage />} />
                      <Route path="invoices" element={<InvoicesPage />} />
                      <Route path="invoices/:id" element={<InvoicePage />} />
                      <Route path="returns" element={<ReturnsPage />} />
                      <Route path="refunds" element={<CustomerRefundsPage />} />
                      <Route
                        path="wishlist"
                        element={<AccountWishlistPage />}
                      />
                    </Route>

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
                        <AdminRoute permissions={['catalog.products.view']}>
                          <ProductListPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="products/new"
                      element={
                        <AdminRoute permissions={['catalog.products.create']}>
                          <ProductFormPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="products/:id"
                      element={
                        <AdminRoute permissions={['catalog.products.view']}>
                          <ProductFormPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="categories"
                      element={
                        <AdminRoute prefix="catalog.categories.">
                          <CategoriesPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="brands"
                      element={
                        <AdminRoute prefix="catalog.brands.">
                          <BrandsPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="products/categories"
                      element={<Navigate to="/admin/categories" replace />}
                    />
                    <Route
                      path="products/brands"
                      element={<Navigate to="/admin/brands" replace />}
                    />
                    <Route path="profile" element={<StaffProfilePage />} />
                    <Route
                      path="security"
                      element={
                        <AdminRoute permissions={['admin.security.view']}>
                          <SecuritySettingsPage />
                        </AdminRoute>
                      }
                    />
                    <Route path="soon/:feature" element={<ComingSoonPage />} />
                    <Route
                      path="orders/new"
                      element={
                        <AdminRoute permissions={['orders.orders.create']}>
                          <CreateOrderPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="invoices"
                      element={
                        <AdminRoute permissions={['orders.invoices.view']}>
                          <AdminInvoicesPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="invoices/:id"
                      element={
                        <AdminRoute permissions={['orders.invoices.view']}>
                          <InvoiceDetailPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="payments"
                      element={
                        <AdminRoute permissions={['orders.invoices.view']}>
                          <PaymentsPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="refunds"
                      element={
                        <AdminRoute permissions={['orders.invoices.view']}>
                          <RefundsPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="refund-settings"
                      element={
                        <AdminRoute permissions={['admin.refunds.manage']}>
                          <RefundSettingsPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="ledger"
                      element={
                        <AdminRoute permissions={['admin.ledger.view']}>
                          <LedgerPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="delivery"
                      element={
                        <AdminRoute permissions={['admin.delivery.manage']}>
                          <DeliverySettingsPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="finance"
                      element={
                        <AdminRoute permissions={['admin.finance.manage']}>
                          <FinanceSettingsPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="settings"
                      element={
                        <AdminRoute permissions={['admin.settings.manage']}>
                          <StoreSettingsPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="notifications"
                      element={<AdminNotificationsPage />}
                    />
                    <Route
                      path="legal"
                      element={
                        <AdminRoute permissions={['admin.settings.manage']}>
                          <LegalPagesPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="legal/:slug"
                      element={
                        <AdminRoute permissions={['admin.settings.manage']}>
                          <LegalPageEditor />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="reports/sla"
                      element={
                        <AdminRoute permissions={['orders.orders.view']}>
                          <SlaReportPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="reports/sla/:id"
                      element={
                        <AdminRoute permissions={['orders.orders.view']}>
                          <SlaOrderPage />
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
                    <Route
                      path="*"
                      element={<Navigate to="/admin" replace />}
                    />
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
            </StoreProvider>
          </AuthProvider>
        </NotificationProvider>
      </PersistGate>
    </Provider>
  </ThemeProvider>
);

export default App;
