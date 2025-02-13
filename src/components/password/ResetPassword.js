//src/components/password/ResetPassword.js
import React, { useState } from 'react';
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
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { styled } from '@mui/system';
import { MdLock, MdCheckCircle } from 'react-icons/md';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { confirmPasswordReset } from 'firebase/auth';
import { auth } from '../../firebase';
import { friendlyError } from '../../utils/friendlyError';
import Notification from '../../notification/notification';

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

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 12,
    maxWidth: '350px',
    padding: theme.spacing(2),
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  padding: theme.spacing(2),
  textAlign: 'center',
}));

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('oobCode');
  const mode = searchParams.get('mode');
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [notification, setNotification] = useState({
    open: false,
    severity: 'success',
    message: '',
  });
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  if (mode !== 'resetPassword' || !code) {
    return (
      <StyledContainer>
        <StyledPaper elevation={3}>
          <Typography variant="h4" gutterBottom>
            Invalid Reset Link
          </Typography>
          <Typography variant="body1">
            The reset link is invalid or has expired. Please try resetting your
            password again.
          </Typography>
        </StyledPaper>
      </StyledContainer>
    );
  }

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

  const getPasswordRequirements = () => {
    return (
      <Box sx={{ p: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
          Password Requirements:
        </Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          - At least 8 characters
        </Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          - One uppercase letter (A-Z)
        </Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          - One lowercase letter (a-z)
        </Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          - One special character (!@#$%^&*)
        </Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          - One numeric character (0-9)
        </Typography>
      </Box>
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setNotification({
        open: true,
        severity: 'error',
        message: 'Passwords do not match!',
      });
      return;
    }

    try {
      await confirmPasswordReset(auth, code, formData.password);
      setSuccessModalOpen(true);
    } catch (error) {
      const errorMessage = friendlyError(error);
      setNotification({
        open: true,
        severity: 'error',
        message: errorMessage,
      });
    }
  };

  const passwordStrength = calculatePasswordStrength(formData.password);

  return (
    <>
      <StyledContainer>
        <StyledPaper elevation={3}>
          <Typography variant="h4" gutterBottom>
            Reset Password
          </Typography>

          <Box component="form" onSubmit={handleSubmit} width="100%">
            <Tooltip title={getPasswordRequirements()} placement="top">
              <TextField
                margin="normal"
                required
                fullWidth
                label="New Password"
                name="password"
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
            </Tooltip>

            <TextField
              margin="normal"
              required
              fullWidth
              label="Confirm New Password"
              name="confirmPassword"
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
                  borderRadius: 5,
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
              Reset Password
            </StyledButton>
          </Box>
        </StyledPaper>
      </StyledContainer>

      {/* Success Modal */}
      <StyledDialog
        open={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        aria-labelledby="success-dialog-title"
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
            Your password has been successfully reset.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <StyledButton
            onClick={() => navigate('/login')}
            variant="contained"
            size="small"
            sx={{
              px: 4,
              backgroundColor: '#4caf50',
              '&:hover': {
                backgroundColor: '#45a049',
              },
            }}
          >
            Login Now
          </StyledButton>
        </DialogActions>
      </StyledDialog>

      {/* Notification */}
      <Notification
        open={notification.open}
        onClose={() => setNotification({ ...notification, open: false })}
        severity={notification.severity}
        message={notification.message}
      />
    </>
  );
};

export default ResetPassword;
