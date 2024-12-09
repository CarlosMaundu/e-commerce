// src/components/profile/AddressBookSection.js
import React from 'react';
import { Typography } from '@mui/material';

const AddressBookSection = () => {
  return (
    <>
      <Typography variant="h5" className="section-header">
        Address Book
      </Typography>
      <Typography variant="body1">Manage your saved addresses here.</Typography>
    </>
  );
};

export default AddressBookSection;
