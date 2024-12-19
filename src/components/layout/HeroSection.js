// src/components/layout/HeroSection.js
import React, { useRef } from 'react';
import Slider from 'react-slick';
import { Box, Typography, Button } from '@mui/material';
import { ArrowForwardIos, ArrowBackIos } from '@mui/icons-material';
import banner1 from '../../images/banner-image1.jpg';
import banner2 from '../../images/banner-image2.jpg';
import banner3 from '../../images/banner-image3.jpg';
import banner4 from '../../images/banner-image4.jpg';

import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

// Custom Arrow components
const NextArrow = ({ onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      position: 'absolute',
      top: '50%',
      right: '10px',
      zIndex: 2,
      transform: 'translateY(-50%)',
      cursor: 'pointer',
      color: '#fff',
      backgroundColor: 'rgba(0,0,0,0.5)',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' },
    }}
  >
    <ArrowForwardIos sx={{ fontSize: '1.2rem', color: '#fff' }} />
  </Box>
);

const PrevArrow = ({ onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      position: 'absolute',
      top: '50%',
      left: '10px',
      zIndex: 2,
      transform: 'translateY(-50%)',
      cursor: 'pointer',
      color: '#fff',
      backgroundColor: 'rgba(0,0,0,0.5)',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' },
    }}
  >
    <ArrowBackIos sx={{ fontSize: '1.2rem', color: '#fff' }} />
  </Box>
);

const HeroSection = () => {
  const sliderRef = useRef(null);

  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    fade: true, // Enable fade transition
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    arrows: true,
    nextArrow: <NextArrow />,
    prevArrow: <PrevArrow />,
    pauseOnHover: true,
    appendDots: (dots) => (
      <Box component="ul" sx={{ m: 0, p: 0 }}>
        {dots}
      </Box>
    ),
    customPaging: (i) => (
      <Box
        sx={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: '#fff',
          opacity: 0.7,
          cursor: 'pointer',
          '&:hover': { opacity: 1 },
        }}
      />
    ),
  };

  const banners = [banner1, banner2, banner3, banner4];

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
        borderBottomLeftRadius: '8px',
        borderBottomRightRadius: '8px',
        overflow: 'hidden',
        // Override slick dots styling
        '& .slick-dots': {
          bottom: '20px',
          '& li button:before': {
            fontSize: '10px',
            color: '#fff',
            opacity: 0.7,
          },
          '& li.slick-active button:before': {
            opacity: 1,
            color: '#fff',
          },
        },
      }}
    >
      <Slider ref={sliderRef} {...settings}>
        {banners.map((banner, index) => (
          <Box key={index} sx={{ position: 'relative' }}>
            <img
              src={banner}
              alt={`Banner ${index + 1}`}
              style={{
                width: '100%',
                height: '80vh', // Increased height
                objectFit: 'cover',
                borderRadius: '8px',
              }}
            />

            {/* Gradient Overlay */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background:
                  'linear-gradient(to bottom, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.7))',
                borderRadius: '8px',
              }}
            />

            {/* Caption */}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#fff',
                maxWidth: { xs: '90%', md: '50%' },
                textAlign: 'center',
                p: { xs: '0 10px', md: 0 },
              }}
            >
              <Typography
                variant="h2"
                sx={{
                  fontSize: { xs: '1.8rem', md: '2.5rem' },
                  mb: 2,
                  textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                Level up your style with our summer collections.
              </Typography>
              <Button
                variant="contained"
                href="/products"
                sx={{
                  backgroundColor: '#007bff',
                  color: '#fff',
                  borderRadius: '4px',
                  textTransform: 'none',
                  px: 2,
                  py: 1,
                  '&:hover': { backgroundColor: '#0056b3' },
                }}
              >
                Shop Now
              </Button>
            </Box>
          </Box>
        ))}
      </Slider>
    </Box>
  );
};

export default HeroSection;
