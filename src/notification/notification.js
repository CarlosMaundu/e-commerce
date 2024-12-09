// src/notification/notification.js
import React from 'react';
import { Snackbar, Alert } from '@mui/material';

const Notification = ({ open, onClose, severity, message }) => {
  return (
    <Snackbar
      open={open}
      autoHideDuration={3000} // Automatically close after 3 seconds
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert onClose={onClose} severity={severity} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
};

export default Notification;
