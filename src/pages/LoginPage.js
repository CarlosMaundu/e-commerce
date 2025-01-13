// src/pages/LoginPage.js
import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Button,
  Grid,
  Typography,
  Box,
  TextField,
  InputAdornment,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { Google, Lock, AccountCircle } from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';

import Notification from '../notification/notification';

const LoginPage = () => {
  const {
    signInWithGoogle,
    signInWithPassword,
    sendSignInLink,
    resetPassword,
  } = useContext(AuthContext);

  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  // UI toggles
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [showEmailLink, setShowEmailLink] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    severity: '',
    message: '',
  });

  /**
   * 1) Google sign-in
   */
  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      setNotification({
        open: true,
        severity: 'success',
        message: 'Logged in with Google successfully!',
      });
      navigate(from, { replace: true });
    } catch (err) {
      setNotification({
        open: true,
        severity: 'error',
        message: err.message || 'Google login failed.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 2) Email Link form submission
   */
  const [emailForLink, setEmailForLink] = useState('');
  const handleEmailLinkSubmit = async (e) => {
    e.preventDefault();
    if (!emailForLink) return;
    setIsSubmitting(true);
    try {
      await sendSignInLink(emailForLink);
      setNotification({
        open: true,
        severity: 'info',
        message: `We sent a link to ${emailForLink}. Check your inbox to complete sign-in.`,
      });
      setEmailForLink('');
      setShowEmailLink(false);
    } catch (error) {
      setNotification({
        open: true,
        severity: 'error',
        message: error.message || 'Could not send sign-in link.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 3) Email & Password form with Formik
   */
  const loginFormik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema: Yup.object({
      email: Yup.string().email('Invalid email').required('Email is required'),
      password: Yup.string().required('Password is required'),
    }),
    onSubmit: async (values) => {
      setIsSubmitting(true);
      try {
        await signInWithPassword(values.email, values.password);
        setNotification({
          open: true,
          severity: 'success',
          message: 'Logged in successfully!',
        });
        navigate(from, { replace: true });
      } catch (error) {
        setNotification({
          open: true,
          severity: 'error',
          message: error.message || 'Login failed.',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  /**
   * 4) Forgot Password
   */
  const [forgotEmail, setForgotEmail] = useState('');
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setIsSubmitting(true);
    try {
      await resetPassword(forgotEmail);
      setNotification({
        open: true,
        severity: 'info',
        message: `Password reset email sent to ${forgotEmail}. Check your inbox.`,
      });
      setForgotEmail('');
      setShowForgotPassword(false);
    } catch (error) {
      setNotification({
        open: true,
        severity: 'error',
        message: error.message || 'Could not send password reset email.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Box
        sx={{
          width: { xs: '90%', sm: '400px' },
          p: 3,
          backgroundColor: '#fff',
          borderRadius: 2,
          boxShadow: 2,
        }}
      >
        <Typography
          variant="h5"
          sx={{ mb: 3, textAlign: 'center', fontWeight: 'bold' }}
        >
          Login
        </Typography>

        {/* Row of sign-in options */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12}>
            {/* White background for Google button */}
            <Button
              variant="contained"
              fullWidth
              disabled={isSubmitting}
              onClick={handleGoogleLogin}
              startIcon={<Google />}
              sx={{
                textTransform: 'none',
                backgroundColor: '#ffffff',
                color: '#000',
                border: '1px solid #ddd',
                '&:hover': {
                  backgroundColor: '#f7f7f7',
                },
              }}
            >
              {isSubmitting ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Sign in with Google'
              )}
            </Button>
          </Grid>

          <Grid item xs={12}>
            {/* MUI default (blue) for Email & Password */}
            <Button
              variant="contained"
              color="primary"
              fullWidth
              disabled={isSubmitting}
              onClick={() => {
                setShowEmailPassword((prev) => !prev);
                setShowEmailLink(false);
                setShowForgotPassword(false);
              }}
              sx={{ textTransform: 'none' }}
            >
              Sign in with Email & Password
            </Button>
          </Grid>

          <Grid item xs={12}>
            <Button
              variant="outlined"
              color="primary"
              fullWidth
              disabled={isSubmitting}
              onClick={() => {
                setShowEmailLink((prev) => !prev);
                setShowEmailPassword(false);
                setShowForgotPassword(false);
              }}
              sx={{ textTransform: 'none' }}
            >
              Sign in with Email Link
            </Button>
          </Grid>
        </Grid>

        {/* Forgot Password link - triggers the Forgot Password form */}
        {!showForgotPassword && (
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Button
              variant="text"
              color="secondary"
              onClick={() => {
                setShowForgotPassword(true);
                setShowEmailPassword(false);
                setShowEmailLink(false);
              }}
              sx={{ textTransform: 'none', fontSize: '0.8rem' }}
            >
              Forgot Password?
            </Button>
          </Box>
        )}

        {/* 1) If user chooses Email+Password */}
        {showEmailPassword && (
          <Box sx={{ mb: 2 }}>
            <form onSubmit={loginFormik.handleSubmit}>
              <TextField
                label="Email"
                id="email"
                name="email"
                fullWidth
                variant="outlined"
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AccountCircle />
                    </InputAdornment>
                  ),
                }}
                value={loginFormik.values.email}
                onChange={loginFormik.handleChange}
                onBlur={loginFormik.handleBlur}
                error={
                  loginFormik.touched.email && Boolean(loginFormik.errors.email)
                }
                helperText={
                  loginFormik.touched.email && loginFormik.errors.email
                }
              />
              <TextField
                label="Password"
                id="password"
                name="password"
                type="password"
                fullWidth
                variant="outlined"
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock />
                    </InputAdornment>
                  ),
                }}
                value={loginFormik.values.password}
                onChange={loginFormik.handleChange}
                onBlur={loginFormik.handleBlur}
                error={
                  loginFormik.touched.password &&
                  Boolean(loginFormik.errors.password)
                }
                helperText={
                  loginFormik.touched.password && loginFormik.errors.password
                }
              />

              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={isSubmitting}
                sx={{ textTransform: 'none' }}
              >
                {isSubmitting ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </Box>
        )}

        {/* 2) If user chooses Email Link */}
        {showEmailLink && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Enter your email, we'll send you a login link:
            </Typography>
            <form onSubmit={handleEmailLinkSubmit}>
              <TextField
                type="email"
                value={emailForLink}
                onChange={(e) => setEmailForLink(e.target.value)}
                fullWidth
                variant="outlined"
                placeholder="Your email"
                sx={{ mb: 2 }}
              />
              <Button
                type="submit"
                variant="contained"
                color="success"
                fullWidth
                disabled={isSubmitting}
                sx={{ textTransform: 'none' }}
              >
                {isSubmitting ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Send Link'
                )}
              </Button>
            </form>
          </Box>
        )}

        {/* 3) Forgot Password Form */}
        {showForgotPassword && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Enter your email, we'll send you a password reset link:
            </Typography>
            <form onSubmit={handleForgotPassword}>
              <TextField
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                fullWidth
                variant="outlined"
                placeholder="Your email"
                sx={{ mb: 2 }}
              />
              <Button
                type="submit"
                variant="contained"
                color="secondary"
                fullWidth
                disabled={isSubmitting}
                sx={{ textTransform: 'none' }}
              >
                {isSubmitting ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Reset Password'
                )}
              </Button>
            </form>
          </Box>
        )}

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2">
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#007bff' }}>
              Sign Up
            </Link>
          </Typography>
        </Box>
      </Box>

      <Notification
        open={notification.open}
        onClose={() =>
          setNotification({ open: false, severity: '', message: '' })
        }
        severity={notification.severity}
        message={notification.message}
      />
    </Box>
  );
};

export default LoginPage;
