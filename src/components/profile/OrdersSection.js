// src/components/profile/OrdersSection.js
import React from 'react';
import { Typography } from '@mui/material';

const OrdersSection = () => {
  return (
    <>
      <Typography variant="h5" className="section-header">
        My Orders
      </Typography>
      <Typography variant="body1">
        Here you can view your recent orders.
      </Typography>
    </>
  );
};

export default OrdersSection;
