// src/layouts/AccountLayout.js — the customer's account area: a sidebar
// (who you are and every account page) beside the page, using the full
// shop width. On phones the links become a scrollable row of pills.
import React, { useContext } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Avatar,
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  FiFileText,
  FiGrid,
  FiHeart,
  FiLock,
  FiLogOut,
  FiMapPin,
  FiPackage,
  FiCornerUpLeft,
  FiRotateCcw,
  FiTruck,
  FiUser,
} from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { useNotify } from '../notification/NotificationProvider';
import { MESSAGES } from '../notification/messages';
import { initialsOf } from '../components/common/BrandMark';
import { formatDate } from '../utils/format';

export const ACCOUNT_NAV = [
  {
    heading: 'Shopping',
    items: [
      { label: 'Overview', to: '/account', icon: <FiGrid />, end: true },
      { label: 'My orders', to: '/account/orders', icon: <FiPackage /> },
      { label: 'Track an order', to: '/account/track', icon: <FiTruck /> },
      { label: 'Invoices', to: '/account/invoices', icon: <FiFileText /> },
      { label: 'Returns', to: '/account/returns', icon: <FiRotateCcw /> },
      { label: 'Refunds', to: '/account/refunds', icon: <FiCornerUpLeft /> },
      {
        label: 'Wishlist',
        to: '/account/wishlist',
        icon: <FiHeart />,
        count: 'wishlist',
      },
    ],
  },
  {
    heading: 'Account',
    items: [
      { label: 'Profile', to: '/account/profile', icon: <FiUser /> },
      { label: 'Addresses', to: '/account/addresses', icon: <FiMapPin /> },
      { label: 'Login & security', to: '/account/security', icon: <FiLock /> },
    ],
  },
];

const AccountLayout = () => {
  const { user, logout } = useContext(AuthContext);
  const notify = useNotify();
  const navigate = useNavigate();
  const theme = useTheme();
  const counts = { wishlist: useSelector((s) => s.wishlist.items.length) };

  const signOut = async () => {
    try {
      await logout();
      notify.info(MESSAGES.auth.signedOut);
    } catch (error) {
      notify.error(error);
    }
    navigate('/login');
  };

  const linkSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    px: 1.75,
    height: 44,
    borderRadius: '8px',
    color: 'text.secondary',
    textDecoration: 'none',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    '& svg': { fontSize: 18, flexShrink: 0 },
    '&:hover': { bgcolor: 'background.neutral', color: 'text.primary' },
    '&.active': {
      bgcolor: alpha(theme.palette.primary.main, 0.1),
      color: 'primary.main',
      fontWeight: 600,
    },
  };

  const links = ACCOUNT_NAV.flatMap((g) => g.items);

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2.5, md: 4 } }}>
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 2.5, md: 4 },
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: '280px minmax(0, 1fr)',
          },
          alignItems: 'start',
        }}
      >
        {/* Desktop sidebar */}
        <Box
          component="aside"
          aria-label="Your account"
          sx={{
            display: { xs: 'none', md: 'block' },
            position: 'sticky',
            top: 196,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
            p: 2,
          }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ p: 1, mb: 1 }}
          >
            <Avatar
              src={user.avatar || undefined}
              alt=""
              sx={{
                width: 48,
                height: 48,
                fontWeight: 700,
                bgcolor: 'highlight.main',
                color: 'text.primary',
              }}
            >
              {initialsOf(user.name)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" noWrap>
                {user.name}
              </Typography>
              <Typography variant="caption" noWrap component="div">
                {user.creationAt
                  ? `Member since ${formatDate(user.creationAt, { day: undefined })}`
                  : user.email}
              </Typography>
            </Box>
          </Stack>
          <Box component="nav" aria-label="Account pages">
            {ACCOUNT_NAV.map((group) => (
              <Box key={group.heading} sx={{ mt: 2 }}>
                <Typography
                  sx={{
                    px: 1.75,
                    mb: 0.75,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                  }}
                >
                  {group.heading}
                </Typography>
                <Stack spacing={0.25}>
                  {group.items.map((item) => (
                    <Box
                      key={item.to}
                      component={NavLink}
                      to={item.to}
                      end={item.end}
                      sx={linkSx}
                    >
                      {item.icon}
                      <Box component="span" sx={{ flex: 1 }}>
                        {item.label}
                      </Box>
                      {item.count && counts[item.count] > 0 && (
                        <Box
                          component="span"
                          sx={{
                            minWidth: 24,
                            height: 22,
                            px: 0.75,
                            borderRadius: 999,
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            bgcolor: 'background.neutralDeep',
                            color: 'text.primary',
                          }}
                        >
                          {counts[item.count]}
                        </Box>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>
          <Button
            fullWidth
            onClick={signOut}
            startIcon={<FiLogOut />}
            sx={{
              mt: 2,
              justifyContent: 'flex-start',
              px: 1.75,
              color: 'error.main',
            }}
          >
            Sign out
          </Button>
        </Box>

        {/* Phone: scrollable pills */}
        <Box
          component="nav"
          aria-label="Account pages"
          sx={{
            display: { xs: 'flex', md: 'none' },
            gap: 1,
            overflowX: 'auto',
            mx: -2,
            px: 2,
            pb: 0.5,
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {links.map((item) => (
            <Box
              key={item.to}
              component={NavLink}
              to={item.to}
              end={item.end}
              sx={{
                ...linkSx,
                height: 38,
                px: 1.5,
                flexShrink: 0,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                fontSize: '0.875rem',
              }}
            >
              {item.icon}
              {item.label}
            </Box>
          ))}
        </Box>

        <Box component="section" sx={{ minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>
    </Container>
  );
};

export default AccountLayout;
