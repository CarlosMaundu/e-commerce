// src/context/AuthContext.js

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
  const [loading, setLoading] = useState(true); // Loading is true initially

  // Fetch user profile on accessToken update
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
      } else {
        setUser(null); // No accessToken, set user to null
      }
      setLoading(false); // Set loading to false after attempt
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

  // Update user data after profile changes
  const updateUser = (userData) => {
    setUser(userData);
  };

  const value = {
    user,
    accessToken,
    refreshTokenState,
    loading, // Expose loading state
    handleLogin,
    handleLogout,
    updateUser, // Expose updateUser method
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
