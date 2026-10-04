// src/components/layout/Header.js — storefront header: brand row with
// category menu, scoped search and shopping icons; a link bar; and a promo
// strip. Layout inspired by the Aurora template, built from our own code.
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  InputBase,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  FiGrid,
  FiHeart,
  FiLogOut,
  FiMenu,
  FiPackage,
  FiSearch,
  FiSettings,
  FiShoppingCart,
  FiUser,
  FiX,
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { fetchCategories } from '../../redux/categoriesSlice';
import { selectCartCount } from '../../redux/cartSlice';
import { canShop, isStaff } from '../../auth/permissions';
import { PromoStrip } from '../promotions/Promotions';
import { useNotify } from '../../notification/NotificationProvider';
import { MESSAGES } from '../../notification/messages';
import { useStore } from '../../context/StoreContext';

const LINKS = [
  { label: 'Orders', to: '/account/orders', auth: true, shopper: true },
  { label: 'Wishlist', to: '/wishlist', shopper: true },
  { label: 'New arrivals', to: '/products' },
  { label: 'Help', to: '/information/support' },
];

const Header = () => {
  const shop = useStore();
  const { user, loading, logout } = useContext(AuthContext);
  const notify = useNotify();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const cartCount = useSelector(selectCartCount);
  const wishlistCount = useSelector((s) => s.wishlist.items.length);
  const categories = useSelector((s) => s.categories.categories || []);

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('');
  const [categoryAnchor, setCategoryAnchor] = useState(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showPromo, setShowPromo] = useState(() => {
    try {
      return sessionStorage.getItem('promo-hidden') !== '1';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!categories.length) dispatch(fetchCategories());
  }, [dispatch, categories.length]);

  // Keep the search box in step with the product page's URL.
  useEffect(() => {
    if (location.pathname !== '/products') return;
    const params = new URLSearchParams(location.search);
    setQuery(params.get('search') || '');
    setScope(params.get('category') || '');
  }, [location.pathname, location.search]);

  const topCategories = useMemo(() => categories.slice(0, 12), [categories]);

  const goSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('search', query.trim());
    if (scope) params.set('category', scope);
    setDrawerOpen(false);
    navigate(`/products${params.toString() ? `?${params}` : ''}`);
  };

  const hidePromo = () => {
    setShowPromo(false);
    try {
      sessionStorage.setItem('promo-hidden', '1');
    } catch {
      // storage unavailable: hide for this page view only
    }
  };

  const logoutClick = async () => {
    setUserMenuAnchor(null);
    try {
      await logout();
      notify.info(MESSAGES.auth.signedOut);
    } catch (error) {
      notify.error(error);
    }
    navigate('/login');
  };

  const firstName = user?.name?.split(' ')[0] || '';
  const shopper = canShop(user);
  const iconButtonSx = {
    bgcolor: 'background.neutralDeep',
    width: 42,
    height: 42,
  };

  const searchForm = (
    <Box
      component="form"
      role="search"
      onSubmit={goSearch}
      sx={{
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.neutralDeep',
        borderRadius: 999,
        pl: 0.5,
        pr: 1,
        height: 42,
        width: '100%',
        maxWidth: 620,
        '&:focus-within': {
          boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.35)}`,
        },
      }}
    >
      <Select
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        displayEmpty
        variant="standard"
        disableUnderline
        inputProps={{ 'aria-label': 'Search in' }}
        renderValue={(v) =>
          v
            ? categories.find((c) => String(c.id) === String(v))?.name || 'All'
            : 'All'
        }
        sx={{
          pl: 1.5,
          pr: 0.5,
          fontWeight: 600,
          fontSize: '0.875rem',
          minWidth: 64,
        }}
      >
        <MenuItem value="">All</MenuItem>
        {topCategories.map((c) => (
          <MenuItem key={c.id} value={String(c.id)}>
            {c.name}
          </MenuItem>
        ))}
      </Select>
      <InputBase
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products"
        inputProps={{ 'aria-label': 'Search products', enterKeyHint: 'search' }}
        sx={{ flex: 1, px: 1, fontSize: '0.9rem' }}
      />
      <IconButton type="submit" size="small" aria-label="Search">
        <FiSearch />
      </IconButton>
    </Box>
  );

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Container maxWidth="xl">
        <Toolbar
          disableGutters
          sx={{ gap: { xs: 1, md: 3 }, minHeight: { xs: 64, md: 76 } }}
        >
          {isMobile && (
            <IconButton
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
              sx={iconButtonSx}
            >
              <FiMenu />
            </IconButton>
          )}
          <Box
            component={RouterLink}
            to="/"
            aria-label={`${shop.name} home`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <Box
              component="img"
              src={shop.logoUrl}
              alt=""
              sx={{ height: 36, maxWidth: 140, objectFit: 'contain' }}
            />
            {!isMobile && (
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  letterSpacing: '-0.02em',
                }}
              >
                {shop.name}
              </Typography>
            )}
          </Box>

          {!isMobile && (
            <Button
              color="inherit"
              startIcon={<FiGrid />}
              onClick={(e) => setCategoryAnchor(e.currentTarget)}
              aria-haspopup="menu"
              sx={{ fontWeight: 600 }}
            >
              Category
            </Button>
          )}
          <Menu
            anchorEl={categoryAnchor}
            open={Boolean(categoryAnchor)}
            onClose={() => setCategoryAnchor(null)}
            slotProps={{
              paper: { sx: { borderRadius: 1, minWidth: 220, mt: 1 } },
            }}
          >
            {topCategories.map((c) => (
              <MenuItem
                key={c.id}
                onClick={() => {
                  setCategoryAnchor(null);
                  navigate(`/products?category=${c.id}`);
                }}
              >
                {c.name}
              </MenuItem>
            ))}
            {!topCategories.length && (
              <MenuItem disabled>No categories yet</MenuItem>
            )}
          </Menu>

          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            {!isMobile && searchForm}
          </Box>

          <Stack direction="row" spacing={1.25} alignItems="center">
            {shopper && (
              <IconButton
                component={RouterLink}
                to="/wishlist"
                aria-label={`Wishlist, ${wishlistCount} items`}
                sx={iconButtonSx}
              >
                <Badge badgeContent={wishlistCount} color="error" max={99}>
                  <FiHeart />
                </Badge>
              </IconButton>
            )}
            {shopper && (
              <IconButton
                component={RouterLink}
                to="/cart"
                aria-label={`Cart, ${cartCount} items`}
                sx={iconButtonSx}
              >
                <Badge badgeContent={cartCount} color="error" max={99}>
                  <FiShoppingCart />
                </Badge>
              </IconButton>
            )}
            {loading ? (
              <Skeleton variant="circular" width={36} height={36} />
            ) : user ? (
              <>
                {!isMobile && (
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Hi, {user.name}
                  </Typography>
                )}
                <IconButton
                  aria-label="User account"
                  onClick={(e) => setUserMenuAnchor(e.currentTarget)}
                  sx={{ p: 0.25 }}
                >
                  <Avatar
                    src={user.avatar || undefined}
                    alt=""
                    sx={{ width: 40, height: 40, bgcolor: 'primary.main' }}
                  >
                    {firstName.charAt(0)}
                  </Avatar>
                </IconButton>
                <Menu
                  anchorEl={userMenuAnchor}
                  open={Boolean(userMenuAnchor)}
                  onClose={() => setUserMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  slotProps={{
                    paper: { sx: { borderRadius: 1, minWidth: 220, mt: 1 } },
                  }}
                >
                  <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="subtitle2">{user.name}</Typography>
                    <Typography variant="caption">{user.email}</Typography>
                  </Box>
                  <Divider />
                  <MenuItem
                    component={RouterLink}
                    to={shopper ? '/account' : '/admin/profile'}
                    onClick={() => setUserMenuAnchor(null)}
                  >
                    <ListItemIcon>
                      <FiUser />
                    </ListItemIcon>
                    <ListItemText>
                      {shopper ? 'My account' : 'My profile'}
                    </ListItemText>
                  </MenuItem>
                  {shopper && (
                    <MenuItem
                      component={RouterLink}
                      to="/account/orders"
                      onClick={() => setUserMenuAnchor(null)}
                    >
                      <ListItemIcon>
                        <FiPackage />
                      </ListItemIcon>
                      <ListItemText>My orders</ListItemText>
                    </MenuItem>
                  )}
                  {isStaff(user) && (
                    <MenuItem
                      component={RouterLink}
                      to="/admin"
                      onClick={() => setUserMenuAnchor(null)}
                    >
                      <ListItemIcon>
                        <FiSettings />
                      </ListItemIcon>
                      <ListItemText>Admin</ListItemText>
                    </MenuItem>
                  )}
                  <Divider />
                  <MenuItem onClick={logoutClick}>
                    <ListItemIcon>
                      <FiLogOut />
                    </ListItemIcon>
                    <ListItemText>Logout</ListItemText>
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Button component={RouterLink} to="/login" variant="contained">
                Login
              </Button>
            )}
          </Stack>
        </Toolbar>
      </Container>

      {!isMobile && (
        <Box
          sx={{
            bgcolor: 'background.neutral',
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Container maxWidth="xl">
            <Stack direction="row" alignItems="center" sx={{ height: 40 }}>
              <Typography
                component={RouterLink}
                to="/products"
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                  textDecoration: 'none',
                }}
              >
                Today’s deals
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Stack
                direction="row"
                spacing={3}
                component="nav"
                aria-label="Shop"
              >
                {LINKS.filter(
                  (l) => (!l.auth || user) && (shopper || !l.shopper)
                ).map((l) => (
                  <Typography
                    key={l.label}
                    component={RouterLink}
                    to={l.to}
                    variant="body2"
                    sx={{
                      color: 'text.primary',
                      textDecoration: 'none',
                      fontWeight: 500,
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    {l.label}
                  </Typography>
                ))}
              </Stack>
            </Stack>
          </Container>
        </Box>
      )}

      {showPromo && <PromoStrip onClose={hidePromo} />}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 300, p: 2 } }}
      >
        <Stack spacing={2}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography sx={{ fontWeight: 800 }}>{shop.name}</Typography>
            <IconButton
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            >
              <FiX />
            </IconButton>
          </Stack>
          {searchForm}
          <Divider />
          {LINKS.filter(
            (l) => (!l.auth || user) && (shopper || !l.shopper)
          ).map((l) => (
            <Typography
              key={l.label}
              component={RouterLink}
              to={l.to}
              onClick={() => setDrawerOpen(false)}
              sx={{
                color: 'text.primary',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              {l.label}
            </Typography>
          ))}
          <Divider />
          <Typography variant="overline" color="text.secondary">
            Categories
          </Typography>
          {topCategories.map((c) => (
            <Typography
              key={c.id}
              component={RouterLink}
              to={`/products?category=${c.id}`}
              onClick={() => setDrawerOpen(false)}
              sx={{ color: 'text.primary', textDecoration: 'none' }}
            >
              {c.name}
            </Typography>
          ))}
        </Stack>
      </Drawer>
    </AppBar>
  );
};

export default Header;
