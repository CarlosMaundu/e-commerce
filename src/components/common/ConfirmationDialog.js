// src/components/common/ConfirmationDialog.js
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
  Box,
} from '@mui/material';

const ConfirmationDialog = ({
  open,
  title,
  content,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loading = false, // Updated prop name to 'loading'
}) => {
  return (
    <Dialog
      open={open}
      onClose={loading ? null : onCancel} // Prevent closing during loading
      aria-labelledby="confirmation-dialog-title"
      // Removed sx prop to inherit borderRadius from theme
    >
      <DialogTitle id="confirmation-dialog-title">{title}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              minWidth: 200,
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <CircularProgress size={24} />
            <DialogContentText>Processing...</DialogContentText>
          </Box>
        ) : (
          <DialogContentText>{content}</DialogContentText>
        )}
      </DialogContent>

      {!loading && (
        <DialogActions>
          <Button
            onClick={onCancel}
            color="primary"
            variant="outlined"
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            color="error"
            variant="contained"
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          >
            {confirmText}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default ConfirmationDialog;
