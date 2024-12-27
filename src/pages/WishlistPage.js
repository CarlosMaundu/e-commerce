// src/pages/WishlistPage.js

import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, IconButton, Skeleton } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { removeFromWishlist } from '../redux/wishlistSlice';
import CloseIcon from '@mui/icons-material/Close';
import ProductCard from '../components/common/ProductCard'; // Ensure correct path

const WishlistPage = () => {
  const dispatch = useDispatch();

  // Retrieve wishlist items from Redux
  const wishlistItems = useSelector((state) => state.wishlist.items);

  // Simulate loading state (replace with actual loading state if available)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate data fetching delay
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleRemoveFromWishlist = (id) => {
    dispatch(removeFromWishlist(id));
  };

  return (
    <Box
      sx={{
        fontFamily: 'Roboto, sans-serif',
        backgroundColor: '#f9fafb', // Tailwind's bg-gray-50 equivalent
        px: 4,
        py: 8,
        mx: 'auto',
        maxWidth: { lg: '1024px', md: '768px', sm: '600px' },
      }}
    >
      {/* Page Title */}
      <Typography
        variant="h4"
        sx={{
          textAlign: 'center',
          fontWeight: 'extrabold',
          color: '#1f2937', // Tailwind's text-gray-800
          mb: 12,
        }}
      >
        My Wishlist
      </Typography>

      {/* Wishlist Grid */}
      <Grid
        container
        spacing={6}
        sx={{
          gridTemplateColumns: {
            xs: 'repeat(1, 1fr)',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
          display: 'grid',
          gap: '24px',
        }}
      >
        {loading ? (
          // Render Skeletons while loading
          Array.from({ length: 8 }).map((_, index) => (
            <Box
              key={index}
              sx={{
                backgroundColor: '#fff',
                p: 3,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                borderRadius: '8px',
                transition: 'transform 0.3s',
                '&:hover': {
                  transform: 'scale(1.03)',
                },
              }}
            >
              {/* Image Skeleton */}
              <Skeleton
                variant="rectangular"
                width="100%"
                height={130}
                sx={{
                  bgcolor: '#e0e0e0',
                  borderRadius: '8px',
                }}
              />
              {/* Product Name Skeleton */}
              <Skeleton variant="text" width="80%" height={24} sx={{ mt: 2 }} />
              {/* Price Skeleton */}
              <Skeleton variant="text" width="60%" height={28} sx={{ mt: 1 }} />
            </Box>
          ))
        ) : // Render Wishlist Items
        wishlistItems.length > 0 ? (
          wishlistItems.map((item) => (
            <Box key={item.id}>
              <ProductCard product={item} />
              {/* Overlay Remove Button if needed */}
              <IconButton
                onClick={() => handleRemoveFromWishlist(item.id)}
                sx={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  color: '#ff1744',
                  backgroundColor: 'rgba(255, 23, 68, 0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 23, 68, 0.2)',
                  },
                }}
                aria-label={`Remove ${item.title} from wishlist`}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          ))
        ) : (
          // Message when Wishlist is empty
          <Typography
            variant="h6"
            sx={{
              color: '#888',
              textAlign: 'center',
              gridColumn: '1 / -1',
              mt: 4,
            }}
          >
            Your wishlist is empty.
          </Typography>
        )}
      </Grid>
    </Box>
  );
};

export default WishlistPage;
