// src/pages/WishlistPage.js
import React, { useContext, useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  Alert,
  Snackbar,
  Fade,
} from '@mui/material';
import { styled } from '@mui/system';
import { FcGoogle } from 'react-icons/fc';
import { MdEmail, MdLock } from 'react-icons/md';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { friendlyError } from '../utils/friendlyError';

const StyledContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  minHeight: '100vh',
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(8),
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  maxWidth: 450,
  width: '100%',
  backgroundColor: '#ffffff',
  borderRadius: 16,
}));

const StyledButton = styled(Button)(({ theme }) => ({
  margin: theme.spacing(1, 0),
  padding: theme.spacing(1.5),
  borderRadius: 8,
}));

const LoginPage = () => {
  const {
    user,
    signInWithGoogle,
    signInWithPassword,
    sendSignInLink,
    resetPassword,
  } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const [showPassword, setShowPassword] = useState(false);
  const [showEmailLinkForm, setShowEmailLinkForm] = useState(false);
  const [showMainForm, setShowMainForm] = useState(true);
  const [showForgotPasswordForm, setShowForgotPasswordForm] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    severity: '',
    message: '',
  });

  const handleGoogleLogin = async () => {
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
        message: friendlyError(err),
      });
    }
  };

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
          message: friendlyError(error),
        });
      }
    },
  });

  const forgotPasswordFormik = useFormik({
    initialValues: {
      email: '',
    },
    validationSchema: Yup.object({
      email: Yup.string().email('Invalid email').required('Email is required'),
    }),
    onSubmit: async (values) => {
      try {
        await resetPassword(values.email);
        setNotification({
          open: true,
          severity: 'info',
          message: `Password reset link sent to ${values.email}. Check your inbox.`,
        });
        forgotPasswordFormik.resetForm();
        setShowForgotPasswordForm(false);
        setShowMainForm(true);
      } catch (error) {
        setNotification({
          open: true,
          severity: 'error',
          message: friendlyError(error),
        });
      }
    },
  });

  const handleEmailLinkSubmit = async (e) => {
    e.preventDefault();
    if (!loginFormik.values.email) return;
    try {
      await sendSignInLink(loginFormik.values.email);
      setNotification({
        open: true,
        severity: 'info',
        message: `We sent a link to ${loginFormik.values.email}. Check your inbox to complete sign-in.`,
      });
      loginFormik.resetForm();
      setShowEmailLinkForm(false);
      setShowMainForm(true);
    } catch (error) {
      setNotification({
        open: true,
        severity: 'error',
        message: friendlyError(error),
      });
    }
  };

  if (user) {
    return null;
  }

  return (
    <StyledContainer>
      <Fade in={true} timeout={1000}>
        <StyledPaper elevation={3}>
          <Typography variant="h4" gutterBottom>
            Welcome Back
          </Typography>

          {showMainForm && (
            <>
              <StyledButton
                variant="outlined"
                fullWidth
                startIcon={<FcGoogle />}
                onClick={handleGoogleLogin}
              >
                Sign in with Google
              </StyledButton>

              <StyledButton
                variant="outlined"
                fullWidth
                startIcon={<MdEmail />}
                onClick={() => {
                  setShowEmailLinkForm(true);
                  setShowMainForm(false);
                }}
              >
                Sign in with Email Link
              </StyledButton>

              <Typography variant="body1" sx={{ my: 2 }}>
                OR
              </Typography>

              <Box
                component="form"
                onSubmit={loginFormik.handleSubmit}
                width="100%"
              >
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="Email Address"
                  name="email"
                  type="email"
                  value={loginFormik.values.email}
                  onChange={loginFormik.handleChange}
                  onBlur={loginFormik.handleBlur}
                  error={
                    loginFormik.touched.email &&
                    Boolean(loginFormik.errors.email)
                  }
                  helperText={
                    loginFormik.touched.email && loginFormik.errors.email
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MdEmail />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="Password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
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
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MdLock />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? (
                            <AiOutlineEyeInvisible />
                          ) : (
                            <AiOutlineEye />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Typography
                  variant="body2"
                  color="primary"
                  sx={{ mt: 1, cursor: 'pointer' }}
                  onClick={() => {
                    setShowForgotPasswordForm(true);
                    setShowMainForm(false);
                  }}
                >
                  Forgot Password?
                </Typography>

                <StyledButton
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{ mt: 3 }}
                >
                  Sign In
                </StyledButton>

                <Button
                  onClick={() => navigate('/register')}
                  sx={{ mt: 2 }}
                  fullWidth
                >
                  New user? Create an account
                </Button>
              </Box>
            </>
          )}

          {showEmailLinkForm && (
            <Box sx={{ width: '100%', mt: 2 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Enter your email, we'll send you a login link:
              </Typography>
              <TextField
                fullWidth
                label="Email Address"
                name="email"
                type="email"
                value={loginFormik.values.email}
                onChange={loginFormik.handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MdEmail />
                    </InputAdornment>
                  ),
                }}
              />
              <StyledButton
                variant="contained"
                fullWidth
                sx={{ mt: 2 }}
                onClick={handleEmailLinkSubmit}
              >
                Send Login Link
              </StyledButton>
              <Button
                onClick={() => {
                  setShowEmailLinkForm(false);
                  setShowMainForm(true);
                }}
                sx={{ mt: 2 }}
                fullWidth
                variant="text"
              >
                Back to Sign In with Password
              </Button>
            </Box>
          )}

          {showForgotPasswordForm && (
            <Box sx={{ width: '100%', mt: 2 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Enter your email to receive a reset link:
              </Typography>
              <Box
                component="form"
                onSubmit={forgotPasswordFormik.handleSubmit}
                width="100%"
              >
                <TextField
                  fullWidth
                  label="Email Address"
                  name="email"
                  type="email"
                  value={forgotPasswordFormik.values.email}
                  onChange={forgotPasswordFormik.handleChange}
                  onBlur={forgotPasswordFormik.handleBlur}
                  error={
                    forgotPasswordFormik.touched.email &&
                    Boolean(forgotPasswordFormik.errors.email)
                  }
                  helperText={
                    forgotPasswordFormik.touched.email &&
                    forgotPasswordFormik.errors.email
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MdEmail />
                      </InputAdornment>
                    ),
                  }}
                />
                <StyledButton
                  type="submit"
                  variant="contained"
                  fullWidth
                  sx={{ mt: 2 }}
                >
                  Send Reset Link
                </StyledButton>
                <Button
                  onClick={() => {
                    setShowForgotPasswordForm(false);
                    setShowMainForm(true);
                  }}
                  sx={{ mt: 2 }}
                  fullWidth
                  variant="text"
                >
                  Back to Sign In
                </Button>
              </Box>
            </Box>
          )}
        </StyledPaper>
      </Fade>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </StyledContainer>
  );
};

export default LoginPage;
