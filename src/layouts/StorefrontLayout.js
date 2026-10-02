// src/layouts/StorefrontLayout.js — header, page, footer for shopper pages.
import React from 'react';
import PropTypes from 'prop-types';
import { Outlet, useLocation } from 'react-router-dom';
import { Box, Container, Stack, Typography } from '@mui/material';
import PageBreadcrumbs from '../components/common/PageBreadcrumbs';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import ImpersonationBanner from '../components/ImpersonationBanner';

const StorefrontLayout = () => (
  <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
    <ImpersonationBanner />
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
}) => {
  const here = useLocation().pathname;
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <PageBreadcrumbs
        sx={{ mb: 2 }}
        items={[
          { label: 'Home', to: '/' },
          { label: backLabel, to: back },
          ...(here && here !== back ? [{ label: title, to: here }] : []),
        ]}
      />
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
};
AccountPage.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  action: PropTypes.node,
  children: PropTypes.node,
  back: PropTypes.string,
  backLabel: PropTypes.string,
};

export default StorefrontLayout;
