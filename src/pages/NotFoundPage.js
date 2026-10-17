// src/pages/NotFoundPage.js
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, Container, Stack, Typography } from '@mui/material';
import { usePageHeader } from '../components/layout/pageHeader';

const NotFoundPage = () => {
  usePageHeader({ title: 'Not found' });
  return (
    <Container
      maxWidth="sm"
      sx={{ py: { xs: 6, md: 10 }, textAlign: 'center' }}
    >
      <Typography variant="h3" component="h1" gutterBottom>
        Page not found
      </Typography>
      <Typography color="text.secondary" paragraph>
        The page you’re looking for doesn’t exist or has moved.
      </Typography>
      {/* Phones: one button per row, full width. */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 1.5, sm: 2 }}
        justifyContent="center"
      >
        <Button component={RouterLink} to="/" variant="contained" size="large">
          Go to home page
        </Button>
        <Button
          component={RouterLink}
          to="/products"
          variant="outlined"
          size="large"
        >
          Browse products
        </Button>
      </Stack>
    </Container>
  );
};

export default NotFoundPage;
