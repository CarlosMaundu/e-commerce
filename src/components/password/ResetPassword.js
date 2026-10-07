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
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import { styled } from '@mui/system';
import { MdLock, MdCheckCircle } from 'react-icons/md';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import { BsCheckCircle, BsXCircle } from 'react-icons/bs';
import {
  Link as RouterLink,
  useSearchParams,
  useNavigate,
} from 'react-router-dom';
import { auth } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { MESSAGES } from '../../notification/messages';

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
  borderRadius: 12,
}));

const StyledButton = styled(Button)(({ theme }) => ({
  margin: theme.spacing(1, 0),
  padding: theme.spacing(1.5),
  borderRadius: 8,
}));

const TooltipContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1),
  color: '#ffffff',
  '& .MuiTypography-root': {
    color: '#ffffff',
  },
  '& .MuiListItemText-primary': {
    color: '#ffffff',
  },
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
  const token = searchParams.get('token');
  const navigate = useNavigate();
  // 'checking' | 'valid' | 'invalid'; purpose is 'reset' or 'setup'
  const [link, setLink] = useState({
    state: token ? 'checking' : 'invalid',
    purpose: 'reset',
    email: '',
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

  const checkPasswordCriteria = (password) => ({
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numberOrSpecial: /[0-9!@#$%^&*]/.test(password),
  });

  const PasswordTooltip = () => {
    const criteria = checkPasswordCriteria(formData.password);
    return (
      <TooltipContent>
        <Typography variant="subtitle2" gutterBottom>
          Password Requirements:
        </Typography>
        <List dense>
          {[
            { label: 'At least 8 characters', valid: criteria.length },
            { label: 'One uppercase letter', valid: criteria.uppercase },
            { label: 'One lowercase letter', valid: criteria.lowercase },
            {
              label: 'One number or special character',
              valid: criteria.numberOrSpecial,
            },
          ].map((item, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                {item.valid ? (
                  <BsCheckCircle color="#4caf50" />
                ) : (
                  <BsXCircle color="#f44336" />
                )}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItem>
          ))}
        </List>
      </TooltipContent>
    );
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
            <Tooltip title={<PasswordTooltip />} placement="top" arrow>
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
            {isSetup
              ? 'Your password is set. You can now sign in.'
              : MESSAGES.auth.passwordReset}
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
    </>
  );
};

export default ResetPassword;
