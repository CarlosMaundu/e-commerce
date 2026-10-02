// src/components/layout/HeroSection.js — banner carousel for the home page
// (full size) and the product list (compact).
import React from 'react';
import PropTypes from 'prop-types';
import Slider from 'react-slick';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, IconButton, Typography } from '@mui/material';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import banner1 from '../../images/banner-image1.jpg';
import banner2 from '../../images/banner-image2.jpg';
import banner3 from '../../images/banner-image3.jpg';
import banner4 from '../../images/banner-image4.jpg';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

const BANNERS = [
  {
    image: banner1,
    title: 'Level up your style with our new season collection.',
    link: '/products?tag=new-season',
  },
  {
    image: banner2,
    title: 'Up to 35% off selected favourites.',
    link: '/products?on_sale=1',
  },
  {
    image: banner3,
    title: 'Gifts they’ll keep, picked by our team.',
    link: '/products?tag=gift',
  },
  {
    image: banner4,
    title: 'Sound, style and smart tech for every day.',
    link: '/products?featured=1',
  },
];

// react-slick passes onClick (and className/style we don't want).
const Arrow = ({ onClick, side }) => (
  <IconButton
    onClick={onClick}
    aria-label={side === 'left' ? 'Previous banner' : 'Next banner'}
    sx={{
      position: 'absolute',
      top: '50%',
      [side]: 12,
      zIndex: 2,
      transform: 'translateY(-50%)',
      color: '#fff',
      bgcolor: 'rgba(0,0,0,.45)',
      '&:hover': { bgcolor: 'rgba(0,0,0,.65)' },
    }}
  >
    {side === 'left' ? <FiChevronLeft /> : <FiChevronRight />}
  </IconButton>
);

Arrow.propTypes = {
  onClick: PropTypes.func,
  side: PropTypes.oneOf(['left', 'right']).isRequired,
};

const HeroSection = ({ compact = false }) => {
  const height = compact
    ? { xs: 150, sm: 200, md: 240 }
    : { xs: 260, sm: 360, md: 460 };
  return (
    <Box
      component="section"
      aria-roledescription="carousel"
      aria-label="Highlights"
      sx={{
        mt: { xs: 2, md: 3 },
        position: 'relative',
        borderRadius: 1,
        overflow: 'hidden',
        // Slick adds 30px under the slider for its dots; without removing it
        // the rounded bottom corners sit below the image.
        '& .slick-slider, & .slick-dotted.slick-slider': { mb: 0 },
        '& .slick-list': { borderRadius: 1 },
        '& .slick-slide > div': { lineHeight: 0 },
        '& .slick-dots': {
          bottom: 14,
          '& li button:before': { fontSize: 10, color: '#fff', opacity: 0.6 },
          '& li.slick-active button:before': { opacity: 1, color: '#fff' },
        },
      }}
    >
      <Slider
        dots
        infinite
        speed={600}
        autoplay
        autoplaySpeed={5000}
        pauseOnHover
        nextArrow={<Arrow side="right" />}
        prevArrow={<Arrow side="left" />}
      >
        {BANNERS.map((banner) => (
          <Box key={banner.image} sx={{ position: 'relative', height }}>
            <Box
              component="img"
              src={banner.image}
              alt=""
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(to bottom, rgba(0,0,0,.25), rgba(0,0,0,.6))',
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
                px: 3,
              }}
            >
              <Box sx={{ maxWidth: 720, color: '#fff' }}>
                <Typography
                  variant={compact ? 'h4' : 'h2'}
                  component="p"
                  sx={{
                    fontSize: compact
                      ? { xs: '1.2rem', md: '1.8rem' }
                      : { xs: '1.6rem', md: '2.6rem' },
                    mb: compact ? 1.5 : 2.5,
                    textShadow: '0 2px 6px rgba(0,0,0,.4)',
                  }}
                >
                  {banner.title}
                </Typography>
                <Button
                  component={RouterLink}
                  to={banner.link}
                  variant="contained"
                >
                  Shop now
                </Button>
              </Box>
            </Box>
          </Box>
        ))}
      </Slider>
    </Box>
  );
};

HeroSection.propTypes = { compact: PropTypes.bool };

export default HeroSection;
