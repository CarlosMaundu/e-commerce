// src/pages/SignupPage.js
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import {
  Box,
  Typography,
  TextField,
  Button,
  InputAdornment,
  IconButton,
  LinearProgress,
  Checkbox,
  FormControlLabel,
  Paper,
  Fade,
  Link,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { MdEmail, MdPerson, MdLock } from 'react-icons/md';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { useNavigate } from 'react-router-dom';
import { useNotify } from '../notification/NotificationProvider';
import { MESSAGES } from '../notification/messages';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import { GOOGLE_CLIENT_ID } from '../api/config';
import { usePageHeader } from '../components/layout/pageHeader';
import PasswordRules from '../components/password/PasswordRules';

const StyledContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  minHeight: '100vh',
  '@supports (min-height: 100dvh)': { minHeight: '100dvh' },
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(8),
  // Side margins, so the card never touches the screen edges on phones.
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  [theme.breakpoints.down('md')]: {
    paddingTop: theme.spacing(3),
    paddingBottom: theme.spacing(3),
  },
  backgroundColor: '#f5f5f5',
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  maxWidth: 450,
  width: '100%',
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
}));

const StyledButton = styled(Button)(({ theme }) => ({
  margin: theme.spacing(1, 0),
  padding: theme.spacing(1.5),
  borderRadius: 8,
}));

const SignupPage = () => {
  usePageHeader({ title: 'Create account' });
  const { signUp, signInWithGoogle, user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const notify = useNotify();

  const formik = useFormik({
    initialValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    validationSchema: Yup.object({
      firstName: Yup.string().required('First name is required'),
      lastName: Yup.string().required('Last name is required'),
      email: Yup.string().email('Invalid email').required('Email is required'),
      password: Yup.string()
        .min(8, 'Minimum 8 characters')
        .required('Password is required'),
      confirmPassword: Yup.string()
        .oneOf([Yup.ref('password'), null], 'Passwords must match')
        .required('Confirm password is required'),
    }),
    onSubmit: async (values) => {
      try {
        const created = await signUp({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          password: values.password,
        });
        if (created.verificationRequired) {
          navigate(`/verify-email?sent=${encodeURIComponent(created.email)}`, {
            replace: true,
          });
          return;
        }
        notify.success(MESSAGES.auth.signedUp);
        navigate('/', { replace: true });
      } catch (error) {
        notify.error(error, MESSAGES.auth.signUpFailed);
      }
    },
  });

  const handleGoogleCredential = async (credential) => {
    try {
      await signInWithGoogle(credential);
      notify.success(MESSAGES.auth.signedInGoogle);
      navigate('/', { replace: true });
    } catch (error) {
      notify.error(error, MESSAGES.auth.signUpFailed);
    }
  };

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[0-9!@#$%^&*]/.test(password)) strength += 25;
    return strength;
  };

  const passwordStrength = calculatePasswordStrength(formik.values.password);

  if (user) {
    return null; // Prevent rendering if user is logged in
  }

  return (
    <StyledContainer>
      <Fade in={true} timeout={1000}>
        <StyledPaper>
          <Typography variant="h4" gutterBottom>
            Create Account
          </Typography>

          <>
            {GOOGLE_CLIENT_ID && (
              <>
                <GoogleSignInButton
                  text="signup_with"
                  onCredential={handleGoogleCredential}
                  onError={(error) =>
                    notify.error(error, MESSAGES.auth.googleUnavailable)
                  }
                />
                <Typography variant="body1" sx={{ my: 2 }}>
                  OR
                </Typography>
              </>
            )}

            <Box component="form" onSubmit={formik.handleSubmit} width="100%">
              <TextField
                margin="normal"
                required
                fullWidth
                label="First Name"
                name="firstName"
                autoComplete="given-name"
                value={formik.values.firstName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.firstName && Boolean(formik.errors.firstName)
                }
                helperText={formik.touched.firstName && formik.errors.firstName}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MdPerson />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                label="Last Name"
                name="lastName"
                autoComplete="family-name"
                value={formik.values.lastName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.lastName && Boolean(formik.errors.lastName)
                }
                helperText={formik.touched.lastName && formik.errors.lastName}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MdPerson />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                label="Email Address"
                name="email"
                type="email"
                autoComplete="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.email && Boolean(formik.errors.email)}
                helperText={formik.touched.email && formik.errors.email}
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
                autoComplete="new-password"
                type={showPassword ? 'text' : 'password'}
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.password && Boolean(formik.errors.password)
                }
                helperText={formik.touched.password && formik.errors.password}
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
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
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
              <PasswordRules password={formik.values.password} />

              <TextField
                margin="normal"
                required
                fullWidth
                label="Confirm Password"
                name="confirmPassword"
                autoComplete="new-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formik.values.confirmPassword}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.confirmPassword &&
                  Boolean(formik.errors.confirmPassword)
                }
                helperText={
                  formik.touched.confirmPassword &&
                  formik.errors.confirmPassword
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
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        edge="end"
                        aria-label={
                          showConfirmPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                      >
                        {showConfirmPassword ? (
                          <AiOutlineEyeInvisible />
                        ) : (
                          <AiOutlineEye />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Box sx={{ mt: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={passwordStrength}
                  sx={{
                    height: 8,
                    borderRadius: 1,
                    backgroundColor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor:
                        passwordStrength <= 25
                          ? '#f44336'
                          : passwordStrength <= 50
                            ? '#ff9800'
                            : passwordStrength <= 75
                              ? '#ffc107'
                              : '#4caf50',
                    },
                  }}
                />
                <Typography variant="caption" color="textSecondary">
                  Password Strength: {passwordStrength}%
                </Typography>
              </Box>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2">
                    I accept the{' '}
                    <Link
                      href="/policies/terms"
                      underline="hover"
                      target="_blank"
                      rel="noopener"
                    >
                      Terms and Conditions
                    </Link>{' '}
                    and have read the{' '}
                    <Link
                      href="/policies/privacy"
                      underline="hover"
                      target="_blank"
                      rel="noopener"
                    >
                      Privacy Policy
                    </Link>
                  </Typography>
                }
                sx={{ mt: 2 }}
              />

              <StyledButton
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3 }}
                disabled={
                  !acceptTerms || passwordStrength < 75 || formik.isSubmitting
                }
              >
                {formik.isSubmitting ? 'Creating account…' : 'Create Account'}
              </StyledButton>
              {/* Say why the button is waiting, rather than just grey it. */}
              {!formik.isSubmitting &&
                (passwordStrength < 75 || !acceptTerms) && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="p"
                    role="status"
                    sx={{ textAlign: 'center' }}
                  >
                    {[
                      passwordStrength < 75 && 'meet the password rules above',
                      !acceptTerms && 'accept the terms',
                    ]
                      .filter(Boolean)
                      .join(' and ')
                      .replace(/^./, (c) => `To continue, ${c}`)}
                    .
                  </Typography>
                )}

              <Button
                onClick={() => navigate('/login')}
                sx={{ mt: 2 }}
                fullWidth
              >
                Already have an account? Sign In
              </Button>
            </Box>
          </>
        </StyledPaper>
      </Fade>
    </StyledContainer>
  );
};

export default SignupPage;
