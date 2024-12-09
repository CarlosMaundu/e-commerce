// src/components/profile/WishlistSection.js
import React from 'react';
import { Typography } from '@mui/material';

const WishlistSection = () => {
  return (
    <>
      <Typography variant="h5" className="section-header">
        Wishlist
      </Typography>
      <Typography variant="body1">
        View items you've saved for later.
      </Typography>
    </>
  );
};

export default WishlistSection;
