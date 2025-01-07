// src/components/layout/Header.js
import React, { useContext, useState, useEffect, useMemo } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { useSelector } from 'react-redux';

import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Badge,
  InputAdornment,
  TextField,
  Box,
  Drawer,
  List,
  ListItem,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import { styled, keyframes } from '@mui/system';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  ShoppingCart,
  FavoriteBorder,
  AccountCircle,
} from '@mui/icons-material';

import logo from '../../images/logo.png';

//
// 1) Style the AppBar, Toolbar, and Logo
//
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
}));

const StyledToolbar = styled(Toolbar)(() => ({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0.5rem 1rem',
}));

const LogoImg = styled('img')({
  height: '70px',
  marginRight: '1rem',
});

// 2) Sliding “tips” animation for the search bar
const slideUp = keyframes`
  0% {
    transform: translateY(100%);
    opacity: 0;
  }
  20%, 80% {
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateY(-100%);
    opacity: 0;
  }
`;

const AnimatedTipBox = styled('div')(({ theme }) => ({
  position: 'absolute',
  left: '45px',
  top: '0',
  bottom: '0',
  display: 'flex',
  alignItems: 'center',
  pointerEvents: 'none',
  overflow: 'hidden',
  width: 'calc(100% - 45px)',
  paddingLeft: '4px',
  color: theme.palette.text.secondary,
  fontSize: theme.typography.body1.fontSize,
  fontFamily: theme.typography.body1.fontFamily,
}));

// Each sliding text
const SlidingText = styled('span')(({ theme }) => ({
  display: 'inline-block',
  animation: `${slideUp} 2.2s linear forwards`,
  whiteSpace: 'nowrap',
  textAlign: 'left',
}));

// 3) Main SearchField with room for the animated tips
const SearchContainer = styled('div')(({ theme }) => ({
  position: 'relative',
  width: '400px',
  '.MuiOutlinedInput-root': {
    borderRadius: theme.shape.borderRadius * 5,
    paddingRight: 0,
    '&:hover fieldset': {
      borderColor: theme.palette.text.primary,
    },
  },
}));

const Header = () => {
  const { user, loading, handleLogout } = useContext(AuthContext);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);

  // For cycling “tips” in the search bar
  const tips = useMemo(
    () => [
      'Search for sneakers',
      'Search for shirts',
      'Search for jackets',
      'Search for accessories',
      'Search by brand or name',
    ],
    []
  );
  const [currentTip, setCurrentTip] = useState(tips[0]);
  const [tipKey, setTipKey] = useState(0); // re-render animation
  const [typing, setTyping] = useState(false); // to stop animation if user is typing

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Redux state
  const cartCount = useSelector((state) => state.cart.items.length);
  const wishlistCount = useSelector((state) => state.wishlist.items.length);

  const navigate = useNavigate();

  // Animate a new tip sliding up every ~2.5s, but only if not typing
  useEffect(() => {
    if (typing) return undefined; // stop animation if user is typing

    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % tips.length;
      setCurrentTip(tips[index]);
      setTipKey((prev) => prev + 1); // retrigger animation
    }, 2500);

    return () => clearInterval(interval);
  }, [typing, tips]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLinkClick = () => {
    if (mobileOpen) setMobileOpen(false);
    setUserMenuAnchor(null);
  };

  const handleLogoutClick = () => {
    handleLogout();
    setUserMenuAnchor(null);
    navigate('/login');
  };

  // Mobile Drawer
  const renderMobileDrawer = (
    <Box sx={{ textAlign: 'center' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
        <IconButton onClick={handleDrawerToggle}>
          <CloseIcon />
        </IconButton>
      </Box>
      <List>
        <ListItem sx={{ justifyContent: 'center' }}>
          <Button
            component={Link}
            to="/products"
            onClick={handleLinkClick}
            sx={{
              color: theme.palette.text.primary,
              textTransform: 'none',
              ...theme.typography.body1,
              fontWeight: 'bold',
              ':hover': {
                transform: 'scale(1.05)',
                background: 'none',
              },
            }}
          >
            Explore Products
          </Button>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <StyledAppBar position="sticky">
      <StyledToolbar>
        {/* Left Section: Logo + Home + Explore */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {/* Logo and "Home" link */}
          <Box
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            <LogoImg src={logo} alt="Logo" />
            {!isMobile && (
              <Typography
                variant="body1"
                sx={{
                  color: theme.palette.text.primary,
                  ...theme.typography.body1,
                  fontWeight: 'bold', // bold by default
                  marginRight: 2,
                  transition: 'transform 0.2s',
                  ':hover': { transform: 'scale(1.05)' },
                }}
              >
                Home
              </Typography>
            )}
          </Box>

          {/* “Explore Products” for desktop */}
          {!isMobile && (
            <Button
              component={NavLink}
              to="/products"
              onClick={handleLinkClick}
              sx={{
                color: theme.palette.text.primary,
                textTransform: 'none',
                ...theme.typography.body1,
                fontWeight: 'bold', // bold by default
                ':hover': {
                  transform: 'scale(1.05)',
                  background: 'none',
                },
              }}
            >
              Explore Products
            </Button>
          )}
        </Box>

        {/* Center: Animated Search Bar */}
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
          {!isMobile && (
            <SearchContainer>
              <TextField
                variant="outlined"
                size="small"
                onFocus={() => setTyping(true)} // stop animation
                onBlur={() => setTyping(false)} // resume animation
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: theme.palette.text.primary }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  width: '100%',
                  ...theme.typography.body1,
                  transition: 'transform 0.3s ease',
                  '&:hover, &:focus-within': {
                    transform: 'scale(1.05)',
                  },
                }}
              />

              {/* Animated tip overlay (scroll up text) if not typing */}
              {!typing && (
                <AnimatedTipBox>
                  <SlidingText key={tipKey}>{currentTip}</SlidingText>
                </AnimatedTipBox>
              )}
            </SearchContainer>
          )}
        </Box>

        {/* Right Section: Wishlist, Cart, Login/User */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton
            component={Link}
            to="/wishlist"
            sx={{ color: theme.palette.text.primary }}
          >
            <Badge badgeContent={wishlistCount} color="error">
              <FavoriteBorder />
            </Badge>
          </IconButton>

          <IconButton
            component={Link}
            to="/cart"
            sx={{ color: theme.palette.text.primary }}
          >
            <Badge badgeContent={cartCount} color="error">
              <ShoppingCart />
            </Badge>
          </IconButton>

          {loading ? null : user ? (
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  mr: 1,
                  color: theme.palette.text.primary,
                  ...theme.typography.body2,
                }}
              >
                Hi, {user.name}
              </Typography>
              <IconButton
                aria-label="User account"
                sx={{ color: theme.palette.text.primary }}
                onClick={(e) => setUserMenuAnchor(e.currentTarget)}
              >
                <AccountCircle />
              </IconButton>
              <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={() => setUserMenuAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <MenuItem
                  onClick={() => {
                    setUserMenuAnchor(null);
                    navigate('/profile');
                  }}
                  sx={{ ...theme.typography.body2 }}
                >
                  Profile
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setUserMenuAnchor(null);
                    navigate('/profile?section=orders');
                  }}
                  sx={{ ...theme.typography.body2 }}
                >
                  Orders
                </MenuItem>
                <MenuItem
                  onClick={handleLogoutClick}
                  sx={{ ...theme.typography.body2 }}
                >
                  Logout
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            <Button
              component={Link}
              to="/login"
              variant="contained"
              color="primary"
              sx={{
                textTransform: 'none',
                ...theme.typography.body2,
                px: 3,
                py: 1,
              }}
            >
              Login
            </Button>
          )}
        </Box>
      </StyledToolbar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
        }}
      >
        {renderMobileDrawer}
      </Drawer>
    </StyledAppBar>
  );
};

export default Header;
