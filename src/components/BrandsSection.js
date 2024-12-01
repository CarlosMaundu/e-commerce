// src/components/BrandsSection.js

import React from 'react';
import '../styles/brandsSection.css'; // Import the correct CSS file
import chanel from '../images/brand-chanel.png';
import calvinKlein from '../images/brand-calvin-klein.png';
import gucci from '../images/brand-gucci.png';
import apple from '../images/brand-apple.png';
import champion from '../images/brand-champion.png';
import samsung from '../images/brand-samsung.png';
import jordan from '../images/brand-jordan.png';
import nike from '../images/brand-nike.png';
import puma from '../images/brand-puma.png';
import palace from '../images/brand-palace.png';
import pioneer from '../images/brand-pioneer.png';

const BrandsSection = () => {
  const brands = [
    { id: 1, name: 'Chanel', logo: chanel },
    { id: 2, name: 'Calvin Klein', logo: calvinKlein },
    { id: 3, name: 'Gucci', logo: gucci },
    { id: 4, name: 'Apple', logo: apple },
    { id: 5, name: 'Champion', logo: champion },
    { id: 6, name: 'Samsung', logo: samsung },
    { id: 7, name: 'Jordan', logo: jordan },
    { id: 8, name: 'Nike', logo: nike },
    { id: 9, name: 'Puma', logo: puma },
    { id: 10, name: 'Palace', logo: palace },
    { id: 11, name: 'Pioneer', logo: pioneer },
  ];

  // Duplicate the brands array for seamless scrolling
  const duplicatedBrands = [...brands, ...brands];

  return (
    <section className="brands-section">
      <h2>Our Brands</h2>
      <div className="brands-carousel">
        <div className="brands-carousel__track">
          {duplicatedBrands.map((brand, index) => (
            <div key={index} className="brand-logo">
              <img src={brand.logo} alt={brand.name} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BrandsSection;
