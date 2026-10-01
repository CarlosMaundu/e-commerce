// src/pages/NotFoundPage.js
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, Container, Stack, Typography } from '@mui/material';

const NotFoundPage = () => (
  <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 }, textAlign: 'center' }}>
    <Typography variant="h3" component="h1" gutterBottom>
      Page not found
    </Typography>
    <Typography color="text.secondary" paragraph>
      The page you’re looking for doesn’t exist or has moved.
    </Typography>
    <Stack direction="row" spacing={2} justifyContent="center">
      <Button component={RouterLink} to="/" variant="contained">
        Go to home page
      </Button>
      <Button component={RouterLink} to="/products" variant="outlined">
        Browse products
      </Button>
    </Stack>
  </Container>
);

export default NotFoundPage;
