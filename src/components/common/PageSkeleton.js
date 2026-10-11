// src/components/common/PageSkeleton.js — placeholder for a whole page while
// the signed-in session (or the cart) loads, built from the skeleton kit so
// it has the same frames as the page that follows.
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Grid, Skeleton, Stack } from '@mui/material';
import {
  CardSkeleton,
  FieldRowsSkeleton,
  FormSkeleton,
  HeaderSkeleton,
  ItemRowsSkeleton,
  ShopPageSkeleton,
  TableSkeleton,
} from '../skeletons';

/**
 * variant: 'page' (storefront: content beside a side card), 'admin' (header
 * and a table panel), 'cart' (cart lines beside the summary), 'form' (cards
 * of fields).
 */
const PageSkeleton = ({ variant = 'page' }) => {
  if (variant === 'admin') {
    return (
      <Stack spacing={3} data-testid="page-loading" aria-busy="true">
        <HeaderSkeleton actions={1} />
        <TableSkeleton tabs={3} rows={8} columns={6} />
      </Stack>
    );
  }
  if (variant === 'form') {
    return (
      <Grid container spacing={3} data-testid="page-loading" aria-busy="true">
        {[0, 1].map((i) => (
          <Grid item xs={12} md={6} key={i}>
            <CardSkeleton subtitle>
              <FormSkeleton fields={4} columns={1} />
            </CardSkeleton>
          </Grid>
        ))}
      </Grid>
    );
  }
  const cart = variant === 'cart';
  return (
    <ShopPageSkeleton>
      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          <CardSkeleton title={false}>
            <ItemRowsSkeleton rows={cart ? 3 : 4} image={cart ? 88 : 56} />
          </CardSkeleton>
        </Grid>
        <Grid item xs={12} md={4}>
          <CardSkeleton>
            <FieldRowsSkeleton rows={cart ? 4 : 3} />
            {cart && (
              <Box sx={{ mt: 3 }}>
                <Skeleton variant="rounded" height={48} />
              </Box>
            )}
          </CardSkeleton>
        </Grid>
      </Grid>
    </ShopPageSkeleton>
  );
};

PageSkeleton.propTypes = {
  variant: PropTypes.oneOf(['page', 'admin', 'cart', 'form']),
};

export default PageSkeleton;
