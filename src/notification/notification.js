// src/notification/notification.js
import React from 'react';
import PropTypes from 'prop-types';
import { Snackbar, Alert } from '@mui/material';

// Errors stay up longer so people have time to read what to do next.
export const AUTO_HIDE_MS = {
  success: 4000,
  info: 6000,
  warning: 7000,
  error: 8000,
};

const Notification = ({ open, onClose, severity = 'info', message }) => {
  const handleClose = (event, reason) => {
    if (reason === 'clickaway') return;
    onClose?.(event, reason);
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={AUTO_HIDE_MS[severity] ?? AUTO_HIDE_MS.info}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        onClose={handleClose}
        severity={severity || 'info'}
        variant="filled"
        sx={{ width: '100%', maxWidth: 560 }}
        data-testid="app-notification"
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

Notification.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  severity: PropTypes.oneOf(['success', 'info', 'warning', 'error', '']),
  message: PropTypes.node,
};

export default Notification;
