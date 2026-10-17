//src/components/password/ResetPassword.js
import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  LinearProgress,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import { styled } from '@mui/system';
import { MdLock, MdCheckCircle } from 'react-icons/md';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import {
  Link as RouterLink,
  useSearchParams,
  useNavigate,
} from 'react-router-dom';
import { auth } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { MESSAGES } from '../../notification/messages';
import ResponsiveSheet from '../common/ResponsiveSheet';
import PasswordRules from './PasswordRules';
import { usePageHeader } from '../layout/pageHeader';

const StyledContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  minHeight: '100vh',
  '@supports (min-height: 100dvh)': { minHeight: '100dvh' },
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
  borderRadius: 12,
}));

const StyledButton = styled(Button)(({ theme }) => ({
  margin: theme.spacing(1, 0),
  padding: theme.spacing(1.5),
  borderRadius: 8,
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  padding: theme.spacing(2),
  textAlign: 'center',
}));

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  // 'checking' | 'valid' | 'invalid'; purpose is 'reset' or 'setup'
  const [link, setLink] = useState({
    state: token ? 'checking' : 'invalid',
    purpose: 'reset',
    email: '',
  });
  usePageHeader({
    title: link.purpose === 'setup' ? 'Set password' : 'Reset password',
  });

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    auth
      .checkResetToken(token)
      .then((info) => {
        if (active) setLink({ state: 'valid', ...info });
      })
      .catch(() => {
        if (active) setLink((prev) => ({ ...prev, state: 'invalid' }));
      });
    return () => {
      active = false;
    };
  }, [token]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const notify = useNotify();
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  if (link.state === 'checking') {
    return (
      <StyledContainer>
        <StyledPaper elevation={3}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Checking your link…</Typography>
        </StyledPaper>
      </StyledContainer>
    );
  }

  if (link.state === 'invalid') {
    return (
      <StyledContainer>
        <StyledPaper elevation={3}>
          <Typography variant="h4" gutterBottom>
            This link isn’t valid
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            The link is invalid, has expired or has already been used. Please
            request a new one.
          </Typography>
          <Button component={RouterLink} to="/login" variant="contained">
            Back to sign in
          </Button>
        </StyledPaper>
      </StyledContainer>
    );
  }

  const isSetup = link.purpose === 'setup';

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[0-9!@#$%^&*]/.test(password)) strength += 25;
    return strength;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      notify.error(MESSAGES.auth.passwordsDoNotMatch);
      return;
    }

    try {
      await auth.resetPassword(token, formData.password);
      setSuccessModalOpen(true);
    } catch (error) {
      notify.error(error, MESSAGES.auth.resetFailed);
    }
  };

  const passwordStrength = calculatePasswordStrength(formData.password);

  return (
    <>
      <StyledContainer>
        <StyledPaper elevation={3}>
          <Typography variant="h4" gutterBottom>
            {isSetup ? 'Set your password' : 'Reset Password'}
          </Typography>
          {link.email && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              for {link.email}
            </Typography>
          )}

          <Box component="form" onSubmit={handleSubmit} width="100%">
            <TextField
              margin="normal"
              required
              fullWidth
              label="New Password"
              name="password"
              autoComplete="new-password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleInputChange}
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
            <PasswordRules password={formData.password} />

            <TextField
              margin="normal"
              required
              fullWidth
              label="Confirm New Password"
              name="confirmPassword"
              autoComplete="new-password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={handleInputChange}
              error={formData.confirmPassword !== formData.password}
              helperText={
                formData.confirmPassword !== formData.password
                  ? 'Passwords do not match'
                  : ''
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
                        showConfirmPassword ? 'Hide password' : 'Show password'
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

            <StyledButton
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3 }}
              disabled={
                passwordStrength < 75 ||
                !formData.confirmPassword ||
                formData.password !== formData.confirmPassword
              }
            >
              {isSetup ? 'Set password' : 'Reset Password'}
            </StyledButton>
          </Box>
        </StyledPaper>
      </StyledContainer>

      {/* Success Modal */}
      <ResponsiveSheet
        open={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        aria-labelledby="success-dialog-title"
        maxWidth="xs"
        fullWidth
      >
        <StyledDialogTitle id="success-dialog-title">
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={1}
          >
            <MdCheckCircle color="#4caf50" size={40} />
            <Typography variant="h6" component="span">
              Success!
            </Typography>
          </Box>
        </StyledDialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {isSetup
              ? 'Your password is set. You can now sign in.'
              : MESSAGES.auth.passwordReset}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => navigate('/login')}
            variant="contained"
            size="large"
            fullWidth
          >
            Sign in
          </Button>
        </DialogActions>
      </ResponsiveSheet>
    </>
  );
};

export default ResetPassword;
