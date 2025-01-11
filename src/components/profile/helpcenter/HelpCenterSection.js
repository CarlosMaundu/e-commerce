// src/components/profile/HelpCenterSection.js

import React from 'react';
import { Box, Typography, Card } from '@mui/material';
import { HelpOutline as HelpOutlineIcon } from '@mui/icons-material';

const HelpCenterSection = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '60vh',
      }}
    >
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <HelpOutlineIcon sx={{ fontSize: 60, color: 'grey.500', mb: 2 }} />
        <Typography variant="h5" color="grey.500">
          Help Center
        </Typography>
        <Typography variant="body1" color="grey.500">
          Find answers to common questions and get support.
        </Typography>
      </Card>
    </Box>
  );
};

export default HelpCenterSection;
