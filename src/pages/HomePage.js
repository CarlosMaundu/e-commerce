// src/pages/HomePage.js

import React from 'react';
import HeroSection from '../components/HeroSection';
import BrandsSection from '../components/BrandsSection';
import CustomerExperienceSection from '../components/CustomerExperienceSection';
import CuratedPicksSection from '../components/CuratedPicksSection';
import FeaturedProductsSection from '../components/FeaturedProductsSection';
import PromotionalOfferSection from '../components/PromotionalOfferSection';
import NewsletterSection from '../components/NewsletterSection';
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
