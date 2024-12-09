// src/components/AdminRoute.js

import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const AdminRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  const isAdmin = user && user.role === 'admin';

  if (!isAdmin) {
    // Redirect to home page if not admin
    return <Navigate to="/" />;
  }

  return children;
};

export default AdminRoute;
