// src/components/profile/messages/MessagesSection.js
import React from 'react';
import { Typography } from '@mui/material';

const MessagesSection = () => {
  return (
    <>
      <Typography variant="h5" className="section-header">
        My Messages
      </Typography>
      <Typography variant="body1">Manage your messages here.</Typography>
    </>
  );
};

export default MessagesSection;
