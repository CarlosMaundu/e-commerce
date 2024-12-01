//src/context/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { fetchUserProfile, refreshToken } from '../services/authService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem('accessToken')
  );
  const [refreshTokenState, setRefreshTokenState] = useState(
    localStorage.getItem('refreshToken')
  );

  // Fetch user profile on token update
  useEffect(() => {
    const fetchProfile = async () => {
      if (accessToken) {
        try {
          const userProfile = await fetchUserProfile(accessToken);
          setUser(userProfile);
        } catch (error) {
          console.error('Failed to fetch user profile:', error.message);
          handleLogout(); // Clear tokens if profile fetch fails
        }
      }
    };

    fetchProfile();
  }, [accessToken]);

  // Refresh token periodically (every 15 minutes)
  useEffect(() => {
    const interval = setInterval(
      async () => {
        if (refreshTokenState) {
          try {
            const tokens = await refreshToken(refreshTokenState);
            setAccessToken(tokens.access_token);
            setRefreshTokenState(tokens.refresh_token);
            localStorage.setItem('accessToken', tokens.access_token);
            localStorage.setItem('refreshToken', tokens.refresh_token);
          } catch (error) {
            console.error('Failed to refresh token:', error.message);
            handleLogout(); // Clear tokens if refresh fails
          }
        }
      },
      15 * 60 * 1000
    );

    return () => clearInterval(interval);
  }, [refreshTokenState]);

  // Handle login
  const handleLogin = async (tokens) => {
    try {
      setAccessToken(tokens.access_token);
      setRefreshTokenState(tokens.refresh_token);
      localStorage.setItem('accessToken', tokens.access_token);
      localStorage.setItem('refreshToken', tokens.refresh_token);
    } catch (error) {
      console.error('Error during login:', error.message);
      throw error;
    }
  };

  // Handle logout
  const handleLogout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshTokenState(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    console.log('User logged out');
  };

  const value = {
    user,
    accessToken,
    refreshTokenState,
    handleLogin,
    handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
