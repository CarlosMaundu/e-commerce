// src/layouts/AdminLayout.js — back office shell: left navigation rail
// (items shown by permission) and a top bar. Aurora-style, our own code.
import React, { useContext, useState } from 'react';
import {
  NavLink,
  Outlet,
  Link as RouterLink,
  useNavigate,
} from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  FiBox,
  FiExternalLink,
  FiHome,
  FiLogOut,
  FiMenu,
  FiPackage,
  FiRotateCcw,
  FiShield,
  FiUser,
  FiUsers,
  FiLock,
  FiActivity,
} from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import {
  hasPermission,
  hasPermissionPrefix,
  PERMISSIONS,
  roleLabel,
} from '../auth/permissions';
import logo from '../images/logo.png';

const RAIL_WIDTH = 264;

export const adminNav = (user) =>
  [
    {
      heading: 'Overview',
      items: [
        {
          label: 'Dashboard',
          to: '/admin',
          icon: <FiHome />,
          end: true,
          show: hasPermission(user, PERMISSIONS.dashboardView),
        },
      ],
    },
    {
      heading: 'Sales',
      items: [
        {
          label: 'Orders',
          to: '/admin/orders',
          icon: <FiPackage />,
          show: hasPermission(user, PERMISSIONS.ordersView),
        },
        {
          label: 'Returns',
          to: '/admin/returns',
          icon: <FiRotateCcw />,
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
          icon: <FiBox />,
          show: hasPermissionPrefix(user, 'catalog.'),
        },
      ],
    },
    {
      heading: 'People',
      items: [
        {
          label: 'Users',
          to: '/admin/users',
          icon: <FiUsers />,
          show: hasPermission(user, PERMISSIONS.usersView),
        },
        {
          label: 'Roles',
          to: '/admin/roles',
          icon: <FiShield />,
          show: hasPermission(user, PERMISSIONS.rolesView),
        },
      ],
    },
    {
      heading: 'System',
      items: [
        {
          label: 'Security',
          to: '/admin/security',
          icon: <FiLock />,
          show: hasPermission(user, PERMISSIONS.securityView),
        },
        {
          label: 'Audit log',
          to: '/admin/audit',
          icon: <FiActivity />,
          show: hasPermission(user, PERMISSIONS.auditView),
        },
      ],
    },
  ]
    .map((g) => ({ ...g, items: g.items.filter((i) => i.show) }))
    .filter((g) => g.items.length);

const Rail = ({ onNavigate }) => {
  const { user } = useContext(AuthContext);
  const theme = useTheme();
  return (
    <Stack sx={{ height: '100%', p: 2.5 }} spacing={3}>
      <Box
        component={RouterLink}
        to="/admin"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          textDecoration: 'none',
          color: 'text.primary',
          px: 1,
        }}
      >
        <Box component="img" src={logo} alt="" sx={{ height: 32 }} />
        <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
          Carlos Shop
        </Typography>
      </Box>
      <Box
        component="nav"
        aria-label="Admin"
        sx={{ flex: 1, overflowY: 'auto' }}
      >
        {adminNav(user).map((group) => (
          <Box key={group.heading} sx={{ mb: 2.5 }}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ px: 1.5 }}
            >
              {group.heading}
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {group.items.map((item) => (
                <Box
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.5,
                    py: 1,
                    borderRadius: 1,
                    color: 'text.primary',
                    textDecoration: 'none',
                    fontWeight: 500,
                    fontSize: '0.9rem',
                    '&:hover': { bgcolor: 'background.neutral' },
                    '&.active': {
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main',
                      fontWeight: 600,
                    },
                  }}
                >
                  {item.icon}
                  {item.label}
                </Box>
              ))}
            </Stack>
          </Box>
        ))}
      </Box>
      <Button
        component={RouterLink}
        to="/"
        variant="outlined"
        startIcon={<FiExternalLink />}
      >
        Visit shop
      </Button>
    </Stack>
  );
};

const AdminLayout = () => {
  const { user, logout } = useContext(AuthContext);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      {isMobile ? (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{ sx: { width: RAIL_WIDTH } }}
        >
          <Rail onNavigate={() => setDrawerOpen(false)} />
        </Drawer>
      ) : (
        <Box
          component="aside"
          sx={{
            width: RAIL_WIDTH,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            position: 'sticky',
            top: 0,
            height: '100vh',
          }}
        >
          <Rail />
        </Box>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={2}
          sx={{
            height: 72,
            px: { xs: 2, md: 4 },
            borderBottom: 1,
            borderColor: 'divider',
            position: 'sticky',
            top: 0,
            bgcolor: 'background.paper',
            zIndex: 2,
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
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ flex: 1 }}
          >
            Back office
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}
            >
              <Typography variant="subtitle2">{user?.name}</Typography>
              <Typography variant="caption">{roleLabel(user?.role)}</Typography>
            </Box>
            <IconButton
              aria-label="Account menu"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{ p: 0.25 }}
            >
              <Avatar
                src={user?.avatar || undefined}
                alt=""
                sx={{ bgcolor: 'primary.main' }}
              >
                {user?.name?.charAt(0)}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="subtitle2">{user?.name}</Typography>
                <Typography variant="caption">{user?.email}</Typography>
              </Box>
              <Divider />
              <MenuItem
                component={RouterLink}
                to="/admin/profile"
                onClick={() => setMenuAnchor(null)}
              >
                <FiUser style={{ marginRight: 8 }} /> My profile
              </MenuItem>
              <MenuItem
                component={RouterLink}
                to="/"
                onClick={() => setMenuAnchor(null)}
              >
                <FiExternalLink style={{ marginRight: 8 }} /> Visit shop
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={async () => {
                  setMenuAnchor(null);
                  await logout();
                  navigate('/login');
                }}
              >
                <FiLogOut style={{ marginRight: 8 }} /> Logout
              </MenuItem>
            </Menu>
          </Stack>
        </Stack>
        <Box component="main" sx={{ p: { xs: 2, md: 4 }, maxWidth: 1600 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default AdminLayout;
