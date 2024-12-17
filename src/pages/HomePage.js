// src/pages/HomePage.js

import React from 'react';
import HeroSection from '../components/layout/HeroSection';
import BrandsSection from '../components/layout/BrandsSection';
import CustomerExperienceSection from '../components/layout/CustomerExperienceSection';
import CuratedPicksSection from '../components/layout/CuratedPicksSection';
import FeaturedProductsSection from '../components/layout/FeaturedProductsSection';
import PromotionalOfferSection from '../components/layout/PromotionalOfferSection';
import NewsletterSection from '../components/layout/NewsletterSection';
import '../styles/homePage.css';

const HomePage = () => {
  return (
    <main>
      <HeroSection />
      <BrandsSection />
      <CustomerExperienceSection />
      <CuratedPicksSection />
      <FeaturedProductsSection />
      <PromotionalOfferSection />
      <NewsletterSection />
    </main>
  );
};

export default HomePage;
