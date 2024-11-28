import React, { createContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  fetchUserDetails,
  refreshToken as refreshAuthToken,
} from '../services/authService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem('accessToken')
  );
  const [refreshToken, setRefreshToken] = useState(
    localStorage.getItem('refreshToken')
  );

  useEffect(() => {
    const fetchUser = async () => {
      if (accessToken) {
        try {
          const userDetails = await fetchUserDetails(accessToken);
          setUser(userDetails);
        } catch (error) {
          console.error('Failed to fetch user details:', error);
        }
      }
    };

    fetchUser();
  }, [accessToken]);

  useEffect(() => {
    const interval = setInterval(
      async () => {
        if (refreshToken) {
          try {
            const newTokens = await refreshAuthToken(refreshToken);
            setAccessToken(newTokens.accessToken);
            setRefreshToken(newTokens.refreshToken);
            localStorage.setItem('accessToken', newTokens.accessToken);
            localStorage.setItem('refreshToken', newTokens.refreshToken);
          } catch (error) {
            console.error('Failed to refresh token:', error);
            handleLogout();
          }
        }
      },
      15 * 60 * 1000
    );

    return () => clearInterval(interval);
  }, [refreshToken]);

  const handleLogin = (userData) => {
    setAccessToken(userData.accessToken);
    setRefreshToken(userData.refreshToken);
    localStorage.setItem('accessToken', userData.accessToken);
    localStorage.setItem('refreshToken', userData.refreshToken);
  };

  const handleLogout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  };

  const value = {
    user,
    accessToken,
    refreshToken,
    handleLogin,
    handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
