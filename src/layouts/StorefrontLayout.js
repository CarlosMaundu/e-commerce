// src/layouts/StorefrontLayout.js — header, page, footer for shopper pages.
import PageSkeleton from '../components/common/PageSkeleton';
import React, { Suspense } from 'react';
import PropTypes from 'prop-types';
import { Outlet, useLocation } from 'react-router-dom';
import { Box, Stack, Typography } from '@mui/material';
import PageBreadcrumbs from '../components/common/PageBreadcrumbs';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import ImpersonationBanner from '../components/ImpersonationBanner';
import InstallPrompt from '../components/InstallPrompt';
import {
  PageHeaderProvider,
  usePageHeader,
} from '../components/layout/pageHeader';
import { useStore } from '../context/StoreContext';
import MobileBottomNav, {
  BOTTOM_NAV_HEIGHT,
  useShowsBottomNav,
} from './MobileBottomNav';

const AnnouncementBar = () => {
  const { announcement } = useStore();
  if (!announcement) return null;
  return (
    <Box
      role="note"
      sx={{
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        textAlign: 'center',
        px: 2,
        py: 0.75,
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      {announcement}
    </Box>
  );
};

const StorefrontLayout = () => {
  const bottomNav = useShowsBottomNav();
  return (
    <PageHeaderProvider>
      <Box
        sx={{
          minHeight: '100vh',
          '@supports (min-height: 100dvh)': { minHeight: '100dvh' },
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'clip',
        }}
      >
        <ImpersonationBanner />
        <AnnouncementBar />
        <Header />
        <Box component="main" sx={{ flex: 1 }}>
          {/* Pages load when first opened; their skeleton shows meanwhile. */}
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </Box>
        <Footer />
        {/* Room for the phone menu so it never covers the footer. */}
        {bottomNav && (
          <Box
            sx={{
              display: { md: 'none' },
              height: `calc(${BOTTOM_NAV_HEIGHT + 12}px + env(safe-area-inset-bottom))`,
            }}
          />
        )}
        <MobileBottomNav />
        <InstallPrompt />
      </Box>
    </PageHeaderProvider>
  );
};

/** Frame for account sub-pages: back link, title, optional action. */
export const AccountPage = ({
  title,
  subtitle,
  action,
  children,
  back = '/account',
  backLabel = 'My account',
  barTitle,
  barActions = null,
}) => {
  const here = useLocation().pathname;
  // Phones: the title goes in the header bar (Back · title · actions), so the
  // page itself starts with its content.
  usePageHeader({
    title: barTitle || (typeof title === 'string' ? title : ''),
    actions: barActions,
  });
  // Sits inside AccountLayout, which provides the width and the sidebar.
  return (
    <Box>
      <PageBreadcrumbs
        sx={{ mb: 1.5 }}
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
        spacing={{ xs: 1.5, md: 2 }}
        sx={{ mb: { xs: 2, md: 3 } }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{ display: { xs: 'none', md: 'block' } }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              color="text.secondary"
              sx={{
                mt: { md: 0.5 },
                fontSize: { xs: '0.85rem', md: undefined },
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      {children}
    </Box>
  );
};
AccountPage.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  action: PropTypes.node,
  children: PropTypes.node,
  back: PropTypes.string,
  backLabel: PropTypes.string,
  /** Phones: header-bar title when `title` isn't plain text, or shorter. */
  barTitle: PropTypes.string,
  /** Phones: icon buttons for the header bar. */
  barActions: PropTypes.node,
};

export default StorefrontLayout;
