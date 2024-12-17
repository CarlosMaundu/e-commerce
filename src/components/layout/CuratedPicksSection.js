// src/components/layout/CuratedPicksSection.js

import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/homePage.css';
import bestSeller from '../../images/curated-pick1.png';
import shopMen from '../../images/curated-pick2.png';
import shopWomen from '../../images/curated-pick3.png';
import shopCasual from '../../images/curated-pick4.png';

const CuratedPicksSection = () => {
  const curatedPicks = [
    {
      id: 1,
      title: 'Best Seller',
      image: bestSeller,
      link: '/categories/best-seller',
    },
    {
      id: 2,
      title: 'Shop Men',
      image: shopMen,
      link: '/categories/shop-men',
    },
    {
      id: 3,
      title: 'Shop Women',
      image: shopWomen,
      link: '/categories/shop-women',
    },
    {
      id: 4,
      title: 'Shop Casual',
      image: shopCasual,
      link: '/categories/shop-casual',
    },
  ];

  return (
    <section className="curated-picks-section">
      <h2>Curated Picks</h2>
      <div className="curated-picks-grid">
        {curatedPicks.map((pick) => (
          <Link to={pick.link} key={pick.id} className="curated-pick-card">
            <img
              src={pick.image}
              alt={pick.title}
              className="curated-pick-image"
            />
            <div className="curated-pick-overlay">
              <h3>{pick.title}</h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default CuratedPicksSection;
