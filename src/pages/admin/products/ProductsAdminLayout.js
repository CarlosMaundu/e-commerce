// src/pages/admin/products/ProductsAdminLayout.js — the Products area of the
// back office: vertical tabs (Product list, Categories, Brands) beside the
// page, horizontal on small screens.
import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Box, Tab, Tabs, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { FiBox, FiFolder, FiTag } from 'react-icons/fi';

const TABS = [
  { label: 'Product list', to: '/admin/products', icon: <FiBox /> },
  { label: 'Categories', to: '/admin/products/categories', icon: <FiFolder /> },
  { label: 'Brands', to: '/admin/products/brands', icon: <FiTag /> },
];

const ProductsAdminLayout = () => {
  const { pathname } = useLocation();
  const theme = useTheme();
  const vertical = useMediaQuery(theme.breakpoints.up('md'));
  // Product create/edit pages belong to the Product list tab.
  const current =
    TABS.slice(1).find((t) => pathname.startsWith(t.to))?.to || TABS[0].to;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '180px 1fr' },
        gap: { xs: 2, md: 4 },
        alignItems: 'start',
      }}
    >
      <Box
        component="nav"
        aria-label="Products"
        sx={{ position: { md: 'sticky' }, top: { md: 96 } }}
      >
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ display: { xs: 'none', md: 'block' }, px: 2, mb: 1 }}
        >
          Products
        </Typography>
        <Tabs
          value={current}
          orientation={vertical ? 'vertical' : 'horizontal'}
          variant={vertical ? 'standard' : 'scrollable'}
          sx={{
            ...(vertical
              ? {
                  borderRight: 0,
                  '& .MuiTabs-indicator': {
                    left: 0,
                    right: 'auto',
                    width: 3,
                    borderRadius: 2,
                  },
                  '& .MuiTab-root': {
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    minHeight: 44,
                    borderRadius: '8px',
                  },
                  '& .MuiTab-root.Mui-selected': { bgcolor: 'primary.light' },
                }
              : { borderBottom: 1, borderColor: 'divider' }),
          }}
        >
          {TABS.map((t) => (
            <Tab
              key={t.to}
              value={t.to}
              label={t.label}
              icon={t.icon}
              iconPosition="start"
              component={NavLink}
              to={t.to}
              end={t.to === TABS[0].to}
            />
          ))}
        </Tabs>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default ProductsAdminLayout;
