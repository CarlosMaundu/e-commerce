// src/components/product/BuyDock.js — phones: the price with Add to cart and
// Buy now, fixed just above the bottom menu, so buying never needs a scroll.
// Until every option is picked, the buttons take the shopper to the options.
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Stack, Typography } from '@mui/material';
import { FiShoppingCart } from 'react-icons/fi';
import { BOTTOM_NAV_HEIGHT } from '../../layouts/MobileBottomNav';
import { formatMoney } from '../../utils/format';

const DOCK_HEIGHT = 68;

const BuyDock = ({ price, wasPrice, needsChoice, inStock, onAdd, onBuy }) => {
  const [busy, setBusy] = useState(false);
  const run = (fn) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const soldOut = !needsChoice && !inStock;

  return (
    <>
      {/* Room at the end of the page so the dock never hides content. */}
      <Box aria-hidden sx={{ height: DOCK_HEIGHT + 12 }} />
      <Box
        data-testid="buy-dock"
        sx={{
          position: 'fixed',
          left: 12,
          right: 12,
          bottom: `calc(${BOTTOM_NAV_HEIGHT + 8}px + env(safe-area-inset-bottom))`,
          zIndex: (t) => t.zIndex.appBar,
          height: DOCK_HEIGHT,
          px: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderRadius: 1,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          boxShadow: '0 12px 32px rgba(27,33,36,0.14)',
          viewTransitionName: 'buy-dock',
        }}
      >
        <Box sx={{ minWidth: 0, flexShrink: 1, mr: 'auto' }}>
          <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }} noWrap>
            {formatMoney(price)}
          </Typography>
          {wasPrice != null && (
            <Typography
              variant="caption"
              sx={{ textDecoration: 'line-through' }}
              noWrap
            >
              {formatMoney(wasPrice)}
            </Typography>
          )}
        </Box>
        {soldOut ? (
          <Button variant="contained" disabled size="large">
            Out of stock
          </Button>
        ) : (
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button
              variant="outlined"
              size="large"
              onClick={run(onAdd)}
              disabled={busy}
              aria-label="Add to cart"
              sx={{ minWidth: 0, px: 1.5 }}
            >
              <FiShoppingCart />
              <Box
                component="span"
                sx={{ ml: 1, '@media (max-width:359px)': { display: 'none' } }}
              >
                Add
              </Box>
            </Button>
            <Button
              variant="contained"
              size="large"
              onClick={run(onBuy)}
              disabled={busy}
            >
              {needsChoice ? 'Choose options' : 'Buy now'}
            </Button>
          </Stack>
        )}
      </Box>
    </>
  );
};

BuyDock.propTypes = {
  price: PropTypes.number,
  wasPrice: PropTypes.number,
  needsChoice: PropTypes.bool.isRequired,
  inStock: PropTypes.bool.isRequired,
  onAdd: PropTypes.func.isRequired,
  onBuy: PropTypes.func.isRequired,
};

export default BuyDock;
