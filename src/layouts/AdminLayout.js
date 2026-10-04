// src/layouts/AdminLayout.js — back office shell: a white sidebar (brand,
// grouped links with dot markers and attention badges, help card) and a top
// bar (page title, global search with ⌘K, storefront link, notifications and
// the account menu). Items are shown by permission.
import React, {
  createContext,
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
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  FiBell,
  FiBookOpen,
  FiBox,
  FiChevronDown,
  FiCornerUpLeft,
  FiCreditCard,
  FiFileText,
  FiGrid,
  FiHelpCircle,
  FiLayers,
  FiList,
  FiLock,
  FiMenu,
  FiPackage,
  FiPercent,
  FiRotateCcw,
  FiSearch,
  FiSettings,
  FiShield,
  FiShoppingBag,
  FiSliders,
  FiTag,
  FiTruck,
  FiUser,
  FiUsers,
  FiX,
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
import { kindOf, timeAgo } from '../components/admin/notificationKinds';
import { formatMoney } from '../utils/format';

const RAIL_WIDTH = 280;

export const adminNav = (user) =>
  [
    {
      heading: 'Workspace',
      items: [
        {
          label: 'Overview',
          icon: <FiGrid />,
          title: 'Store overview',
          to: '/admin',
          end: true,
          show: hasPermission(user, PERMISSIONS.dashboardView),
        },
        {
          label: 'Orders',
          icon: <FiShoppingBag />,
          to: '/admin/orders',
          badge: 'to_fulfil',
          show: hasPermission(user, PERMISSIONS.ordersView),
        },
        {
          label: 'Returns',
          icon: <FiRotateCcw />,
          to: '/admin/returns',
          badge: 'open_returns',
          show: hasPermission(user, PERMISSIONS.returnsView),
        },
      ],
    },
    {
      heading: 'Money',
      items: [
        {
          label: 'Invoices',
          icon: <FiFileText />,
          to: '/admin/invoices',
          show: hasPermission(user, PERMISSIONS.invoicesView),
        },
        {
          label: 'Payments',
          icon: <FiCreditCard />,
          to: '/admin/payments',
          show: hasPermission(user, PERMISSIONS.invoicesView),
        },
        {
          label: 'Refunds',
          icon: <FiCornerUpLeft />,
          to: '/admin/refunds',
          show: hasPermission(user, PERMISSIONS.invoicesView),
        },
        {
          label: 'Ledger',
          icon: <FiBookOpen />,
          to: '/admin/ledger',
          show: hasPermission(user, PERMISSIONS.ledgerView),
        },
      ],
    },
    {
      heading: 'Catalog',
      items: [
        {
          label: 'Products',
          icon: <FiPackage />,
          to: '/admin/products',
          show: hasPermission(user, 'catalog.products.view'),
        },
        {
          label: 'Categories',
          icon: <FiLayers />,
          to: '/admin/categories',
          show: hasPermissionPrefix(user, 'catalog.categories.'),
        },
        {
          label: 'Brands',
          icon: <FiTag />,
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
          icon: <FiUsers />,
          title: 'Users',
          to: '/admin/users',
          show: hasPermission(user, PERMISSIONS.usersView),
        },
        {
          label: 'Roles',
          icon: <FiShield />,
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
          icon: <FiSettings />,
          to: '/admin/settings',
          show: hasPermission(user, PERMISSIONS.settingsManage),
        },
        {
          label: 'Delivery options',
          icon: <FiTruck />,
          to: '/admin/delivery',
          show: hasPermission(user, PERMISSIONS.deliveryManage),
        },
        {
          label: 'Refund settings',
          icon: <FiSliders />,
          to: '/admin/refund-settings',
          show: hasPermission(user, PERMISSIONS.refundsManage),
        },
        {
          label: 'Financial settings',
          icon: <FiPercent />,
          to: '/admin/finance',
          show: hasPermission(user, PERMISSIONS.financeManage),
        },
        {
          label: 'Security',
          icon: <FiLock />,
          to: '/admin/security',
          show: hasPermission(user, PERMISSIONS.securityView),
        },
        {
          label: 'Audit log',
          icon: <FiList />,
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
  if (pathname.startsWith('/admin/notifications')) return 'Notifications';
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
  const [tick, setTick] = useState(0);
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
  }, [pathname, tick]);
  return [counts, setCounts, () => setTick((n) => n + 1)];
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
                      '& .nav-icon': {
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 18,
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
                      },
                    }}
                  >
                    <Box component="span" className="nav-icon" aria-hidden>
                      {item.icon}
                    </Box>
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
    </Stack>
  );
};
Rail.propTypes = { onNavigate: PropTypes.func, counts: PropTypes.object };

/**
 * "Need some help?" card, floating bottom right. Closing it leaves a round
 * help button; the choice is remembered on this device.
 */
const HELP_KEY = 'admin-help-closed';

// Pages with a bottom action bar (Save / Cancel) hide the help card while
// that bar is showing, so it never covers the buttons.
const HelpSpaceContext = createContext(() => {});
export const useHideHelpWhile = (hidden) => {
  const setHidden = useContext(HelpSpaceContext);
  useEffect(() => {
    setHidden(hidden);
    return () => setHidden(false);
  }, [hidden, setHidden]);
};

const HelpCard = ({ hidden }) => {
  const [closed, setClosed] = useState(() => {
    try {
      return localStorage.getItem(HELP_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = (next) => {
    setClosed(next);
    try {
      localStorage.setItem(HELP_KEY, next ? '1' : '0');
    } catch {
      // storage unavailable: this visit only
    }
  };
  const theme = useTheme();
  if (hidden) return null;
  if (closed) {
    return (
      <Tooltip title="Need some help?" placement="left">
        <IconButton
          aria-label="Open help"
          onClick={() => toggle(false)}
          sx={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: theme.zIndex.speedDial,
            width: 52,
            height: 52,
            bgcolor: 'ink.main',
            color: 'highlight.main',
            boxShadow: '0 12px 28px rgba(27,33,36,0.28)',
            '&:hover': { bgcolor: 'ink.light' },
          }}
        >
          <FiHelpCircle size={24} />
        </IconButton>
      </Tooltip>
    );
  }
  return (
    <Box
      role="complementary"
      aria-label="Help"
      sx={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: theme.zIndex.speedDial,
        width: 290,
        maxWidth: 'calc(100vw - 48px)',
        p: 2.5,
        pr: 5,
        borderRadius: 1,
        bgcolor: 'ink.main',
        color: 'common.white',
        boxShadow: '0 18px 40px rgba(27,33,36,0.3)',
      }}
    >
      <IconButton
        aria-label="Close help"
        size="small"
        onClick={() => toggle(true)}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          color: alpha('#fff', 0.7),
        }}
      >
        <FiX />
      </IconButton>
      <Typography sx={{ fontWeight: 700 }}>Need some help?</Typography>
      <Typography variant="body2" sx={{ mt: 0.75, color: alpha('#fff', 0.7) }}>
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
  );
};

HelpCard.propTypes = { hidden: PropTypes.bool };

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
            primary: `Order ${o.number}`,
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

/** Bell: what needs attention for this person; read, dismiss or clear. */
const Notifications = ({ counts, setCounts, reload }) => {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(null);
  const items = counts.items || [];
  const unread = counts.unread || 0;

  const open = (e) => {
    setAnchor(e.currentTarget);
    if (unread) {
      adminOrders.notificationsRead().catch(() => {});
      setCounts((c) => ({
        ...c,
        unread: 0,
        items: (c.items || []).map((i) => ({ ...i, unread: false })),
      }));
    }
  };
  const dismiss = (key) => {
    setCounts((c) => ({
      ...c,
      items: (c.items || []).filter((i) => i.key !== key),
    }));
    adminOrders.dismissNotification(key).catch(reload);
  };
  const clearAll = () => {
    setCounts((c) => ({ ...c, items: [], unread: 0 }));
    adminOrders.notificationsClear().catch(reload);
  };

  return (
    <>
      <IconButton
        aria-label={`Notifications${unread ? `, ${unread} new` : ''}`}
        onClick={open}
        sx={{
          width: 48,
          height: 48,
          borderRadius: '8px',
          bgcolor: 'background.neutral',
          color: 'text.primary',
          '&:hover': { bgcolor: 'background.neutralDeep' },
        }}
      >
        <Badge badgeContent={unread} color="error" max={99} invisible={!unread}>
          <FiBell />
        </Badge>
      </IconButton>
      <Popover
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1.5,
              width: { xs: 'calc(100vw - 32px)', sm: 380 },
              maxHeight: 520,
              display: 'flex',
              flexDirection: 'column',
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
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2.5, py: 1.5 }}
        >
          <Typography variant="subtitle1">Notifications</Typography>
          {items.length > 0 && (
            <Button size="small" onClick={clearAll}>
              Clear all
            </Button>
          )}
        </Stack>
        <Divider />
        <Box sx={{ overflowY: 'auto' }} data-testid="notification-list">
          {items.length ? (
            items.map((it) => {
              const { icon, tone } = kindOf(it.kind);
              return (
                <Stack
                  key={it.key}
                  direction="row"
                  spacing={1.5}
                  sx={{
                    px: 2.5,
                    py: 1.25,
                    borderBottom: 1,
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'background.neutral' },
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      flexShrink: 0,
                      borderRadius: '8px',
                      display: 'grid',
                      placeItems: 'center',
                      color: `${tone}.main`,
                      bgcolor: 'background.neutral',
                    }}
                  >
                    {icon}
                  </Box>
                  <Box
                    role="link"
                    tabIndex={0}
                    onClick={() => {
                      setAnchor(null);
                      navigate(it.link);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setAnchor(null);
                        navigate(it.link);
                      }
                    }}
                    sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {it.title}
                    </Typography>
                    <Typography variant="caption" component="div">
                      {it.body}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      {timeAgo(it.at)}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    aria-label={`Dismiss: ${it.title}`}
                    onClick={() => dismiss(it.key)}
                    sx={{ alignSelf: 'flex-start', color: 'text.disabled' }}
                  >
                    <FiX />
                  </IconButton>
                </Stack>
              );
            })
          ) : (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ px: 2.5, py: 3, textAlign: 'center' }}
            >
              You’re all caught up.
            </Typography>
          )}
        </Box>
        <Divider />
        <Button
          fullWidth
          onClick={() => {
            setAnchor(null);
            navigate('/admin/notifications');
          }}
          sx={{ borderRadius: 0, py: 1.25 }}
        >
          {counts.total > items.length
            ? `View all ${counts.total} notifications`
            : 'View all notifications'}
        </Button>
      </Popover>
    </>
  );
};
Notifications.propTypes = {
  counts: PropTypes.object.isRequired,
  setCounts: PropTypes.func.isRequired,
  reload: PropTypes.func.isRequired,
};

const AdminLayout = () => {
  const { user, logout } = useContext(AuthContext);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [counts, setCounts, reloadAttention] = useAttention(pathname);
  const [helpHidden, setHelpHidden] = useState(false);

  const closeMenu = () => setMenuAnchor(null);

  return (
    <HelpSpaceContext.Provider value={setHelpHidden}>
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
            <Notifications
              counts={counts}
              setCounts={setCounts}
              reload={reloadAttention}
            />
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
              <Box
                sx={{ display: { xs: 'none', md: 'block' }, lineHeight: 1.2 }}
              >
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
            // Bottom room so the floating help never covers the last row.
            sx={{
              p: { xs: 2, md: 4, xl: 5 },
              pb: { xs: 12, md: 12, xl: 12 },
              maxWidth: 1680,
              mx: 'auto',
            }}
          >
            <Outlet />
          </Box>
          <HelpCard hidden={helpHidden} />
        </Box>
      </Box>
    </HelpSpaceContext.Provider>
  );
};

export default AdminLayout;
