// src/layouts/MobileBottomNav.js — the shop's main menu on phones: Home,
// Explore, Wishlist, Bag and Me, fixed to the bottom of the screen. "Me"
// opens the phone menu (account, help, shop pages); tapping the tab you're
// on scrolls back to the top.
import React, { useContext } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Badge, Box, Typography } from '@mui/material';
import {
  FiCompass,
  FiHeart,
  FiHome,
  FiShoppingBag,
  FiUser,
} from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { isStaff } from '../auth/permissions';
import { selectCartCount } from '../redux/cartSlice';

export const BOTTOM_NAV_HEIGHT = 72;

const MobileBottomNav = () => {
  const { user } = useContext(AuthContext);
  const { pathname } = useLocation();
  const cartCount = useSelector(selectCartCount);
  const wishlistCount = useSelector((s) => s.wishlist.items.length);
  const me = user && isStaff(user) ? '/admin/profile' : '/me';
  const items = [
    { label: 'Home', to: '/', icon: <FiHome />, active: pathname === '/' },
    {
      label: 'Explore',
      to: '/products',
      icon: <FiCompass />,
      active: pathname.startsWith('/products'),
    },
    {
      label: 'Wishlist',
      to: user ? '/account/wishlist' : '/wishlist',
      icon: <FiHeart />,
      badge: wishlistCount,
      active: pathname.includes('wishlist'),
    },
    {
      label: 'Bag',
      to: '/cart',
      icon: <FiShoppingBag />,
      badge: cartCount,
      active: pathname.startsWith('/cart') || pathname.startsWith('/checkout'),
    },
    {
      label: 'Me',
      to: me,
      icon: <FiUser />,
      active:
        pathname === '/me' ||
        (pathname.startsWith('/account') && !pathname.includes('wishlist')) ||
        pathname === '/login',
    },
  ];

  return (
    <Box
      component="nav"
      aria-label="Main"
      data-testid="bottom-nav"
      sx={{
        display: { xs: 'flex', md: 'none' },
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(12px + env(safe-area-inset-bottom))',
        zIndex: (t) => t.zIndex.appBar,
        height: BOTTOM_NAV_HEIGHT - 12,
        borderRadius: 1,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        boxShadow: '0 12px 32px rgba(27,33,36,0.14)',
        // Stays put while pages slide (see navigation.js).
        viewTransitionName: 'app-tabbar',
      }}
    >
      {items.map((it) => (
        <Box
          key={it.label}
          component={RouterLink}
          to={it.to}
          aria-current={it.active ? 'page' : undefined}
          onClick={() => {
            // Tapping the tab you're on goes back to the top of it.
            if (it.active && it.to === pathname) {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.25,
            textDecoration: 'none',
            color: it.active ? 'primary.main' : 'text.secondary',
            fontSize: 20,
            borderRadius: 1,
            transition: 'transform 120ms ease',
            '&:active': { transform: 'scale(0.92)' },
          }}
        >
          <Badge
            badgeContent={it.badge || 0}
            color="warning"
            max={99}
            invisible={!it.badge}
          >
            {it.icon}
          </Badge>
          <Typography
            component="span"
            sx={{
              fontSize: '0.72rem',
              fontWeight: it.active ? 700 : 500,
              color: 'inherit',
            }}
          >
            {it.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

export default MobileBottomNav;
