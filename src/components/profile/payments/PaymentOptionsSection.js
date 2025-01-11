// src/components/profile/payments/PaymentOptionsSection.js
import React from 'react';
import { Typography } from '@mui/material';

const PaymentOptionsSection = () => {
  return (
    <>
      <Typography variant="h5" className="section-header">
        My Payment Options
      </Typography>
      <Typography variant="body1">
        Add or manage your payment methods.
      </Typography>
    </>
  );
};

export default PaymentOptionsSection;
