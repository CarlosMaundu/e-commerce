import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/system';
import { FiLogIn, FiUserPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: '16px',
    padding: theme.spacing(2),
    maxWidth: '400px',
    width: '90%',
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: '8px',
  fontSize: '1rem',
  fontWeight: 600,
  textTransform: 'none',
  width: '100%',
  display: 'flex',
  gap: theme.spacing(1),
  alignItems: 'center',
  justifyContent: 'center',
}));

const UserTypeModal = ({ open, onClose }) => {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate('/login');
    onClose();
  };

  const handleRegister = () => {
    navigate('/register');
    onClose();
  };

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      aria-labelledby="user-type-dialog-title"
    >
      <DialogTitle id="user-type-dialog-title">
        <Typography variant="h5" component="h2" align="center" fontWeight={600}>
          Are you an existing customer?
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <StyledButton
            variant="contained"
            onClick={handleLogin}
            color="primary"
            aria-label="Login as existing customer"
          >
            <FiLogIn size={20} />
            Login
          </StyledButton>
          <StyledButton
            variant="outlined"
            onClick={handleRegister}
            color="primary"
            aria-label="Register as new customer"
          >
            <FiUserPlus size={20} />
            Register
          </StyledButton>
        </Stack>
      </DialogContent>
    </StyledDialog>
  );
};

export default UserTypeModal;
