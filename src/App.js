// src/App.js
import React, { lazy, Suspense, useContext } from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
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
import { ScrollMemory, withPageTransitions } from './navigation';
import AppStatus from './components/AppStatus';
import PageSkeleton from './components/common/PageSkeleton';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import { canShop, isStaff } from './auth/permissions';

import StorefrontLayout from './layouts/StorefrontLayout';
import AdminLayout, { adminNav } from './layouts/AdminLayout';

import HomePage from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import CartPage from './pages/CartPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ResetPassword from './components/password/ResetPassword';
import NotFoundPage from './pages/NotFoundPage';

import AccountLayout from './layouts/AccountLayout';

import { StoreProvider } from './context/StoreContext';
import StaffNotice from './components/StaffNotice';

// Pages that aren't the first thing shoppers see load when first opened
// (each layout shows a skeleton meanwhile), keeping the first download small.
const lazyNamed = (load, name) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const MePage = lazy(() => import('./pages/MePage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const PolicyPage = lazy(() => import('./pages/PolicyPage'));
const CustomerRefundsPage = lazy(() => import('./pages/account/RefundsPage'));
const AdminNotificationsPage = lazy(
  () => import('./pages/admin/NotificationsPage')
);
const LegalPageEditor = lazyNamed(
  () => import('./pages/admin/LegalPages'),
  'LegalPageEditor'
);
const LegalPagesPage = lazyNamed(
  () => import('./pages/admin/LegalPages'),
  'LegalPagesPage'
);
const SupportInboxPage = lazyNamed(
  () => import('./pages/admin/SupportPages'),
  'SupportInboxPage'
);
const SupportTicketPage = lazyNamed(
  () => import('./pages/admin/SupportPages'),
  'SupportTicketPage'
);
const FaqAdminPage = lazy(() => import('./pages/admin/FaqAdminPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const SupportRequestPage = lazyNamed(
  () => import('./pages/account/SupportPages'),
  'SupportRequestPage'
);
const SupportRequestsPage = lazyNamed(
  () => import('./pages/account/SupportPages'),
  'SupportRequestsPage'
);
const SlaReportPage = lazy(() => import('./pages/admin/reports/SlaReportPage'));
const ReportPage = lazy(() => import('./pages/admin/reports/ReportPage'));
const SlaOrderPage = lazy(() => import('./pages/admin/reports/SlaOrderPage'));
const InformationPage = lazy(() => import('./pages/InformationPage'));
const AccountOverviewPage = lazy(
  () => import('./pages/account/AccountOverviewPage')
);
const InvoicePage = lazyNamed(
  () => import('./pages/account/AccountExtraPages'),
  'InvoicePage'
);
const InvoicesPage = lazyNamed(
  () => import('./pages/account/AccountExtraPages'),
  'InvoicesPage'
);
const TrackOrderPage = lazyNamed(
  () => import('./pages/account/AccountExtraPages'),
  'TrackOrderPage'
);
const AccountWishlistPage = lazyNamed(
  () => import('./pages/WishlistPage'),
  'AccountWishlistPage'
);
const AddressesPage = lazyNamed(
  () => import('./pages/account/AccountSettingsPages'),
  'AddressesPage'
);
const ProfilePage = lazyNamed(
  () => import('./pages/account/AccountSettingsPages'),
  'ProfilePage'
);
const SecurityPage = lazyNamed(
  () => import('./pages/account/AccountSettingsPages'),
  'SecurityPage'
);
const OrderDetailPage = lazyNamed(
  () => import('./pages/account/OrderPages'),
  'OrderDetailPage'
);
const OrdersPage = lazyNamed(
  () => import('./pages/account/OrderPages'),
  'OrdersPage'
);
const ReturnPage = lazyNamed(
  () => import('./pages/account/OrderPages'),
  'ReturnPage'
);
const ReturnsPage = lazyNamed(
  () => import('./pages/account/OrderPages'),
  'ReturnsPage'
);
const AdminReturnDetail = lazy(
  () => import('./pages/admin/orders/AdminReturnDetail')
);
const PromoCodePage = lazyNamed(
  () => import('./pages/admin/PromoPages'),
  'PromoCodePage'
);
const PromoCodesPage = lazyNamed(
  () => import('./pages/admin/PromoPages'),
  'PromoCodesPage'
);
const PaymentMethodsPage = lazy(
  () => import('./pages/admin/PaymentMethodsPage')
);
const CostPricesPage = lazy(
  () => import('./pages/admin/products/CostPricesPage')
);
const AdminDashboardPage = lazy(
  () => import('./pages/admin/AdminDashboardPage')
);
const AdminOrderDetailPage = lazyNamed(
  () => import('./pages/admin/AdminOrderPages'),
  'AdminOrderDetailPage'
);
const AdminOrdersPage = lazyNamed(
  () => import('./pages/admin/AdminOrderPages'),
  'AdminOrdersPage'
);
const AdminReturnsPage = lazyNamed(
  () => import('./pages/admin/AdminOrderPages'),
  'AdminReturnsPage'
);
const AdminRolesPage = lazy(() => import('./pages/admin/AdminRolesPage'));
const UsersSection = lazy(
  () => import('./components/profile/users/UsersSection')
);
const ProductListPage = lazy(
  () => import('./pages/admin/products/ProductListPage')
);
const ProductFormPage = lazy(
  () => import('./pages/admin/products/ProductFormPage')
);
const BrandsPage = lazy(() => import('./pages/admin/products/BrandsPage'));
const CategoriesPage = lazy(
  () => import('./pages/admin/products/CategoriesPage')
);
const StaffProfilePage = lazy(() => import('./pages/admin/StaffProfilePage'));
const SecuritySettingsPage = lazy(
  () => import('./pages/admin/SecuritySettingsPage')
);
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'));
const StoreSettingsPage = lazy(() => import('./pages/admin/StoreSettingsPage'));
const FinanceSettingsPage = lazy(
  () => import('./pages/admin/FinanceSettingsPage')
);
const DeliverySettingsPage = lazy(
  () => import('./pages/admin/DeliverySettingsPage')
);
const ComingSoonPage = lazy(() => import('./pages/admin/ComingSoonPage'));
const CreateOrderPage = lazy(
  () => import('./pages/admin/orders/CreateOrderPage')
);
const InvoiceDetailPage = lazyNamed(
  () => import('./pages/admin/finance/FinancePages'),
  'InvoiceDetailPage'
);
const AdminInvoicesPage = lazyNamed(
  () => import('./pages/admin/finance/FinancePages'),
  'InvoicesPage'
);
const LedgerPage = lazyNamed(
  () => import('./pages/admin/finance/FinancePages'),
  'LedgerPage'
);
const PaymentsPage = lazyNamed(
  () => import('./pages/admin/finance/FinancePages'),
  'PaymentsPage'
);
const RefundSettingsPage = lazyNamed(
  () => import('./pages/admin/finance/FinancePages'),
  'RefundSettingsPage'
);
const RefundsPage = lazyNamed(
  () => import('./pages/admin/finance/FinancePages'),
  'RefundsPage'
);
const UserAccountPage = lazy(() => import('./pages/admin/UserAccountPage'));

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

/** Every page: scroll memory, then the page (its skeleton while it loads). */
const Frame = () => (
  <>
    <ScrollMemory />
    <AppStatus />
    <Suspense fallback={<PageSkeleton />}>
      <Outlet />
    </Suspense>
  </>
);

const router = withPageTransitions(
  createBrowserRouter(
    createRoutesFromElements(
      <Route element={<Frame />}>
        <Route element={<StorefrontLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/me" element={<MePage />} />
          <Route path="/products/:id" element={<ProductDetailsPage />} />
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
          <Route path="/support" element={<SupportPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route
            path="/information/support"
            element={<Navigate to="/support" replace />}
          />
          <Route
            path="/information/faq"
            element={<Navigate to="/faq" replace />}
          />
          <Route
            path="/information/about"
            element={<Navigate to="/about" replace />}
          />
          <Route
            path="/information/terms"
            element={<Navigate to="/policies/terms" replace />}
          />
          <Route
            path="/information/privacy"
            element={<Navigate to="/policies/privacy" replace />}
          />
          <Route path="/information/:slug" element={<InformationPage />} />
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
            <Route path="returns/:id" element={<ReturnPage />} />
            <Route path="refunds" element={<CustomerRefundsPage />} />
            <Route path="support" element={<SupportRequestsPage />} />
            <Route path="support/:number" element={<SupportRequestPage />} />
            <Route path="wishlist" element={<AccountWishlistPage />} />
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
            path="returns/:id"
            element={
              <AdminRoute permissions={['orders.returns.view']}>
                <AdminReturnDetail />
              </AdminRoute>
            }
          />
          <Route
            path="payment-methods"
            element={
              <AdminRoute permissions={['admin.payments.manage']}>
                <PaymentMethodsPage />
              </AdminRoute>
            }
          />
          <Route
            path="promos"
            element={
              <AdminRoute permissions={['marketing.promos.view']}>
                <PromoCodesPage />
              </AdminRoute>
            }
          />
          <Route
            path="promos/:code"
            element={
              <AdminRoute permissions={['marketing.promos.view']}>
                <PromoCodePage />
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
            path="products/costs"
            element={
              <AdminRoute permissions={['catalog.products.update']}>
                <CostPricesPage />
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
          <Route path="notifications" element={<AdminNotificationsPage />} />
          <Route
            path="support"
            element={
              <AdminRoute permissions={['support.tickets.view']}>
                <SupportInboxPage />
              </AdminRoute>
            }
          />
          <Route
            path="support/:id"
            element={
              <AdminRoute permissions={['support.tickets.view']}>
                <SupportTicketPage />
              </AdminRoute>
            }
          />
          <Route
            path="faq"
            element={
              <AdminRoute permissions={['admin.settings.manage']}>
                <FaqAdminPage />
              </AdminRoute>
            }
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
            path="reports/:name"
            element={
              <AdminRoute
                permissions={['reports.view', 'reports.finance.view']}
              >
                <ReportPage />
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
          <Route path="dashboard" element={<Navigate to="/admin" replace />} />
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
      </Route>
    )
  )
);

const App = () => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <NotificationProvider>
          <AuthProvider>
            <StoreProvider>
              <RouterProvider router={router} />
            </StoreProvider>
          </AuthProvider>
        </NotificationProvider>
      </PersistGate>
    </Provider>
  </ThemeProvider>
);

export default App;
