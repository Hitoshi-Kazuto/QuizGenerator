import React from 'react';
import { Navigate } from 'react-router-dom';
import { isTokenExpired, clearAuth } from '../../utils/tokenUtils';

const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const userType = localStorage.getItem('userType');

  if (token) {
    if (isTokenExpired(token)) {
      // Token exists but is expired — clear it and allow access to login/register
      clearAuth();
      return children;
    }
    // Valid token — redirect to appropriate dashboard
    return <Navigate to={userType === 'teacher' ? '/teacher' : '/student'} replace />;
  }

  // No token — render the public component (login/register)
  return children;
};

export default PublicRoute; 