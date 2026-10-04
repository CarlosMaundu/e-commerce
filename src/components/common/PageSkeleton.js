// src/components/common/PageSkeleton.js — placeholder shapes shown while a
// page's data (or the signed-in session) loads, instead of "Loading…" text.
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Container, Grid, Skeleton, Stack } from '@mui/material';

const TableSkeleton = ({ rows = 8 }) => (
  <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
    <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
      <Skeleton variant="rounded" height={40} sx={{ flex: 1 }} />
      <Skeleton variant="rounded" height={40} width={120} />
      <Skeleton variant="rounded" height={40} width={120} />
    </Stack>
    {Array.from({ length: rows }, (_, i) => (
      <Skeleton key={i} variant="text" height={44} />
    ))}
  </Box>
);
TableSkeleton.propTypes = { rows: PropTypes.number };

/**
 * variant: 'page' (storefront: title + content and side card),
 * 'admin' (header + table), 'cart' (rows + summary), 'form' (cards).
 */
const PageSkeleton = ({ variant = 'page' }) => {
  if (variant === 'admin') {
    return (
      <Box data-testid="page-loading" aria-busy="true">
        <Skeleton variant="text" width={160} />
        <Skeleton variant="text" width={260} height={52} sx={{ mb: 3 }} />
        <TableSkeleton />
      </Box>
    );
  }
  if (variant === 'form') {
    return (
      <Grid container spacing={3} data-testid="page-loading" aria-busy="true">
        {[0, 1].map((i) => (
          <Grid item xs={12} md={6} key={i}>
            <Skeleton variant="rounded" height={300} />
          </Grid>
        ))}
      </Grid>
    );
  }
  const cart = variant === 'cart';
  return (
    <Container
      maxWidth="xl"
      sx={{ py: { xs: 3, md: 5 } }}
      data-testid="page-loading"
      aria-busy="true"
    >
      <Skeleton variant="text" width={220} height={52} sx={{ mb: 3 }} />
      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          <Stack spacing={2}>
            {Array.from({ length: cart ? 3 : 4 }, (_, i) => (
              <Stack key={i} direction="row" spacing={2} alignItems="center">
                <Skeleton
                  variant="rounded"
                  width={cart ? 88 : 56}
                  height={cart ? 88 : 56}
                />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="35%" />
                </Box>
                <Skeleton variant="text" width={64} />
              </Stack>
            ))}
          </Stack>
        </Grid>
        <Grid item xs={12} md={4}>
          <Skeleton variant="rounded" height={cart ? 280 : 220} />
        </Grid>
      </Grid>
    </Container>
  );
};

PageSkeleton.propTypes = {
  variant: PropTypes.oneOf(['page', 'admin', 'cart', 'form']),
};

export default PageSkeleton;
