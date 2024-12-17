// src/components/layout/HeroSection.js

import React from 'react';
import Slider from 'react-slick';
import '../../styles/heroSection.css';
import banner1 from '../../images/banner-image1.jpg';
import banner2 from '../../images/banner-image2.jpg';
import banner3 from '../../images/banner-image3.jpg';
import banner4 from '../../images/banner-image4.jpg';

import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

const HeroSection = () => {
  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
  };

  const banners = [banner1, banner2, banner3, banner4];

  return (
    <section className="hero-section">
      <Slider {...settings}>
        {banners.map((banner, index) => (
          <div key={index} className="banner-slide">
            <img
              src={banner}
              alt={`Banner ${index + 1}`}
              className="banner-image"
            />
            <div className="banner-content">
              <h1>Level up your style with our summer collections.</h1>
              <a href="/products" className="cta-button">
                Shop Now
              </a>
            </div>
          </div>
        ))}
      </Slider>
    </section>
  );
};

export default HeroSection;
