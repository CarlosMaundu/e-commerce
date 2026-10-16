// src/components/common/ResponsiveSheet.js — a dialog on desktop, a bottom
// sheet on phones: it slides up from the bottom, has a handle, and closes
// with a swipe down, a tap outside or the phone's Back button.
//
// Use it like MUI's <Dialog>: same open / onClose / maxWidth props, and
// DialogTitle, DialogContent and DialogActions inside (a <form> wrapping
// them works too). The content scrolls; the actions stay at the bottom.
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Dialog, SwipeableDrawer, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useBackToClose from '../../hooks/useBackToClose';

const noop = () => {};

const column = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  flex: '1 1 auto',
};

const ResponsiveSheet = ({
  open,
  onClose,
  children,
  'aria-labelledby': labelledBy,
  PaperProps,
  ...dialogProps
}) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('md'));
  // Phones: Back closes the sheet. onClose is left out while busy (e.g.
  // saving): then nothing closes it.
  useBackToClose(open && phone, onClose || noop);

  if (!phone) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        aria-labelledby={labelledBy}
        PaperProps={PaperProps}
        {...dialogProps}
      >
        {children}
      </Dialog>
    );
  }

  const { 'data-testid': testId } = dialogProps;
  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose || noop}
      onOpen={noop}
      disableSwipeToOpen
      disableDiscovery
      data-testid={testId}
      PaperProps={{
        ...PaperProps,
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': labelledBy,
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: 'calc(100dvh - 48px)',
          display: 'flex',
          flexDirection: 'column',
          pb: 'env(safe-area-inset-bottom)',
          overscrollBehavior: 'contain',
          '& > form': column,
          '& .MuiDialogContent-root': { overflowY: 'auto' },
          '& .MuiDialogActions-root': {
            borderTop: 1,
            borderColor: 'divider',
            px: 2,
            py: 1.5,
            '& > .MuiButton-root': { flex: 1, height: 48 },
          },
          ...PaperProps?.sx,
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 40,
          height: 4,
          borderRadius: 2,
          bgcolor: 'divider',
          mx: 'auto',
          mt: 1,
          mb: 0.5,
          flexShrink: 0,
        }}
      />
      {children}
    </SwipeableDrawer>
  );
};

ResponsiveSheet.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  children: PropTypes.node,
  'aria-labelledby': PropTypes.string,
  PaperProps: PropTypes.object,
};

export default ResponsiveSheet;
