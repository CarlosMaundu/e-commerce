// src/components/common/StickyActionBar.js — phones: a page's main action
// (Checkout, Continue, Pay) fixed at the bottom of the screen, with room left
// at the end of the page so nothing hides behind it. Above the bottom menu by
// default; at the very bottom where the menu is hidden (checkout).
import React from 'react';
import PropTypes from 'prop-types';
import { Box } from '@mui/material';
import { BOTTOM_NAV_HEIGHT } from '../../layouts/MobileBottomNav';
import useTyping from '../../hooks/useTyping';

const StickyActionBar = ({
  children,
  aboveNav: wantsAboveNav = true,
  height = 68,
  ...rest
}) => {
  // While typing the bottom menu hides, so the bar drops into its place.
  const typing = useTyping();
  const aboveNav = wantsAboveNav && !typing;
  return (
    <>
      <Box aria-hidden sx={{ height: height + 12 }} />
      <Box
        {...rest}
        sx={{
          position: 'fixed',
          zIndex: (t) => t.zIndex.appBar,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          bgcolor: 'background.paper',
          ...(aboveNav
            ? {
                left: 12,
                right: 12,
                bottom: `calc(${BOTTOM_NAV_HEIGHT + 8}px + env(safe-area-inset-bottom))`,
                height,
                px: 1.5,
                borderRadius: 1,
                border: 1,
                borderColor: 'divider',
                boxShadow: '0 12px 32px rgba(27,33,36,0.14)',
              }
            : {
                left: 0,
                right: 0,
                bottom: 0,
                minHeight: height,
                px: 2,
                pt: 1.25,
                pb: 'calc(env(safe-area-inset-bottom) + 10px)',
                borderTop: 1,
                borderColor: 'divider',
                boxShadow: '0 -8px 24px rgba(27,33,36,0.08)',
              }),
          viewTransitionName: 'action-bar',
        }}
      >
        {children}
      </Box>
    </>
  );
};

StickyActionBar.propTypes = {
  children: PropTypes.node,
  aboveNav: PropTypes.bool,
  height: PropTypes.number,
};

export default StickyActionBar;
