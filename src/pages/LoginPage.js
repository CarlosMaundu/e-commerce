import React, { useContext, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { login } from '../services/authService';
import '../styles/login.css';
import {
  TextField,
  InputAdornment,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
} from '@mui/material';
import { AccountCircle, Lock } from '@mui/icons-material';
import { Facebook, Google, Twitter, GitHub } from '@mui/icons-material';
import Notification from '../notification/notification';

const LoginPage = () => {
  const { handleLogin } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    severity: '',
    message: '',
  });

  const handleTabChange = (tab) => setActiveTab(tab);

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
      setLoading(true);
      try {
        const userData = await login(values.email, values.password);
        handleLogin(userData); // Set user and tokens in AuthContext
        setNotification({
          open: true,
          severity: 'success',
          message: 'Login successful!',
        });
        // Navigate only after ensuring tokens are stored
        setTimeout(() => {
          navigate('/');
        }, 500);
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
        setLoading(false);
      }
    },
  });

  const registerFormik = useFormik({
    initialValues: {
      name: '',
      username: '',
      email: '',
      password: '',
      agreeToTerms: false,
    },
    validationSchema: Yup.object({
      name: Yup.string().required('Name is required'),
      username: Yup.string().required('Username is required'),
      email: Yup.string()
        .email('Invalid email address')
        .required('Email is required'),
      password: Yup.string().required('Password is required'),
      agreeToTerms: Yup.boolean().oneOf([true], 'You must agree to the terms'),
    }),
    onSubmit: async (values) => {
      setLoading(true);
      try {
        // Simulated API response for registration
        setActiveTab('login');
      } catch (error) {
        console.error('Registration error:', error);
      } finally {
        setLoading(false);
      }
    },
  });

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
                <a href="#forgot-password" className="forgot-password-link">
                  Forgot password?
                </a>
              </div>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={loginFormik.isSubmitting || loading}
              >
                {loading ? 'Logging in...' : 'Sign in'}
              </Button>
            </form>
            <p className="text-center mt-3">
              Not a member?{' '}
              <a
                href="#register"
                className="register-link"
                onClick={() => handleTabChange('register')}
              >
                Register
              </a>
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
                  label="Name"
                  variant="outlined"
                  fullWidth
                  autoComplete="name"
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
                  id="username"
                  name="username"
                  label="Username"
                  variant="outlined"
                  fullWidth
                  autoComplete="username"
                  onChange={registerFormik.handleChange}
                  onBlur={registerFormik.handleBlur}
                  value={registerFormik.values.username}
                  error={
                    registerFormik.touched.username &&
                    Boolean(registerFormik.errors.username)
                  }
                  helperText={
                    registerFormik.touched.username &&
                    registerFormik.errors.username
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
                disabled={registerFormik.isSubmitting || loading}
              >
                {loading ? 'Signing up...' : 'Sign up'}
              </Button>
            </form>
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
