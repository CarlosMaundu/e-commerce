// src/components/PromotionalOfferSection.js

import React from 'react';
import '../styles/homePage.css';
import promotionImage from '../images/promotion-offer.jpg';

const PromotionalOfferSection = () => {
  return (
    <section className="promotional-offer-section">
      <img
        src={promotionImage}
        alt="Promotional Offer"
        className="promotion-image"
      />
      <div className="promotion-content">
        <h2>35% off only this Friday and get a special gift.</h2>
        <a href="/products" className="cta-button">
          Grab It Now
        </a>
      </div>
    </section>
  );
};

export default PromotionalOfferSection;
