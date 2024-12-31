// src/components/common/ProductGrid.js

import React from 'react';
import { Grid, Typography, Skeleton, Box } from '@mui/material';
import ProductCard from './ProductCard';

const ProductGrid = ({ products, columns = 4, loading = false }) => {
  const xsValue = 12 / columns;

  // Number of skeleton placeholders to show while loading
  const skeletonCount = columns * 2; // Adjust as needed

  return (
    <Grid container spacing={2}>
      {loading ? (
        // Show skeleton placeholders
        Array.from({ length: skeletonCount }).map((_, i) => (
          <Grid item xs={xsValue} key={`skeleton-${i}`}>
            <Box sx={{ borderRadius: '4px', overflow: 'hidden' }}>
              <Skeleton variant="rectangular" width="100%" height={250} />
              <Skeleton variant="text" sx={{ mt: 1, width: '80%' }} />
              <Skeleton variant="text" sx={{ width: '60%' }} />
            </Box>
          </Grid>
        ))
      ) : products && products.length > 0 ? (
        products.map((product) => (
          <Grid item xs={xsValue} key={product.id}>
            <ProductCard product={product} />
          </Grid>
        ))
      ) : (
        // No products found and not loading
        <Grid item xs={12}>
          <Typography variant="h6" sx={{ textAlign: 'center', mt: 2 }}>
            No products found.
          </Typography>
        </Grid>
      )}
    </Grid>
  );
};

export default ProductGrid;
