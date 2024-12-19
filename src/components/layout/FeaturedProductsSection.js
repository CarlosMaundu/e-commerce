// src/components/layout/FeaturedProductsSection.js
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../../redux/productsSlice';
import ProductCard from '../common/ProductCard';
import { Box, Typography, Grid, IconButton, Skeleton } from '@mui/material';
import { ArrowBackIos, ArrowForwardIos } from '@mui/icons-material';

const FeaturedProductsSection = () => {
  const dispatch = useDispatch();
  const { products, loading, error } = useSelector((state) => state.products);

  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 15; // 3 rows * 5 columns
  const maxSlides = 2; // Limit to two slides

  useEffect(() => {
    dispatch(fetchProducts());
  }, [dispatch]);

  const totalPages = Math.min(
    maxSlides,
    Math.ceil(products.length / productsPerPage)
  );

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const indexOfFirstProduct = (currentPage - 1) * productsPerPage;
  const currentProducts = products.slice(
    indexOfFirstProduct,
    indexOfFirstProduct + productsPerPage
  );

  const skeletonCount = 15; // number of skeleton placeholders

  return (
    <Box
      component="section"
      sx={{
        maxWidth: '1230px',
        mx: 'auto',
        px: 2,
        mt: 4,
        mb: 8, // Added margin-bottom for space between sections
        fontFamily: 'Arial, sans-serif',
        textAlign: 'center',
      }}
    >
      {/* Title similar to Curated Picks */}
      <Typography
        variant="h4"
        sx={{
          fontWeight: 'light',
          color: '#333',
          mb: 4,
        }}
      >
        Featured Products
      </Typography>

      {loading ? (
        // Show Skeleton placeholders in a responsive grid
        <Box sx={{ position: 'relative' }}>
          <Grid container spacing={3} justifyContent="center">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <Grid item xs={6} sm={4} md={2.4} key={`skeleton-${i}`}>
                <Box sx={{ borderRadius: '8px', overflow: 'hidden' }}>
                  <Skeleton variant="rectangular" width="100%" height={200} />
                  <Skeleton variant="text" sx={{ mt: 1, width: '80%' }} />
                  <Skeleton variant="text" sx={{ width: '60%' }} />
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      ) : error ? (
        <Typography
          variant="body1"
          sx={{ color: 'red', fontSize: '1.2rem', mt: 2 }}
        >
          Error loading products. Please try again later.
        </Typography>
      ) : currentProducts.length > 0 ? (
        <Box sx={{ position: 'relative' }}>
          {/* Left Arrow */}
          <IconButton
            onClick={handlePrev}
            disabled={currentPage === 1}
            aria-label="Previous Page"
            sx={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              left: '-40px',
              backgroundColor: 'rgba(255,255,255,0.8)',
              borderRadius: '50%',
              p: '8px',
              zIndex: 10,
              '&:hover': {
                backgroundColor: 'rgba(0,123,255,0.8)',
                color: '#fff',
              },
              '&:disabled': {
                backgroundColor: '#ccc',
                color: '#888',
                cursor: 'not-allowed',
              },
              '@media (max-width:768px)': { display: 'none' },
            }}
          >
            <ArrowBackIos />
          </IconButton>

          <Grid
            container
            spacing={3}
            justifyContent="center"
            sx={{
              overflow: 'hidden',
            }}
          >
            {currentProducts.map((product) => (
              <Grid item xs={6} sm={4} md={2.4} key={product.id}>
                <ProductCard product={product} />
              </Grid>
            ))}
          </Grid>

          {/* Right Arrow */}
          <IconButton
            onClick={handleNext}
            disabled={currentPage === totalPages}
            aria-label="Next Page"
            sx={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              right: '-40px',
              backgroundColor: 'rgba(255,255,255,0.8)',
              borderRadius: '50%',
              p: '8px',
              zIndex: 10,
              '&:hover': {
                backgroundColor: 'rgba(0,123,255,0.8)',
                color: '#fff',
              },
              '&:disabled': {
                backgroundColor: '#ccc',
                color: '#888',
                cursor: 'not-allowed',
              },
              '@media (max-width:768px)': { display: 'none' },
            }}
          >
            <ArrowForwardIos />
          </IconButton>
        </Box>
      ) : (
        // No products found
        <Typography variant="h6" sx={{ mt: 2 }}>
          No products found.
        </Typography>
      )}
    </Box>
  );
};

export default FeaturedProductsSection;
