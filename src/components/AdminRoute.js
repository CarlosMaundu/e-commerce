// src/components/AdminRoute.js
import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

/**
 * AdminRoute ensures the user is logged in AND has role=admin.
 * This is nested under PrivateRoute in the routes, so it doesn't
 * re-check authentication redundantly.
 */
const AdminRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <div>Loading...</div>;

  // if user.role is 'admin', allow; otherwise redirect
  if (!user || user.role !== 'admin') {
    return <Navigate to="/" />;
  }
  return children;
};

export default AdminRoute;
