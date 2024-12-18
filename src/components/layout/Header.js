// src/components/layout/Header.js
import React, { useContext, useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { fetchCategories } from '../../services/categoryService';
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
  ListItemText,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import { styled } from '@mui/system';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  ShoppingCart,
  FavoriteBorder,
  AccountCircle,
  ExpandMore,
} from '@mui/icons-material';

import logo from '../../images/logo.png';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: '#ffffff',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
}));

const StyledToolbar = styled(Toolbar)({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0.5rem 1rem',
});

const LogoBox = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
});

const LogoImg = styled('img')({
  height: '50px',
  marginRight: '1rem',
});

const NavButton = styled(Button)({
  color: '#000000',
  textTransform: 'none',
  margin: '0 0.5rem',
  '&:hover': {
    backgroundColor: 'rgba(0,0,0,0.04)',
    fontWeight: 'bold',
    fontSize: '0.95rem',
  },
});

const SearchField = styled(TextField)({
  width: '300px',
  '& .MuiOutlinedInput-root': {
    borderRadius: '20px',
    paddingRight: 0,
    '&:hover fieldset': {
      borderColor: '#000000',
    },
  },
});

const Header = () => {
  const { user, loading, handleLogout } = useContext(AuthContext);
  const [categories, setCategories] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shopMenuAnchor, setShopMenuAnchor] = useState(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Redux state
  const cartCount = useSelector((state) => state.cart.items.length);
  const wishlistCount = useSelector((state) => state.wishlist.items.length);

  const navigate = useNavigate();

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await fetchCategories();
        setCategories(data);
      } catch (error) {
        console.error(error.message);
      }
    };
    loadCategories();
  }, []);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleShopMouseEnter = (event) => {
    setShopMenuAnchor(event.currentTarget);
  };

  const handleShopMouseLeave = () => {
    setShopMenuAnchor(null);
  };

  const handleUserMenuClick = (event) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const navItems = ['Most Wanted', 'New Arrival', 'Brands'];

  const handleLinkClick = () => {
    if (mobileOpen) {
      setMobileOpen(false);
    }
    handleUserMenuClose();
    handleShopMouseLeave();
  };

  const handleLogoutClick = () => {
    handleLogout();
    handleUserMenuClose();
    navigate('/login');
  };

  const drawer = (
    <Box sx={{ textAlign: 'center' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
        <IconButton onClick={handleDrawerToggle}>
          <CloseIcon />
        </IconButton>
      </Box>
      <List>
        <ListItem sx={{ justifyContent: 'center' }}>
          <ListItemText primary="Shop" />
        </ListItem>
        {categories.map((category) => (
          <ListItem key={category.id} sx={{ justifyContent: 'center', pl: 4 }}>
            <ListItemText>
              <Link
                to={`/products?category=${category.id}`}
                onClick={handleLinkClick}
                style={{ textDecoration: 'none', color: '#000' }}
              >
                {category.name}
              </Link>
            </ListItemText>
          </ListItem>
        ))}
        {navItems.map((item) => (
          <ListItem key={item} sx={{ justifyContent: 'center' }}>
            <ListItemText>
              <Link
                to="/products"
                onClick={handleLinkClick}
                style={{ textDecoration: 'none', color: '#000' }}
              >
                {item}
              </Link>
            </ListItemText>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <StyledAppBar position="sticky" sx={{ mb: 0 }}>
      <StyledToolbar>
        {isMobile && (
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ color: '#000000', mr: 1 }}
          >
            <MenuIcon />
          </IconButton>
        )}

        <LogoBox onClick={() => navigate('/')}>
          <LogoImg src={logo} alt="Logo" />
          {!isMobile && (
            <Typography variant="h6" component="div" sx={{ color: '#000000' }}>
              Carlos Shop
            </Typography>
          )}
        </LogoBox>

        {!isMobile && (
          <Box
            sx={{ display: 'flex', alignItems: 'center' }}
            onMouseLeave={handleShopMouseLeave}
          >
            <Box onMouseEnter={handleShopMouseEnter}>
              <NavButton
                onClick={handleShopMouseEnter}
                endIcon={<ExpandMore />}
              >
                Shop
              </NavButton>
              <Menu
                anchorEl={shopMenuAnchor}
                open={Boolean(shopMenuAnchor)}
                onClose={handleShopMouseLeave}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                MenuListProps={{ onMouseLeave: handleShopMouseLeave }}
              >
                {categories.map((category) => (
                  <MenuItem
                    key={category.id}
                    onClick={() => {
                      navigate(`/products?category=${category.id}`);
                      handleShopMouseLeave();
                    }}
                    sx={{ fontSize: '0.95rem' }}
                  >
                    {category.name}
                  </MenuItem>
                ))}
              </Menu>
            </Box>
            {navItems.map((item) => (
              <NavButton
                key={item}
                component={NavLink}
                to="/products"
                onClick={handleLinkClick}
                sx={{ fontSize: '0.95rem' }}
              >
                {item}
              </NavButton>
            ))}
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {!isMobile && (
            <SearchField
              placeholder="Search..."
              size="small"
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#000' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ display: { xs: 'none', md: 'block' }, fontSize: '0.9rem' }}
            />
          )}

          <IconButton
            component={Link}
            to="/wishlist"
            aria-label="Wishlist"
            sx={{ color: '#000000' }}
          >
            <Badge badgeContent={wishlistCount} color="error">
              <FavoriteBorder />
            </Badge>
          </IconButton>

          <IconButton
            component={Link}
            to="/cart"
            aria-label="Cart"
            sx={{ color: '#000000' }}
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
                  color: '#000',
                  fontSize: '0.95rem',
                }}
              >
                Hi, {user.name}
              </Typography>
              <IconButton
                aria-label="User account"
                sx={{ color: '#000000' }}
                onClick={handleUserMenuClick}
              >
                <AccountCircle />
              </IconButton>
              <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={handleUserMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <MenuItem
                  onClick={() => {
                    handleUserMenuClose();
                    navigate('/profile');
                  }}
                  sx={{ fontSize: '0.95rem' }}
                >
                  Profile
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    handleUserMenuClose();
                    navigate('/profile?section=orders');
                  }}
                  sx={{ fontSize: '0.95rem' }}
                >
                  Orders
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    handleUserMenuClose();
                    handleLogoutClick();
                  }}
                  sx={{ fontSize: '0.95rem' }}
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
              sx={{ textTransform: 'none', fontSize: '0.95rem' }}
            >
              Login
            </Button>
          )}
        </Box>
      </StyledToolbar>

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
        {drawer}
      </Drawer>
    </StyledAppBar>
  );
};

export default Header;
