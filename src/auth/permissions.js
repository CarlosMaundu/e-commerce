// src/auth/permissions.js
//
// Permission checks ported from the Project Management portal
// (frontend/src/lib/permissions.ts). Codes use one format:
// module.resource.action, e.g. catalog.products.update. "*" grants all.
// The backend enforces these too; the UI only uses them to show/hide things.

const normalize = (permission) => (permission || '').toLowerCase();

const list = (user) => (user?.permissions || []).map(normalize);

export const hasPermission = (user, required) => {
  const granted = list(user);
  return granted.includes('*') || granted.includes(normalize(required));
};

export const hasAnyPermission = (user, required = []) =>
  required.some((permission) => hasPermission(user, permission));

export const hasPermissionPrefix = (user, prefix) => {
  const granted = list(user);
  return (
    granted.includes('*') ||
    granted.some((permission) => permission.startsWith(normalize(prefix)))
  );
};

/** Staff = anyone with at least one admin-area permission. */
export const isStaff = (user) => list(user).length > 0;

/**
 * Only customers shop. Staff acting as a customer have the customer's
 * (empty) permissions, so they can shop for them.
 */
export const canShop = (user) => !isStaff(user);

export const PERMISSIONS = {
  productsCreate: 'catalog.products.create',
  productsUpdate: 'catalog.products.update',
  productsDelete: 'catalog.products.delete',
  categoriesCreate: 'catalog.categories.create',
  usersView: 'admin.users.view',
  usersCreate: 'admin.users.create',
  usersUpdate: 'admin.users.update',
  usersResetPassword: 'admin.users.reset_password',
  usersImpersonate: 'admin.users.impersonate',
  usersSuspend: 'admin.users.suspend',
  usersUnlock: 'admin.users.unlock',
  usersSignout: 'admin.users.signout',
  rolesView: 'admin.roles.view',
  rolesManage: 'admin.roles.manage',
  securityView: 'admin.security.view',
  securityManage: 'admin.security.manage',
  settingsManage: 'admin.settings.manage',
  financeManage: 'admin.finance.manage',
  dashboardView: 'dashboard.overview.view',
  ordersView: 'orders.orders.view',
  ordersUpdate: 'orders.orders.update',
  ordersRefund: 'orders.orders.refund',
  returnsView: 'orders.returns.view',
  returnsUpdate: 'orders.returns.update',
  auditView: 'admin.audit.view',
};

const ROLE_LABELS = {
  super_admin: 'Super admin',
  admin: 'Admin',
  catalog_manager: 'Catalog manager',
  order_manager: 'Order manager',
  support: 'Support',
  customer: 'Customer',
};

export const roleLabel = (role) =>
  ROLE_LABELS[role] ||
  (role
    ? role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ')
    : 'Customer');
