// src/components/layout/Header.js — storefront header: brand, Categories
// panel, Products, a search box with a collection selector (All, Popular,
// New, Discounted, Top rated, Featured), wishlist, cart and account; a link
// bar with Today's deals and the top categories; then the promo strip.
import React, { useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
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
  Menu,
  MenuItem,
  Popover,
  Select,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  FiChevronDown,
  FiChevronUp,
  FiGrid,
  FiHeart,
  FiMenu,
  FiSearch,
  FiShoppingBag,
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
import BrandMark from '../common/BrandMark';
import { initialsOf } from '../common/BrandMark';

/** The search box's "All" selector: each choice is a ready-made listing. */
export const SEARCH_SCOPES = [
  { value: '', label: 'All', params: {} },
  { value: 'popular', label: 'Popular', params: { sort: 'popular' } },
  { value: 'new', label: 'New', params: { tag: 'new-season' } },
  { value: 'discounted', label: 'Discounted', params: { on_sale: '1' } },
  { value: 'top-rated', label: 'Top rated', params: { sort: 'rating' } },
  { value: 'featured', label: 'Featured', params: { featured: '1' } },
];

const scopeFromParams = (params) =>
  SEARCH_SCOPES.find(
    (s) =>
      s.value && Object.entries(s.params).every(([k, v]) => params.get(k) === v)
  )?.value || '';

const NEW_AND_TRENDING = {
  id: 'new',
  name: 'New & trending',
  to: '/products?sort=popular',
};

const squareButtonSx = {
  width: 44,
  height: 44,
  borderRadius: '8px',
  bgcolor: 'background.neutral',
  color: 'text.primary',
  '&:hover': { bgcolor: 'background.neutralDeep' },
};

/** "Shop by category" panel opened from the Categories button. */
const CategoryPanel = ({ anchorEl, onClose, items }) => {
  const theme = useTheme();
  const tones = [theme.palette.primary.main, theme.palette.warning.main];
  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: {
            mt: 1.5,
            p: 3,
            width: 520,
            maxWidth: 'calc(100vw - 32px)',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            boxShadow: '0 24px 48px rgba(27,33,36,0.12)',
          },
        },
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h6" component="h2">
          Shop by category
        </Typography>
        <Button
          size="small"
          color="inherit"
          onClick={onClose}
          sx={{ color: 'text.secondary' }}
        >
          Close
        </Button>
      </Stack>
      <Box
        component="nav"
        aria-label="Categories"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 1.5,
        }}
      >
        {items.map((c, i) => {
          const tone = tones[i % 2];
          return (
            <Box
              key={c.id}
              component={RouterLink}
              to={c.to}
              onClick={onClose}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                minHeight: 80,
                borderRadius: '8px',
                bgcolor: 'background.neutral',
                color: 'text.primary',
                textDecoration: 'none',
                fontWeight: 600,
                transition: 'background-color .15s',
                '&:hover': { bgcolor: 'background.neutralDeep' },
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '8px',
                  display: 'grid',
                  placeItems: 'center',
                  color: tone,
                  bgcolor: alpha(tone, 0.12),
                  flexShrink: 0,
                }}
              >
                <FiGrid />
              </Box>
              {c.name}
            </Box>
          );
        })}
      </Box>
    </Popover>
  );
};
CategoryPanel.propTypes = {
  anchorEl: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  items: PropTypes.array.isRequired,
};

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
    setScope(scopeFromParams(params));
  }, [location.pathname, location.search]);

  const categoryLinks = useMemo(
    () => categories.map((c) => ({ ...c, to: `/products?category=${c.id}` })),
    [categories]
  );
  const panelItems = useMemo(
    () => [NEW_AND_TRENDING, ...categoryLinks.slice(0, 9)],
    [categoryLinks]
  );

  const goSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams(
      SEARCH_SCOPES.find((s) => s.value === scope)?.params
    );
    if (query.trim()) params.set('search', query.trim());
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
  const closeUserMenu = () => setUserMenuAnchor(null);

  const searchForm = (
    <Box
      component="form"
      role="search"
      onSubmit={goSearch}
      sx={{
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.neutral',
        borderRadius: '8px',
        height: 48,
        width: '100%',
        maxWidth: 940,
        pr: 0.5,
        '&:focus-within': {
          boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.3)}`,
        },
      }}
    >
      <Select
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        displayEmpty
        variant="standard"
        disableUnderline
        IconComponent={FiChevronDown}
        inputProps={{ 'aria-label': 'Search in' }}
        renderValue={(v) =>
          SEARCH_SCOPES.find((s) => s.value === v)?.label || 'All'
        }
        sx={{
          alignSelf: 'stretch',
          pl: 2.5,
          pr: 1,
          width: { md: 150, xs: 110 },
          flexShrink: 0,
          fontWeight: 600,
          fontSize: '0.9rem',
          borderRight: 1,
          borderColor: 'divider',
          '& .MuiSelect-select': {
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            py: 0,
          },
          '& .MuiSelect-icon': { right: 12, fontSize: 16 },
        }}
      >
        {SEARCH_SCOPES.map((s) => (
          <MenuItem key={s.value} value={s.value}>
            {s.label}
          </MenuItem>
        ))}
      </Select>
      <InputBase
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products, brands and categories"
        inputProps={{ 'aria-label': 'Search products', enterKeyHint: 'search' }}
        sx={{ flex: 1, px: 2.5, fontSize: '0.95rem', minWidth: 0 }}
      />
      <IconButton
        type="submit"
        aria-label="Search"
        sx={{
          width: 40,
          height: 40,
          borderRadius: '8px',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '&:hover': { bgcolor: 'primary.dark' },
        }}
      >
        <FiSearch />
      </IconButton>
    </Box>
  );

  const darkButtonSx = {
    height: 44,
    borderRadius: '8px',
    bgcolor: 'text.primary',
    color: 'common.white',
    px: 3,
    '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.88) },
  };

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
        <Stack
          direction="row"
          alignItems="center"
          spacing={{ xs: 1, md: 3 }}
          sx={{ minHeight: { xs: 64, md: 84 } }}
        >
          {isMobile && (
            <IconButton
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
              sx={squareButtonSx}
            >
              <FiMenu />
            </IconButton>
          )}
          <Box
            component={RouterLink}
            to="/"
            aria-label={`${shop.name} home`}
            sx={{ textDecoration: 'none', flexShrink: 0 }}
          >
            <BrandMark
              size={isMobile ? 36 : 44}
              showName={!isMobile}
              fontSize="1.4rem"
            />
          </Box>

          {!isMobile && (
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              <Button
                color="inherit"
                endIcon={categoryAnchor ? <FiChevronUp /> : <FiChevronDown />}
                onClick={(e) => setCategoryAnchor(e.currentTarget)}
                aria-haspopup="dialog"
                aria-expanded={Boolean(categoryAnchor)}
                sx={{ fontWeight: 700, fontSize: '1rem' }}
              >
                Categories
              </Button>
              <Button
                color="inherit"
                component={RouterLink}
                to="/products"
                sx={{ fontWeight: 700, fontSize: '1rem' }}
              >
                Products
              </Button>
            </Stack>
          )}
          <CategoryPanel
            anchorEl={categoryAnchor}
            onClose={() => setCategoryAnchor(null)}
            items={panelItems}
          />

          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            {!isMobile && searchForm}
          </Box>

          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            sx={{ flexShrink: 0 }}
          >
            {shopper && (
              <IconButton
                component={RouterLink}
                to="/wishlist"
                aria-label={`Wishlist, ${wishlistCount} items`}
                sx={squareButtonSx}
              >
                <Badge badgeContent={wishlistCount} color="warning" max={99}>
                  <FiHeart />
                </Badge>
              </IconButton>
            )}
            {shopper && (
              <IconButton
                component={RouterLink}
                to="/cart"
                aria-label={`Cart, ${cartCount} items`}
                sx={squareButtonSx}
              >
                <Badge badgeContent={cartCount} color="warning" max={99}>
                  <FiShoppingBag />
                </Badge>
              </IconButton>
            )}
            {loading ? (
              <Skeleton
                variant="rounded"
                width={isMobile ? 44 : 140}
                height={44}
              />
            ) : user ? (
              <>
                <Button
                  aria-label="User account"
                  onClick={(e) => setUserMenuAnchor(e.currentTarget)}
                  endIcon={!isMobile && <FiChevronDown />}
                  sx={{
                    ...darkButtonSx,
                    pl: 0.75,
                    pr: isMobile ? 0.75 : 2,
                    minWidth: 0,
                    gap: 0.5,
                  }}
                >
                  <Avatar
                    src={user.avatar || undefined}
                    alt=""
                    sx={{
                      width: 32,
                      height: 32,
                      fontSize: 12,
                      fontWeight: 800,
                      bgcolor: 'highlight.main',
                      color: 'text.primary',
                    }}
                  >
                    {initialsOf(user.name)}
                  </Avatar>
                  {!isMobile && (
                    <Box component="span" sx={{ ml: 0.75 }}>
                      Hi, {firstName}
                    </Box>
                  )}
                </Button>
                <Menu
                  anchorEl={userMenuAnchor}
                  open={Boolean(userMenuAnchor)}
                  onClose={closeUserMenu}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  slotProps={{
                    paper: {
                      sx: {
                        borderRadius: 1,
                        minWidth: 240,
                        mt: 1.5,
                        border: 1,
                        borderColor: 'divider',
                        boxShadow: '0 24px 48px rgba(27,33,36,0.12)',
                      },
                    },
                  }}
                >
                  <Box sx={{ px: 2.5, pt: 1.5, pb: 1.5 }}>
                    <Typography variant="subtitle1">{user.name}</Typography>
                    <Typography variant="caption">{user.email}</Typography>
                  </Box>
                  <Divider sx={{ mx: 2 }} />
                  {shopper && (
                    <MenuItem
                      component={RouterLink}
                      to="/account/orders"
                      onClick={closeUserMenu}
                      sx={{ px: 2.5, py: 1.25 }}
                    >
                      My orders
                    </MenuItem>
                  )}
                  <MenuItem
                    component={RouterLink}
                    to={shopper ? '/account/profile' : '/admin/profile'}
                    onClick={closeUserMenu}
                    sx={{ px: 2.5, py: 1.25 }}
                  >
                    Account settings
                  </MenuItem>
                  {isStaff(user) && (
                    <MenuItem
                      component={RouterLink}
                      to="/admin"
                      onClick={closeUserMenu}
                      sx={{ px: 2.5, py: 1.25 }}
                    >
                      Open back office
                    </MenuItem>
                  )}
                  <MenuItem
                    onClick={logoutClick}
                    sx={{ px: 2.5, py: 1.25, color: 'error.main' }}
                  >
                    Sign out
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Button component={RouterLink} to="/login" sx={darkButtonSx}>
                Sign in
              </Button>
            )}
          </Stack>
        </Stack>
      </Container>

      {!isMobile && (
        <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
          <Container maxWidth="xl">
            <Stack
              direction="row"
              alignItems="center"
              spacing={5}
              component="nav"
              aria-label="Shop"
              sx={{ height: 52 }}
            >
              <Typography
                component={RouterLink}
                to="/products?on_sale=1"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  fontWeight: 700,
                  color: 'warning.main',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  '&::before': {
                    content: '""',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'warning.main',
                    boxShadow: `0 0 0 3px ${alpha(theme.palette.warning.main, 0.2)}`,
                  },
                }}
              >
                Today’s deals
              </Typography>
              {[NEW_AND_TRENDING, ...categoryLinks.slice(0, 6)].map((c) => (
                <Typography
                  key={c.id}
                  component={RouterLink}
                  to={c.to}
                  sx={{
                    color: 'text.secondary',
                    textDecoration: 'none',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    '&:hover': { color: 'text.primary' },
                  }}
                >
                  {c.name}
                </Typography>
              ))}
              <Box sx={{ flex: 1 }} />
              <Typography
                component={RouterLink}
                to="/information/support"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  '&:hover': { color: 'text.primary' },
                }}
              >
                Help center
              </Typography>
            </Stack>
          </Container>
        </Box>
      )}

      {showPromo && <PromoStrip onClose={hidePromo} />}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 320, p: 2 } }}
      >
        <Stack spacing={2}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <BrandMark size={36} fontSize="1.15rem" />
            <IconButton
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            >
              <FiX />
            </IconButton>
          </Stack>
          {searchForm}
          <Typography
            component={RouterLink}
            to="/products?on_sale=1"
            onClick={() => setDrawerOpen(false)}
            sx={{
              color: 'warning.main',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Today’s deals
          </Typography>
          <Typography
            component={RouterLink}
            to="/products"
            onClick={() => setDrawerOpen(false)}
            sx={{
              color: 'text.primary',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            All products
          </Typography>
          <Divider />
          <Typography variant="overline" color="text.secondary">
            Categories
          </Typography>
          {[NEW_AND_TRENDING, ...categoryLinks].map((c) => (
            <Typography
              key={c.id}
              component={RouterLink}
              to={c.to}
              onClick={() => setDrawerOpen(false)}
              sx={{ color: 'text.primary', textDecoration: 'none' }}
            >
              {c.name}
            </Typography>
          ))}
          <Divider />
          <Typography
            component={RouterLink}
            to="/information/support"
            onClick={() => setDrawerOpen(false)}
            sx={{ color: 'text.secondary', textDecoration: 'none' }}
          >
            Help center
          </Typography>
        </Stack>
      </Drawer>
    </AppBar>
  );
};

export default Header;
