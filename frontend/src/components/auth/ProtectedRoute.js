import React from 'react';
import { Navigate } from 'react-router-dom';
import { isTokenExpired, clearAuth } from '../../utils/tokenUtils';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');

  if (!token || isTokenExpired(token)) {
    // No token or expired — clear any stale data and redirect to home
    clearAuth();
    return <Navigate to="/" replace />;
  }

  // Valid token — render the protected component
  return children;
};

export default ProtectedRoute; 