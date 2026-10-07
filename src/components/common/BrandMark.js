// src/components/common/BrandMark.js — the shop's logo (from store settings)
// or, when none is uploaded, an initials badge; followed by the shop name
// with an accent full stop.
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import { useStore } from '../../context/StoreContext';

export const initialsOf = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'S';

export const LogoBadge = ({ size = 44 }) => {
  const shop = useStore();
  if (shop.logo) {
    return (
      <Box
        component="img"
        src={shop.logo}
        alt=""
        sx={{ height: size, maxWidth: size * 3, objectFit: 'contain' }}
      />
    );
  }
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: '8px',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 800,
        fontSize: size * 0.36,
        letterSpacing: '0.02em',
        flexShrink: 0,
        boxShadow: (t) => `0 6px 16px ${t.palette.primary.main}40`,
      }}
    >
      {initialsOf(shop.name)}
    </Box>
  );
};
LogoBadge.propTypes = { size: PropTypes.number };

const BrandMark = ({ size = 44, showName = true, fontSize = '1.35rem' }) => {
  const shop = useStore();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <LogoBadge size={size} />
      {showName && (
        <Typography
          component="span"
          sx={{
            fontWeight: 800,
            fontSize,
            letterSpacing: '-0.03em',
            color: 'text.primary',
            whiteSpace: 'nowrap',
          }}
        >
          {shop.name}
          <Box component="span" sx={{ color: 'primary.main' }}>
            .
          </Box>
        </Typography>
      )}
    </Box>
  );
};
BrandMark.propTypes = {
  size: PropTypes.number,
  showName: PropTypes.bool,
  fontSize: PropTypes.string,
};

export default BrandMark;
