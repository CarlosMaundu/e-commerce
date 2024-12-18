// src/components/layout/CustomerExperienceSection.js
import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Grid, Skeleton } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import SecurityIcon from '@mui/icons-material/Security';

const CustomerExperienceSection = () => {
  const [loading, setLoading] = useState(true);

  // Simulate lazy loading, for demonstration only
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000); // Load after 1 second
    return () => clearTimeout(timer);
  }, []);

  const topHeading =
    'Innovative Solutions for Modern Challenges, Your Success, Our Commitment';
  const topParagraph1 =
    'We curate top-notch products to meet your everyday needs. Discover a range of quality items tailored for your comfort, style, and convenience.';
  const topParagraph2 =
    'From fast shipping to exceptional after-sales support, we ensure you have the best shopping experience. Start exploring and elevate your lifestyle with us.';

  const features = [
    {
      icon: <SecurityIcon sx={{ fontSize: 32, color: '#ff405c' }} />,
      title: 'Fresh Insights',
      description:
        'Stay updated with the latest trends and collections carefully selected by our experts.',
    },
    {
      icon: <ShoppingCartIcon sx={{ fontSize: 32, color: '#1f95f8' }} />,
      title: 'Trending Now',
      description:
        'Our store features the most in-demand products that keep you ahead in style and functionality.',
    },
    {
      icon: <LocalShippingIcon sx={{ fontSize: 32, color: '#2196f3' }} />,
      title: 'Daily Highlights',
      description:
        'Explore new arrivals and daily specials that bring excitement to your shopping journey.',
    },
  ];

  return (
    <Box sx={{ fontFamily: 'sans-serif', p: 4, mb: 8 }}>
      {' '}
      <Box sx={{ maxWidth: { md: '1000px', xs: '300px' }, mx: 'auto' }}>
        {/* Top section: Heading and paragraphs */}
        <Grid container spacing={3}>
          <Grid item md={6} xs={12}>
            {loading ? (
              <>
                <Skeleton variant="text" width="80%" height={40} />
                <Skeleton variant="text" width="90%" height={40} />
              </>
            ) : (
              <Typography
                sx={{
                  color: 'gray.600',
                  fontSize: { xs: '1.5rem', md: '2rem' },
                  fontWeight: '600',
                  mb: 2,
                  lineHeight: 1.4,
                }}
              >
                {topHeading}
              </Typography>
            )}
          </Grid>
          <Grid item md={6} xs={12}>
            {loading ? (
              <>
                <Skeleton variant="text" width="100%" />
                <Skeleton variant="text" width="90%" />
                <Skeleton variant="text" width="80%" />
                <Skeleton
                  variant="rectangular"
                  width={100}
                  height={35}
                  sx={{ mt: 2, borderRadius: '4px' }}
                />
              </>
            ) : (
              <Box textAlign="left">
                <Typography
                  sx={{ mb: 2, fontSize: '0.9rem', color: 'gray.500' }}
                >
                  {topParagraph1}
                </Typography>
                <Typography sx={{ fontSize: '0.9rem', color: 'gray.500' }}>
                  {topParagraph2}
                </Typography>
                <Button
                  type="button"
                  sx={{
                    mt: 3,
                    px: 3,
                    py: 1,
                    borderRadius: '4px',
                    textTransform: 'none',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    color: '#fff',
                    backgroundColor: '#007bff',
                    '&:hover': { backgroundColor: '#0056b3' },
                  }}
                  href="/products"
                >
                  Get started
                </Button>
              </Box>
            )}
          </Grid>
        </Grid>

        {/* Features section */}
        <Grid
          container
          spacing={3}
          sx={{ mt: 8 }}
          columns={{ xs: 1, sm: 2, md: 3 }}
        >
          {features.map((feat, idx) => (
            <Grid item xs={1} sm={1} md={1} key={idx}>
              {loading ? (
                <>
                  <Skeleton variant="circular" width={40} height={40} />
                  <Skeleton variant="text" width="60%" sx={{ mt: 2 }} />
                  <Skeleton variant="text" width="80%" />
                </>
              ) : (
                <Box>
                  {feat.icon}
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      sx={{
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        color: 'gray.600',
                        mb: 1,
                      }}
                    >
                      {feat.title}
                    </Typography>
                    <Typography sx={{ color: 'gray.500', fontSize: '0.9rem' }}>
                      {feat.description}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
};

export default CustomerExperienceSection;
