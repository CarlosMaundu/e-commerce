// src/components/profile/CustomerDashboardSection.js
import React from 'react';
import { Box, Typography } from '@mui/material';

const CustomerDashboardSection = () => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        My Dashboard
      </Typography>
      <Typography variant="body1">
        Here you can view your recent orders, saved items, etc.
      </Typography>
      {/* Add customer-specific dashboard content */}
    </Box>
  );
};

export default CustomerDashboardSection;
