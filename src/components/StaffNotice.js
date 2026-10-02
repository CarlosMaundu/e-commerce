// src/components/StaffNotice.js — shown to back-office users on shopping pages.
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, Container, Stack } from '@mui/material';
import { FiUsers } from 'react-icons/fi';
import { EmptyState } from './ui';

const StaffNotice = () => (
  <Container maxWidth="md" sx={{ py: 8 }}>
    <EmptyState
      icon={<FiUsers />}
      title="Back-office accounts don’t shop"
      action={
        <Stack direction="row" spacing={1} justifyContent="center">
          <Button component={RouterLink} to="/admin/users" variant="contained">
            Find a customer
          </Button>
          <Button component={RouterLink} to="/admin">
            Back office
          </Button>
        </Stack>
      }
    >
      To place an order or fix a customer’s cart, open the customer in Users and
      choose “View as customer”. Everything you do is recorded.
    </EmptyState>
  </Container>
);

export default StaffNotice;
