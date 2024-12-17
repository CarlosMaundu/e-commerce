// src/components/common/ProductGrid.js

import React from 'react';
import ProductCard from './ProductCard';
import '../../styles/productGrid.css';
import { Grid, Typography } from '@mui/material';

const ProductGrid = ({ products, columns }) => {
  return (
    <Grid container spacing={2}>
      {products.length > 0 ? (
        products.map((product) => (
          <Grid item xs={12 / columns} key={product.id}>
            <ProductCard product={product} />
          </Grid>
        ))
      ) : (
        <Grid item xs={12}>
          <Typography variant="h6">No products found.</Typography>
        </Grid>
      )}
    </Grid>
  );
};

export default ProductGrid;
