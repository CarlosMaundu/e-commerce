// src/pages/LoginPage.js

import React, { useContext, useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useNavigate, Link, useLocation } from 'react-router-dom'; // Import useLocation
import { AuthContext } from '../context/AuthContext';
import { login } from '../services/authService'; // Corrected import
import { createUser } from '../services/userService'; // Removed isEmailAvailable import
import '../styles/login.css';
import {
  TextField,
  InputAdornment,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress'; // Added
import {
  AccountCircle,
  Lock,
  Facebook,
  Google,
  Twitter,
  GitHub,
} from '@mui/icons-material';
import Notification from '../notification/notification';

const LoginPage = () => {
  const { user, loading, handleLogin } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation(); // Get location
  const from = location.state?.from || '/'; // Determine redirect path
  const currentPath = location.pathname; // Determine current path
  const [activeTab, setActiveTab] = useState('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    severity: '',
    message: '',
  });

  // Set active tab based on current route
  useEffect(() => {
    if (currentPath === '/register') {
      setActiveTab('register');
    } else {
      setActiveTab('login');
    }
  }, [currentPath]);

  // Redirect authenticated users away from the login page
  useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true }); // Redirect to intended path
    }
  }, [user, loading, navigate, from]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'login') {
      navigate('/login', { state: { from } });
    } else {
      navigate('/register', { state: { from } });
    }
  };

  const loginFormik = useFormik({
    initialValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    validationSchema: Yup.object({
      email: Yup.string()
        .email('Invalid email address')
        .required('Email is required'),
      password: Yup.string().required('Password is required'),
    }),
    onSubmit: async (values) => {
      setIsSubmitting(true);
      try {
        const userData = await login(values.email, values.password);
        await handleLogin(userData); // Ensure tokens are stored before navigating
        setNotification({
          open: true,
          severity: 'success',
          message: 'Login successful!',
        });
        // Redirection is handled by useEffect
      } catch (error) {
        console.error('Login error:', error);
        setNotification({
          open: true,
          severity: 'error',
          message:
            error.message === 'Unauthorized'
              ? 'Invalid credentials. Please check your email and password.'
              : error.message || 'Login failed. Please try again.',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const registerFormik = useFormik({
    initialValues: {
      name: '',
      secondName: '', // Replaced 'username' with 'secondName'
      email: '',
      password: '',
      agreeToTerms: false,
    },
    validationSchema: Yup.object({
      name: Yup.string().required('First name is required'),
      secondName: Yup.string().required('Second name is required'),
      email: Yup.string()
        .email('Invalid email address')
        .required('Email is required'),
      password: Yup.string().required('Password is required'),
      agreeToTerms: Yup.boolean().oneOf([true], 'You must agree to the terms'),
    }),
    onSubmit: async (values) => {
      setIsSubmitting(true);
      try {
        const newUser = {
          name: `${values.name} ${values.secondName}`, // Combine first and second name
          email: values.email,
          password: values.password,
          avatar: 'https://picsum.photos/800', // Default avatar or allow user to upload
        };

        await createUser(newUser); // Removed 'createdUser' assignment

        // Automatically log in the user after successful registration
        const loginResponse = await login(values.email, values.password);
        await handleLogin(loginResponse); // Store tokens and update user state

        setNotification({
          open: true,
          severity: 'success',
          message: 'Registration and login successful!',
        });

        // Redirection is handled by useEffect
        navigate(from, { replace: true }); // Ensure immediate redirection

        registerFormik.resetForm();
      } catch (error) {
        console.error('Registration or Login error:', error);
        setNotification({
          open: true,
          severity: 'error',
          message: error.message || 'Registration failed. Please try again.',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  if (loading) {
    return <div>Loading...</div>; // Show loading indicator
  }

  return (
    <div className="background-container">
      <div className="login-container">
        {/* Tab Navigation */}
        <div className="tabs-container">
          <button
            className={`tab-button ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => handleTabChange('login')}
          >
            Login
          </button>
          <button
            className={`tab-button ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => handleTabChange('register')}
          >
            Register
          </button>
        </div>

        {/* Login Section */}
        {activeTab === 'login' && (
          <div className="form-section">
            <h1>Login</h1>
            <p>Welcome Back! Sign in with your credentials.</p>
            <div className="social-login-icons">
              <IconButton color="primary">
                <Facebook />
              </IconButton>
              <IconButton color="error">
                <Google />
              </IconButton>
              <IconButton color="primary">
                <Twitter />
              </IconButton>
              <IconButton color="default">
                <GitHub />
              </IconButton>
            </div>
            <p className="or-divider">or:</p>
            <form onSubmit={loginFormik.handleSubmit}>
              <div className="form-group">
                <TextField
                  id="email"
                  name="email"
                  label="Email"
                  variant="outlined"
                  fullWidth
                  autoComplete="email"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AccountCircle />
                      </InputAdornment>
                    ),
                  }}
                  onChange={loginFormik.handleChange}
                  onBlur={loginFormik.handleBlur}
                  value={loginFormik.values.email}
                  error={
                    loginFormik.touched.email &&
                    Boolean(loginFormik.errors.email)
                  }
                  helperText={
                    loginFormik.touched.email && loginFormik.errors.email
                  }
                />
              </div>
              <div className="form-group">
                <TextField
                  id="password"
                  name="password"
                  label="Password"
                  type="password"
                  variant="outlined"
                  fullWidth
                  autoComplete="current-password"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock />
                      </InputAdornment>
                    ),
                  }}
                  onChange={loginFormik.handleChange}
                  onBlur={loginFormik.handleBlur}
                  value={loginFormik.values.password}
                  error={
                    loginFormik.touched.password &&
                    Boolean(loginFormik.errors.password)
                  }
                  helperText={
                    loginFormik.touched.password && loginFormik.errors.password
                  }
                />
              </div>
              <div className="form-actions">
                <FormControlLabel
                  control={
                    <Checkbox
                      id="rememberMe"
                      name="rememberMe"
                      color="primary"
                      onChange={loginFormik.handleChange}
                      checked={loginFormik.values.rememberMe}
                    />
                  }
                  label="Remember me"
                />
                <Link to="#forgot-password" className="forgot-password-link">
                  Forgot password?
                </Link>
              </div>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
            <p className="text-center mt-3">
              Not a member?{' '}
              <Link
                to="/register"
                className="register-link"
                onClick={() => handleTabChange('register')}
                state={{ from }} // Preserve redirect state
              >
                Register
              </Link>
            </p>
          </div>
        )}

        {/* Register Section */}
        {activeTab === 'register' && (
          <div className="form-section">
            <h1>Register</h1>
            <p>Create your account to get started.</p>
            <div className="social-login-icons">
              <IconButton color="primary">
                <Facebook />
              </IconButton>
              <IconButton color="error">
                <Google />
              </IconButton>
              <IconButton color="primary">
                <Twitter />
              </IconButton>
              <IconButton color="default">
                <GitHub />
              </IconButton>
            </div>
            <p className="or-divider">or:</p>
            <form onSubmit={registerFormik.handleSubmit}>
              <div className="form-group">
                <TextField
                  id="name"
                  name="name"
                  label="First Name"
                  variant="outlined"
                  fullWidth
                  autoComplete="given-name"
                  onChange={registerFormik.handleChange}
                  onBlur={registerFormik.handleBlur}
                  value={registerFormik.values.name}
                  error={
                    registerFormik.touched.name &&
                    Boolean(registerFormik.errors.name)
                  }
                  helperText={
                    registerFormik.touched.name && registerFormik.errors.name
                  }
                />
              </div>
              <div className="form-group">
                <TextField
                  id="secondName"
                  name="secondName"
                  label="Second Name"
                  variant="outlined"
                  fullWidth
                  autoComplete="family-name"
                  onChange={registerFormik.handleChange}
                  onBlur={registerFormik.handleBlur}
                  value={registerFormik.values.secondName}
                  error={
                    registerFormik.touched.secondName &&
                    Boolean(registerFormik.errors.secondName)
                  }
                  helperText={
                    registerFormik.touched.secondName &&
                    registerFormik.errors.secondName
                  }
                />
              </div>
              <div className="form-group">
                <TextField
                  id="email"
                  name="email"
                  label="Email"
                  variant="outlined"
                  fullWidth
                  autoComplete="email"
                  onChange={registerFormik.handleChange}
                  onBlur={registerFormik.handleBlur}
                  value={registerFormik.values.email}
                  error={
                    registerFormik.touched.email &&
                    Boolean(registerFormik.errors.email)
                  }
                  helperText={
                    registerFormik.touched.email && registerFormik.errors.email
                  }
                />
              </div>
              <div className="form-group">
                <TextField
                  id="password"
                  name="password"
                  label="Password"
                  type="password"
                  variant="outlined"
                  fullWidth
                  autoComplete="new-password"
                  onChange={registerFormik.handleChange}
                  onBlur={registerFormik.handleBlur}
                  value={registerFormik.values.password}
                  error={
                    registerFormik.touched.password &&
                    Boolean(registerFormik.errors.password)
                  }
                  helperText={
                    registerFormik.touched.password &&
                    registerFormik.errors.password
                  }
                />
              </div>
              <div className="form-actions">
                <FormControlLabel
                  control={
                    <Checkbox
                      id="agreeToTerms"
                      name="agreeToTerms"
                      color="primary"
                      onChange={registerFormik.handleChange}
                      checked={registerFormik.values.agreeToTerms}
                    />
                  }
                  label="I agree to the terms"
                />
              </div>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Sign up'
                )}
              </Button>
            </form>
            <p className="text-center mt-3">
              Already have an account?{' '}
              <Link
                to="/login"
                className="login-link"
                onClick={() => handleTabChange('login')}
                state={{ from }} // Preserve redirect state
              >
                Login
              </Link>
            </p>
          </div>
        )}
      </div>
      <Notification
        open={notification.open}
        severity={notification.severity}
        message={notification.message}
        onClose={() =>
          setNotification({ open: false, severity: '', message: '' })
        }
      />
    </div>
  );
};

export default LoginPage;
