// src/components/layout/PromotionalOfferSection.js

import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Skeleton } from '@mui/material';
import promotionImage from '../../images/promotion-offer.jpg';

const PromotionalOfferSection = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate data fetching or image loading
    const timer = setTimeout(() => setLoading(false), 1500); // 1.5 seconds delay
    return () => clearTimeout(timer);
  }, []);

  return (
    <Box
      component="section"
      sx={{
        maxWidth: '1530px',
        mx: 'auto',
        px: { xs: 2, md: 4 },
        mt: 4,
        position: 'relative',
        textAlign: 'center',
      }}
    >
      {loading ? (
        // Loading State with Skeletons
        <Box sx={{ position: 'relative' }}>
          {/* Image Skeleton */}
          <Skeleton
            variant="rectangular"
            width="100%"
            height={{ xs: '30vh', md: '40vh' }}
            sx={{ borderRadius: '8px' }}
          />
          {/* Overlay Skeleton */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: { xs: '90%', md: '50%' },
            }}
          >
            <Skeleton variant="text" width="80%" height={40} />
            <Skeleton
              variant="rectangular"
              width={150}
              height={35}
              sx={{ mt: 2, mx: 'auto' }}
            />
          </Box>
        </Box>
      ) : (
        // Loaded State with Promotional Content
        <Box sx={{ position: 'relative' }}>
          {/* Promotional Image */}
          <Box
            component="img"
            src={promotionImage}
            alt="Promotional Offer"
            sx={{
              width: '100%',
              height: { xs: '30vh', md: '40vh' },
              objectFit: 'cover',
              filter: 'brightness(60%)',
              borderRadius: '8px',
            }}
          />
          {/* Overlay Content */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'white',
              maxWidth: { xs: '90%', md: '50%' },
              px: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <Typography
              variant="h4"
              sx={{
                fontWeight: 'light',
                color: '#fff',
                fontSize: { xs: '1.5rem', md: '2rem' },
                mb: 2,
                textShadow: '0px 1px 3px rgba(0, 0, 0, 0.8)',
              }}
            >
              35% off only this Friday and get a special gift.
            </Typography>
            <Button
              href="/products"
              variant="contained"
              sx={{
                textTransform: 'none',
                backgroundColor: '#28a745',
                '&:hover': { backgroundColor: '#218838' },
                padding: '10px 20px',
                borderRadius: '4px',
                fontSize: '1rem',
                fontWeight: '500',
              }}
            >
              Grab It Now
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default PromotionalOfferSection;
