// src/pages/admin/products/CategoriesPage.js — categories and subcategories.
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Breadcrumbs, Link, Stack, Typography } from '@mui/material';
import ManageCategoryTab from '../../../components/profile/ManageCategoryTab';

const CategoriesPage = () => (
  <Stack spacing={3}>
    <Box>
      <Breadcrumbs aria-label="Breadcrumb">
        <Link component={RouterLink} to="/admin/products" underline="hover">
          Products
        </Link>
        <Typography color="text.primary">Categories</Typography>
      </Breadcrumbs>
      <Typography variant="h3" component="h1" sx={{ mt: 1 }}>
        Categories
      </Typography>
    </Box>
    <ManageCategoryTab />
  </Stack>
);

export default CategoriesPage;
