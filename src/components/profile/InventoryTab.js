// src/components/profile/InventoryTab.js

import React from 'react';
import { Box, Card, Typography } from '@mui/material';
import { HourglassEmpty as HourglassEmptyIcon } from '@mui/icons-material';

const InventoryTab = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '300px',
      }}
    >
      <Card
        sx={{
          p: 4,
          textAlign: 'center',
          boxShadow: 3,
          borderRadius: 2,
        }}
      >
        <HourglassEmptyIcon sx={{ fontSize: 60, color: 'text.secondary' }} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Coming Soon
        </Typography>
      </Card>
    </Box>
  );
};

export default InventoryTab;
