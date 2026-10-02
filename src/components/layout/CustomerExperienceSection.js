// src/components/layout/CustomerExperienceSection.js — "why shop with us",
// full content width like the other home sections.
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Grid, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { FiArrowRight, FiStar, FiTrendingUp, FiZap } from 'react-icons/fi';

const FEATURES = [
  {
    icon: <FiStar />,
    color: '#E5484D',
    title: 'Fresh insights',
    text: 'Stay updated with the latest trends and collections, carefully selected by our team.',
    to: '/products?tag=new-season',
  },
  {
    icon: <FiTrendingUp />,
    color: '#2F7CF6',
    title: 'Trending now',
    text: 'The most in-demand products this week, so you’re always ahead in style and function.',
    to: '/products?sort=popular',
  },
  {
    icon: <FiZap />,
    color: '#12A150',
    title: 'Daily highlights',
    text: 'New arrivals and daily specials that bring something new to every visit.',
    to: '/products?on_sale=1',
  },
];

const CustomerExperienceSection = () => (
  <Box component="section" aria-labelledby="experience-title">
    <Grid container spacing={{ xs: 2, md: 6 }} alignItems="center">
      <Grid item xs={12} md={6}>
        <Typography
          variant="h3"
          component="h2"
          id="experience-title"
          sx={{ lineHeight: 1.3 }}
        >
          Innovative solutions for modern challenges. Your success, our
          commitment.
        </Typography>
      </Grid>
      <Grid item xs={12} md={6}>
        <Typography color="text.secondary" sx={{ mb: 1.5 }}>
          We curate top-notch products for your everyday needs, chosen for
          comfort, style and convenience.
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2.5 }}>
          From fast delivery to helpful after-sales support, we make shopping
          easy. Start exploring.
        </Typography>
        <Button
          variant="contained"
          component={RouterLink}
          to="/products"
          endIcon={<FiArrowRight />}
        >
          Get started
        </Button>
      </Grid>
    </Grid>
    <Box
      sx={{
        mt: { xs: 4, md: 5 },
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        gap: 2,
      }}
    >
      {FEATURES.map((f) => (
        <Stack
          key={f.title}
          component={RouterLink}
          to={f.to}
          spacing={1.25}
          sx={{
            p: 3,
            borderRadius: 1,
            bgcolor: 'background.neutral',
            color: 'text.primary',
            textDecoration: 'none',
            transition: 'background-color .15s',
            '&:hover': { bgcolor: 'background.neutralDeep' },
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '8px',
              display: 'grid',
              placeItems: 'center',
              fontSize: 22,
              color: f.color,
              bgcolor: alpha(f.color, 0.12),
            }}
          >
            {f.icon}
          </Box>
          <Typography variant="h6" component="h3">
            {f.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {f.text}
          </Typography>
        </Stack>
      ))}
    </Box>
  </Box>
);

export default CustomerExperienceSection;
