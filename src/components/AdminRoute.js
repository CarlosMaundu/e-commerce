// src/components/AdminRoute.js
import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import PageSkeleton from './common/PageSkeleton';
import {
  hasAnyPermission,
  hasPermissionPrefix,
  isStaff,
} from '../auth/permissions';

/**
 * Guards admin routes by permission (like the portal's ProtectedRoute).
 *   <AdminRoute permissions={['admin.users.view']}>   any of these
 *   <AdminRoute prefix="catalog.">                    any catalog permission
 *   <AdminRoute>                                      any staff permission
 * Nested under PrivateRoute, so the user is already signed in.
 */
const AdminRoute = ({ children, permissions, prefix }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <PageSkeleton variant="admin" />;

  const allowed = permissions
    ? hasAnyPermission(user, permissions)
    : prefix
      ? hasPermissionPrefix(user, prefix)
      : isStaff(user);

  if (!user || !allowed) {
    return <Navigate to="/" replace />;
  }
  return children;
};

AdminRoute.propTypes = {
  children: PropTypes.node.isRequired,
  permissions: PropTypes.arrayOf(PropTypes.string),
  prefix: PropTypes.string,
};

export default AdminRoute;
