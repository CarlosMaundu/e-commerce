// src/layouts/AdminLayout.js — back office shell: a white sidebar (brand,
// grouped links with dot markers and attention badges, help card) and a top
// bar (page title, global search with ⌘K, storefront link, notifications and
// the account menu). Items are shown by permission.
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  NavLink,
  Outlet,
  Link as RouterLink,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  Avatar,
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  InputBase,
  Menu,
  MenuItem,
  Popover,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  FiAlertTriangle,
  FiBell,
  FiBox,
  FiChevronDown,
  FiMenu,
  FiPackage,
  FiRotateCcw,
  FiSearch,
  FiUser,
} from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import {
  hasPermission,
  hasPermissionPrefix,
  PERMISSIONS,
  roleLabel,
} from '../auth/permissions';
import { adminCatalog, adminOrders, adminUsers } from '../api';
import BrandMark, { initialsOf } from '../components/common/BrandMark';
import { formatMoney } from '../utils/format';

const RAIL_WIDTH = 280;

export const adminNav = (user) =>
  [
    {
      heading: 'Workspace',
      items: [
        {
          label: 'Overview',
          title: 'Store overview',
          to: '/admin',
          end: true,
          show: hasPermission(user, PERMISSIONS.dashboardView),
        },
        {
          label: 'Orders',
          to: '/admin/orders',
          badge: 'to_fulfil',
          show: hasPermission(user, PERMISSIONS.ordersView),
        },
        {
          label: 'Returns',
          to: '/admin/returns',
          badge: 'open_returns',
          show: hasPermission(user, PERMISSIONS.returnsView),
        },
      ],
    },
    {
      heading: 'Catalog',
      items: [
        {
          label: 'Products',
          to: '/admin/products',
          show: hasPermission(user, 'catalog.products.view'),
        },
        {
          label: 'Categories',
          to: '/admin/categories',
          show: hasPermissionPrefix(user, 'catalog.categories.'),
        },
        {
          label: 'Brands',
          to: '/admin/brands',
          show: hasPermissionPrefix(user, 'catalog.brands.'),
        },
      ],
    },
    {
      heading: 'People',
      items: [
        {
          label: 'Customers & staff',
          title: 'Users',
          to: '/admin/users',
          show: hasPermission(user, PERMISSIONS.usersView),
        },
        {
          label: 'Roles',
          to: '/admin/roles',
          show: hasPermission(user, PERMISSIONS.rolesView),
        },
      ],
    },
    {
      heading: 'System',
      items: [
        {
          label: 'Store settings',
          to: '/admin/settings',
          show: hasPermission(user, PERMISSIONS.settingsManage),
        },
        {
          label: 'Security',
          to: '/admin/security',
          show: hasPermission(user, PERMISSIONS.securityView),
        },
        {
          label: 'Audit log',
          to: '/admin/audit',
          show: hasPermission(user, PERMISSIONS.auditView),
        },
      ],
    },
  ]
    .map((g) => ({ ...g, items: g.items.filter((i) => i.show) }))
    .filter((g) => g.items.length);

/** The current page's name for the top bar, from the nav. */
const pageTitle = (user, pathname) => {
  if (pathname.startsWith('/admin/profile')) return 'Profile settings';
  const items = adminNav(user).flatMap((g) => g.items);
  const match = items
    .filter((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)))
    .sort((a, b) => b.to.length - a.to.length)[0];
  if (match) return match.title || match.label;
  if (pathname === '/admin' || pathname === '/admin/') return 'Store overview';
  return 'Back office';
};

/** Attention counts for the bell and the nav badges, refreshed each minute. */
const useAttention = (pathname) => {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    let active = true;
    const load = () =>
      adminOrders
        .notifications()
        .then((c) => active && setCounts(c))
        .catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [pathname]);
  return counts;
};

const Rail = ({ onNavigate, counts }) => {
  const { user } = useContext(AuthContext);
  const theme = useTheme();
  return (
    <Stack sx={{ height: '100%', px: 2.5, pt: 3, pb: 2.5 }}>
      <Box
        component={RouterLink}
        to="/admin"
        onClick={onNavigate}
        sx={{ textDecoration: 'none', px: 1, mb: 4 }}
      >
        <BrandMark size={44} fontSize="1.35rem" />
      </Box>
      <Box
        component="nav"
        aria-label="Admin"
        sx={{ flex: 1, overflowY: 'auto', mx: -0.5, px: 0.5 }}
      >
        {adminNav(user).map((group) => (
          <Box key={group.heading} sx={{ mb: 3 }}>
            <Typography
              sx={{
                px: 1.5,
                mb: 1,
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'text.secondary',
              }}
            >
              {group.heading}
            </Typography>
            <Stack spacing={0.5}>
              {group.items.map((item) => {
                const count = item.badge ? counts[item.badge] : 0;
                return (
                  <Box
                    key={item.to}
                    component={NavLink}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.75,
                      px: 1.75,
                      height: 48,
                      borderRadius: '8px',
                      color: 'text.secondary',
                      textDecoration: 'none',
                      fontWeight: 500,
                      fontSize: '1rem',
                      '&::before': {
                        content: '""',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: 'divider',
                        flexShrink: 0,
                      },
                      '&:hover': {
                        bgcolor: 'background.neutral',
                        color: 'text.primary',
                      },
                      '&.active': {
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                        fontWeight: 600,
                        '&::before': { bgcolor: 'primary.main' },
                      },
                    }}
                  >
                    <Box component="span" sx={{ flex: 1 }}>
                      {item.label}
                    </Box>
                    {count > 0 && (
                      <Box
                        component="span"
                        aria-label={`${count} need attention`}
                        sx={{
                          px: 1,
                          minWidth: 28,
                          height: 22,
                          borderRadius: 999,
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'warning.main',
                          bgcolor: alpha(theme.palette.warning.main, 0.14),
                        }}
                      >
                        {count > 99 ? '99+' : count}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          mt: 2,
          p: 2.5,
          borderRadius: 1,
          bgcolor: 'ink.main',
          color: 'common.white',
        }}
      >
        <Typography sx={{ fontWeight: 700 }}>Need some help?</Typography>
        <Typography
          variant="body2"
          sx={{ mt: 0.75, color: alpha('#fff', 0.7) }}
        >
          Visit the admin guide or contact support.
        </Typography>
        <Typography
          component={RouterLink}
          to="/information/support"
          target="_blank"
          sx={{
            display: 'inline-block',
            mt: 1.5,
            fontWeight: 700,
            fontSize: '0.9rem',
            color: 'highlight.main',
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Open help center
        </Typography>
      </Box>
    </Stack>
  );
};
Rail.propTypes = { onNavigate: PropTypes.func, counts: PropTypes.object };

/** Search orders, products and people from anywhere (⌘K / Ctrl+K). */
const GlobalSearch = ({ compact }) => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const usersCache = useRef(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);

  const can = {
    orders: hasPermission(user, PERMISSIONS.ordersView),
    products: hasPermission(user, 'catalog.products.view'),
    users: hasPermission(user, PERMISSIONS.usersView),
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const search = useCallback(
    async (term) => {
      setBusy(true);
      const settle = (p) => p.catch(() => []);
      const [orders, products, people] = await Promise.all([
        can.orders
          ? settle(
              adminOrders.list({ search: term, limit: 4 }).then((r) => r.orders)
            )
          : [],
        can.products
          ? settle(
              adminCatalog
                .listProducts({ search: term, limit: 4 })
                .then((r) => r.products)
            )
          : [],
        can.users
          ? settle(
              (usersCache.current
                ? Promise.resolve(usersCache.current)
                : adminUsers.list().then((list) => {
                    usersCache.current = list;
                    return list;
                  })
              ).then((list) =>
                list
                  .filter((u) =>
                    `${u.name} ${u.email}`
                      .toLowerCase()
                      .includes(term.toLowerCase())
                  )
                  .slice(0, 4)
              )
            )
          : [],
      ]);
      setResults({ orders, products, people });
      setBusy(false);
    },
    [can.orders, can.products, can.users]
  );

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return undefined;
    }
    const t = setTimeout(() => search(term), 250);
    return () => clearTimeout(t);
  }, [q, search]);

  const go = (to) => {
    setOpen(false);
    setQ('');
    navigate(to);
  };

  const groups = results
    ? [
        {
          title: 'Orders',
          icon: <FiPackage />,
          items: results.orders.map((o) => ({
            key: `o${o.id}`,
            primary: `Order #${o.id}`,
            secondary: `${o.customer?.name || o.email || ''} · ${formatMoney(o.total)}`,
            to: `/admin/orders/${o.id}`,
          })),
        },
        {
          title: 'Products',
          icon: <FiBox />,
          items: results.products.map((p) => ({
            key: `p${p.id}`,
            primary: p.title,
            secondary: p.sku || '',
            to: `/admin/products/${p.id}`,
          })),
        },
        {
          title: 'People',
          icon: <FiUser />,
          items: results.people.map((u) => ({
            key: `u${u.id}`,
            primary: u.name || u.email,
            secondary: u.email,
            to: `/admin/users/${u.id}`,
          })),
        },
      ].filter((g) => g.items.length)
    : [];

  return (
    <>
      <Box
        ref={boxRef}
        component="form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const first = groups[0]?.items[0];
          if (first) go(first.to);
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          height: 48,
          px: 2,
          width: compact ? '100%' : { md: 300, lg: 380 },
          borderRadius: '8px',
          bgcolor: 'background.neutral',
          color: 'text.secondary',
          '&:focus-within': {
            boxShadow: (t) => `0 0 0 2px ${alpha(t.palette.primary.main, 0.3)}`,
          },
        }}
      >
        {busy ? <CircularProgress size={16} /> : <FiSearch />}
        <InputBase
          inputRef={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search orders, products, customers"
          inputProps={{ 'aria-label': 'Search the back office' }}
          sx={{ flex: 1, fontSize: '0.95rem' }}
        />
        <Box
          component="kbd"
          sx={{
            px: 0.75,
            py: 0.25,
            borderRadius: '6px',
            border: 1,
            borderColor: 'divider',
            fontSize: '0.7rem',
            fontFamily: 'inherit',
            color: 'text.secondary',
            display: { xs: 'none', lg: 'block' },
          }}
        >
          ⌘K
        </Box>
      </Box>
      <Popover
        open={open && q.trim().length >= 2 && !busy && Boolean(results)}
        anchorEl={boxRef.current}
        onClose={() => setOpen(false)}
        disableAutoFocus
        disableEnforceFocus
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: boxRef.current?.offsetWidth || 380,
              maxHeight: 420,
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
              boxShadow: '0 24px 48px rgba(27,33,36,0.12)',
              py: 1,
            },
          },
        }}
      >
        {groups.length ? (
          groups.map((g) => (
            <Box key={g.title} sx={{ py: 0.5 }}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ px: 2 }}
              >
                {g.title}
              </Typography>
              {g.items.map((it) => (
                <MenuItem
                  key={it.key}
                  onClick={() => go(it.to)}
                  sx={{ gap: 1.5, py: 1 }}
                >
                  <Box sx={{ color: 'text.secondary', display: 'flex' }}>
                    {g.icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                      {it.primary}
                    </Typography>
                    <Typography variant="caption" noWrap component="div">
                      {it.secondary}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Box>
          ))
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ px: 2, py: 1.5 }}
          >
            Nothing matches “{q.trim()}”.
          </Typography>
        )}
      </Popover>
    </>
  );
};
GlobalSearch.propTypes = { compact: PropTypes.bool };

/** Bell: orders to fulfil, delayed orders, returns and stock alerts. */
const Notifications = ({ counts }) => {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(null);
  const items = [
    counts.delayed > 0 && {
      icon: <FiAlertTriangle />,
      tone: 'error.main',
      text: `${counts.delayed} order${counts.delayed === 1 ? ' is' : 's are'} waiting more than 3 days`,
      to: '/admin/orders',
    },
    counts.to_fulfil > 0 && {
      icon: <FiPackage />,
      tone: 'primary.main',
      text: `${counts.to_fulfil} order${counts.to_fulfil === 1 ? '' : 's'} to fulfil`,
      to: '/admin/orders',
    },
    counts.open_returns > 0 && {
      icon: <FiRotateCcw />,
      tone: 'warning.main',
      text: `${counts.open_returns} return request${counts.open_returns === 1 ? '' : 's'}`,
      to: '/admin/returns',
    },
    counts.out_of_stock > 0 && {
      icon: <FiBox />,
      tone: 'error.main',
      text: `${counts.out_of_stock} product${counts.out_of_stock === 1 ? '' : 's'} out of stock`,
      to: '/admin/products?stock=out',
    },
    counts.low_stock > 0 && {
      icon: <FiBox />,
      tone: 'warning.main',
      text: `${counts.low_stock} product${counts.low_stock === 1 ? '' : 's'} running low`,
      to: '/admin/products?stock=low',
    },
  ].filter(Boolean);

  return (
    <>
      <IconButton
        aria-label={`Notifications, ${items.length}`}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          width: 48,
          height: 48,
          borderRadius: '8px',
          bgcolor: 'background.neutral',
          color: 'text.primary',
          '&:hover': { bgcolor: 'background.neutralDeep' },
        }}
      >
        <Badge
          variant="dot"
          color="error"
          invisible={!items.length}
          overlap="circular"
        >
          <FiBell />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1.5,
              width: 320,
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
              boxShadow: '0 24px 48px rgba(27,33,36,0.12)',
            },
          },
        }}
      >
        <Typography variant="subtitle1" sx={{ px: 2.5, pt: 1, pb: 1.5 }}>
          Notifications
        </Typography>
        <Divider />
        {items.length ? (
          items.map((it) => (
            <MenuItem
              key={it.text}
              onClick={() => {
                setAnchor(null);
                navigate(it.to);
              }}
              sx={{ gap: 1.5, py: 1.25, px: 2.5, whiteSpace: 'normal' }}
            >
              <Box sx={{ color: it.tone, display: 'flex' }}>{it.icon}</Box>
              <Typography variant="body2">{it.text}</Typography>
            </MenuItem>
          ))
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ px: 2.5, py: 2 }}
          >
            You’re all caught up.
          </Typography>
        )}
      </Menu>
    </>
  );
};
Notifications.propTypes = { counts: PropTypes.object.isRequired };

const AdminLayout = () => {
  const { user, logout } = useContext(AuthContext);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const counts = useAttention(pathname);

  const closeMenu = () => setMenuAnchor(null);

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.neutral',
      }}
    >
      {isMobile ? (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{ sx: { width: RAIL_WIDTH } }}
        >
          <Rail onNavigate={() => setDrawerOpen(false)} counts={counts} />
        </Drawer>
      ) : (
        <Box
          component="aside"
          sx={{
            width: RAIL_WIDTH,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            position: 'sticky',
            top: 0,
            height: '100vh',
          }}
        >
          <Rail counts={counts} />
        </Box>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={{ xs: 1, md: 1.5 }}
          sx={{
            height: 84,
            px: { xs: 2, md: 4 },
            borderBottom: 1,
            borderColor: 'divider',
            position: 'sticky',
            top: 0,
            bgcolor: 'background.paper',
            zIndex: 3,
          }}
        >
          {isMobile && (
            <IconButton
              aria-label="Open admin menu"
              onClick={() => setDrawerOpen(true)}
            >
              <FiMenu />
            </IconButton>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'text.secondary',
              }}
            >
              Back office
            </Typography>
            <Typography
              variant="subtitle1"
              noWrap
              sx={{ fontWeight: 700, fontSize: '1.05rem' }}
              data-testid="admin-page-title"
            >
              {pageTitle(user, pathname)}
            </Typography>
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <GlobalSearch />
          </Box>
          <Button
            component={RouterLink}
            to="/"
            variant="outlined"
            sx={{
              height: 48,
              px: 2.5,
              color: 'text.primary',
              borderColor: 'divider',
              fontWeight: 700,
              display: { xs: 'none', sm: 'inline-flex' },
            }}
          >
            View storefront
          </Button>
          <Notifications counts={counts} />
          <Button
            aria-label="Account menu"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            endIcon={
              <Box
                component={FiChevronDown}
                sx={{ display: { xs: 'none', md: 'block' } }}
              />
            }
            sx={{
              height: 48,
              pl: 0.5,
              pr: { xs: 0.5, md: 1.5 },
              color: 'text.primary',
              textAlign: 'left',
              gap: 1.25,
            }}
          >
            <Avatar
              src={user?.avatar || undefined}
              alt=""
              sx={{
                width: 44,
                height: 44,
                fontSize: 14,
                fontWeight: 700,
                color: 'warning.main',
                bgcolor: alpha(theme.palette.warning.main, 0.14),
              }}
            >
              {initialsOf(user?.name)}
            </Avatar>
            <Box sx={{ display: { xs: 'none', md: 'block' }, lineHeight: 1.2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {user?.name}
              </Typography>
              <Typography variant="caption" component="div">
                {roleLabel(user?.role)}
              </Typography>
            </Box>
          </Button>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={closeMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{
              paper: {
                sx: {
                  mt: 1,
                  minWidth: 240,
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                  boxShadow: '0 24px 48px rgba(27,33,36,0.12)',
                },
              },
            }}
          >
            <MenuItem
              component={RouterLink}
              to="/admin/profile"
              onClick={closeMenu}
              sx={{ px: 2.5, py: 1.25 }}
            >
              Profile settings
            </MenuItem>
            {hasPermission(user, PERMISSIONS.rolesView) && (
              <MenuItem
                component={RouterLink}
                to="/admin/roles"
                onClick={closeMenu}
                sx={{ px: 2.5, py: 1.25 }}
              >
                Team & permissions
              </MenuItem>
            )}
            <MenuItem
              onClick={async () => {
                closeMenu();
                await logout();
                navigate('/login');
              }}
              sx={{ px: 2.5, py: 1.25, color: 'error.main' }}
            >
              Sign out
            </MenuItem>
          </Menu>
        </Stack>
        {isMobile && (
          <Box sx={{ px: 2, pt: 2, display: { md: 'none' } }}>
            <GlobalSearch compact />
          </Box>
        )}
        <Box
          component="main"
          sx={{ p: { xs: 2, md: 4, xl: 5 }, maxWidth: 1680, mx: 'auto' }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default AdminLayout;
