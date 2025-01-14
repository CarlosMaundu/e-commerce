// src/components/profile/users/UsersSection.js
import React from 'react';
import { Typography } from '@mui/material';

const UsersSection = () => {
  return (
    <>
      <Typography variant="h5" className="section-header">
        My Users
      </Typography>
      <Typography variant="body1">Manage your Customers here.</Typography>
    </>
  );
};

export default UsersSection;
