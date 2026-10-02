// src/pages/HomePage.js — Aurora-style home: hero, brands, getting started,
// curated categories, this week's most viewed, featured products and offers.
// The newsletter lives in the footer.
import React from 'react';
import { Container, Stack } from '@mui/material';
import HeroSection from '../components/layout/HeroSection';
import CustomerExperienceSection from '../components/layout/CustomerExperienceSection';
import {
  BestViewed,
  BrandsStrip,
  CuratedPicks,
  FeaturedGrid,
} from '../components/home/HomeSections';
import { PromoBanner } from '../components/promotions/Promotions';

const HomePage = () => (
  <Container maxWidth="xl" sx={{ pb: { xs: 6, md: 9 } }}>
    <HeroSection />
    <Stack spacing={{ xs: 6, md: 9 }} sx={{ mt: { xs: 5, md: 7 } }}>
      <BrandsStrip />
      <CustomerExperienceSection />
      <CuratedPicks />
      <BestViewed />
      <FeaturedGrid />
      <PromoBanner />
    </Stack>
  </Container>
);

export default HomePage;
