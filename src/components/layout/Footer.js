// src/components/layout/Footer.js
import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, SvgIcon } from '@mui/material';
import { ArrowRight } from '@mui/icons-material';
import payment1 from '../../images/payment1.png';
import payment2 from '../../images/payment2.png';
import payment3 from '../../images/payment3.png';
import payment4 from '../../images/payment4.png';

const footerLinks = [
  {
    title: 'Shop',
    items: [
      { name: 'Best Seller', to: '/categories/best-seller' },
      { name: 'Shop Men', to: '/categories/shop-men' },
      { name: 'Shop Women', to: '/categories/shop-women' },
      { name: 'Shop Casual', to: '/categories/shop-casual' },
    ],
  },
  {
    title: 'Company',
    items: [
      { name: 'About', to: '/about' },
      { name: 'Careers', to: '/careers' },
      { name: 'Press', to: '/press' },
    ],
  },
  {
    title: 'Products',
    items: [
      { name: 'Featured', to: '/products?featured=true' },
      { name: 'New Arrivals', to: '/products?sort=new' },
      { name: 'Sale', to: '/products?sale=true' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { name: 'Documentation', to: '/documentation' },
      { name: 'FAQ', to: '/faq' },
      { name: 'Support', to: '/support' },
    ],
  },
  {
    title: 'Connect',
    items: [
      { name: 'Facebook', to: '#' },
      { name: 'Twitter', to: '#' },
      { name: 'Instagram', to: '#' },
    ],
  },
  {
    title: 'Payments',
    items: [],
  },
];

const socialIcons = [
  {
    name: 'Facebook',
    to: '#',
    path: (
      <path
        fillRule="evenodd"
        d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.772-1.63 1.558V12h2.77l-.443 2.89h-2.327V22C18.343 21.128 22 16.991 22 12z"
      />
    ),
  },
  {
    name: 'YouTube',
    to: '#',
    path: (
      <path d="M12 2C6.486 2 2 6.486 2 12c0 5.513 4.486 10 10 10s10-4.487 10-10c0-5.514-4.486-10-10-10zm0 1.542c4.951 0 8.458 3.392 8.458 8.458 0 4.949-3.391 8.458-8.458 8.458-4.948 0-8.458-3.391-8.458-8.458 0-4.949 3.392-8.458 8.458-8.458zM9.743 16.747V7.128l6.027 4.31-6.027 4.309z" />
    ),
  },
  {
    name: 'LinkedIn',
    to: '#',
    path: (
      <path
        fillRule="evenodd"
        d="M21 5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5zm-2.5 8.2v5.3h-2.79v-4.93a1.4 1.4 0 0 0-1.4-1.4c-.77 0-1.39.63-1.39 1.4v4.93h-2.79v-8.37h2.79v1.11c.48-.78 1.47-1.3 2.32-1.3 1.8 0 3.26 1.46 3.26 3.26zM6.88 8.56a1.686 1.686 0 0 0 0-3.37 1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68zm1.39 1.57v8.37H5.5v-8.37h2.77z"
        clipRule="evenodd"
      />
    ),
  },
];

const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        position: 'relative',
        backgroundColor: '#0b0e37',
        color: 'gray.300',
        pt: '24px',
        pb: '24px',
        px: '24px',
        fontFamily: 'sans-serif',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          maxWidth: '1200px',
          mx: 'auto',
          position: 'relative',
          zIndex: 20,
        }}
      >
        {/* Top Links Grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(6, 1fr)' },
            gap: { xs: '20px', lg: '48px' },
            mb: 4,
          }}
        >
          {footerLinks.map((section) => (
            <Box key={section.title}>
              <Typography
                sx={{
                  fontSize: '0.9rem',
                  color: 'white',
                  fontWeight: 'bold',
                  mb: 2,
                }}
              >
                {section.title}
              </Typography>
              <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                {section.items.length > 0 ? (
                  section.items.map((item) => (
                    <Box key={item.name} component="li" sx={{ mb: '10px' }}>
                      <Link to={item.to} style={{ textDecoration: 'none' }}>
                        <Typography
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            color: 'white',
                            fontSize: '0.9rem',
                            transition: 'color 0.3s',
                            '&:hover': { color: '#2196f3' },
                          }}
                        >
                          <SvgIcon
                            sx={{
                              mr: 1.5,
                              fontSize: '1rem',
                              width: '16px',
                              height: '16px',
                            }}
                          >
                            <ArrowRight />
                          </SvgIcon>
                          {item.name}
                        </Typography>
                      </Link>
                    </Box>
                  ))
                ) : section.title === 'Payments' ? (
                  // Payments section with images
                  <Box sx={{ display: 'flex', gap: '15px', mt: '10px' }}>
                    {[payment1, payment2, payment3, payment4].map(
                      (imgSrc, idx) => (
                        <Box
                          component="img"
                          key={idx}
                          src={imgSrc}
                          alt={`Payment Method ${idx + 1}`}
                          sx={{
                            width: '30px',
                            height: 'auto',
                            objectFit: 'contain',
                          }}
                        />
                      )
                    )}
                  </Box>
                ) : null}
              </Box>
            </Box>
          ))}
        </Box>

        <Box
          component="hr"
          sx={{
            borderColor: 'white',
            my: 4,
          }}
        />

        {/* Bottom Row */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: { xs: 'center', sm: 'space-between' },
            gap: '24px',
          }}
        >
          {/* Social Icons */}
          <Box sx={{ display: 'flex', gap: '20px' }}>
            {socialIcons.map((icon) => (
              <Box
                key={icon.name}
                component="a"
                href={icon.to}
                sx={{
                  color: 'white',
                  transition: 'color 0.3s',
                  '&:hover': { color: '#2196f3' },
                  display: 'inline-flex',
                }}
              >
                <SvgIcon
                  sx={{ width: '20px', height: '20px', fill: 'currentColor' }}
                >
                  {icon.path}
                </SvgIcon>
              </Box>
            ))}
          </Box>

          <Typography
            sx={{
              color: 'white',
              fontSize: '0.875rem',
              textAlign: 'center',
            }}
          >
            &copy; 2024 Carlos Shop. All rights reserved.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Footer;
