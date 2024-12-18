import React, { useState, useEffect } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { styled, keyframes } from '@mui/system';

// Import images
import chanel from '../../images/brand-chanel.png';
import calvinKlein from '../../images/brand-calvin-klein.png';
import gucci from '../../images/brand-gucci.png';
import apple from '../../images/brand-apple.png';
import champion from '../../images/brand-champion.png';
import samsung from '../../images/brand-samsung.png';
import jordan from '../../images/brand-jordan.png';
import nike from '../../images/brand-nike.png';
import puma from '../../images/brand-puma.png';
import palace from '../../images/brand-palace.png';
import pioneer from '../../images/brand-pioneer.png';

// Scroll animation keyframes
const scrollAnimation = keyframes`
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
`;

// Styled carousel track for infinite scroll
const BrandsCarouselTrack = styled(Box)(({ theme }) => ({
  display: 'flex',
  width: '200%',
  animation: `${scrollAnimation} 20s linear infinite`,
}));

// Styled brand logo container
const BrandLogoBox = styled(Box)(({ theme }) => ({
  flex: '0 0 auto',
  width: '150px',
  height: '80px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: '40px',
  '& img': {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  [theme.breakpoints.down('md')]: {
    width: '100px',
    height: '60px',
    marginRight: '20px',
  },
  [theme.breakpoints.down('sm')]: {
    width: '80px',
    height: '50px',
    marginRight: '15px',
  },
}));

const BrandsSection = () => {
  const [imagesLoaded, setImagesLoaded] = useState(false);

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

  // Duplicate brands for seamless scrolling
  const duplicatedBrands = [...brands, ...brands];

  useEffect(() => {
    // Simulate loading images
    const timer = setTimeout(() => setImagesLoaded(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Box sx={{ py: 6, textAlign: 'center', overflow: 'hidden' }}>
      {/* Title */}
      <Typography
        variant="h4"
        sx={{
          fontWeight: 'light',
          color: '#333',
          mb: 4,
        }}
      >
        Our Brands
      </Typography>

      {/* Carousel */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        <BrandsCarouselTrack>
          {duplicatedBrands.map((brand, index) => (
            <BrandLogoBox key={index}>
              {imagesLoaded ? (
                <img src={brand.logo} alt={brand.name} loading="lazy" />
              ) : (
                <Skeleton
                  variant="rectangular"
                  width="100%"
                  height="100%"
                  animation="wave"
                />
              )}
            </BrandLogoBox>
          ))}
        </BrandsCarouselTrack>
      </Box>
    </Box>
  );
};

export default BrandsSection;
