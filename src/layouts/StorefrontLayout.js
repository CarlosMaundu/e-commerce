// src/layouts/StorefrontLayout.js — header, page, footer for shopper pages.
import React from 'react';
import PropTypes from 'prop-types';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import { Box, Container, Stack, Typography } from '@mui/material';
import { FiChevronLeft } from 'react-icons/fi';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';

const StorefrontLayout = () => (
  <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
    <Header />
    <Box component="main" sx={{ flex: 1 }}>
      <Outlet />
    </Box>
    <Footer />
  </Box>
);

/** Frame for account sub-pages: back link, title, optional action. */
export const AccountPage = ({
  title,
  subtitle,
  action,
  children,
  back = '/account',
  backLabel = 'My account',
}) => (
  <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
    <Typography
      component={RouterLink}
      to={back}
      variant="body2"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        color: 'text.secondary',
        textDecoration: 'none',
        mb: 2,
        '&:hover': { color: 'primary.main' },
      }}
    >
      <FiChevronLeft /> {backLabel}
    </Typography>
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ sm: 'flex-end' }}
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Box>
        <Typography variant="h3" component="h1">
          {title}
        </Typography>
        {subtitle && (
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
    {children}
  </Container>
);
AccountPage.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  action: PropTypes.node,
  children: PropTypes.node,
  back: PropTypes.string,
  backLabel: PropTypes.string,
};

export default StorefrontLayout;
