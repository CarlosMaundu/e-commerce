// src/components/profile/invoices/InvoicesSection.js
import React from 'react';
import { Typography } from '@mui/material';

const InvoicesSection = () => {
  return (
    <>
      <Typography variant="h5" className="section-header">
        My Invoices
      </Typography>
      <Typography variant="body1">Manage your Invoices here.</Typography>
    </>
  );
};

export default InvoicesSection;
