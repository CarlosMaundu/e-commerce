// src/pages/account/AccountOverviewPage.js — the customer's home: profile
// card, summary tiles, order tracking and services (Aurora-style layout).
import React, { useContext, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  FiCreditCard,
  FiEdit2,
  FiHeart,
  FiHelpCircle,
  FiLock,
  FiMapPin,
  FiPackage,
  FiRotateCcw,
  FiTruck,
  FiBox,
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { addresses as addressApi, orders as ordersApi } from '../../api';
import { formatAddress } from '../../api/mappers';
import { DetailRows, StatTile, StatusChip } from '../../components/ui';
import { formatDate } from '../../utils/format';
import { roleLabel, isStaff } from '../../auth/permissions';

const SERVICES = [
  { label: 'Login & security', icon: <FiLock />, to: '/account/security' },
  { label: 'My orders', icon: <FiPackage />, to: '/account/orders' },
  { label: 'Addresses', icon: <FiMapPin />, to: '/account/addresses' },
  { label: 'Wishlist', icon: <FiHeart />, to: '/wishlist' },
  { label: 'Returns', icon: <FiRotateCcw />, to: '/account/returns' },
  {
    label: 'Customer service',
    icon: <FiHelpCircle />,
    to: '/information/support',
  },
];

const ServiceLink = ({ item }) => (
  <Box
    component={RouterLink}
    to={item.to}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      px: 3,
      py: 2.25,
      borderRadius: 1,
      bgcolor: 'background.neutralDeep',
      color: 'text.primary',
      textDecoration: 'none',
      fontWeight: 600,
      '& svg': { color: 'primary.main', fontSize: 20 },
      '&:hover': {
        bgcolor: 'background.neutral',
        outline: 1,
        outlineColor: 'divider',
      },
    }}
  >
    {item.icon}
    {item.label}
  </Box>
);

const ACTIVE = ['pending', 'processing', 'shipped'];

const AccountOverviewPage = () => {
  const { user } = useContext(AuthContext);
  const theme = useTheme();
  const navigate = useNavigate();
  const wishlistCount = useSelector((s) => s.wishlist.items.length);
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      ordersApi.list({ limit: 50 }),
      addressApi.list(),
      ordersApi.listReturns(),
    ])
      .then(([orderPage, addressList, returnList]) => {
        if (active)
          setData({
            ...orderPage,
            addresses: addressList,
            returns: returnList,
          });
      })
      .catch(
        () =>
          active &&
          setData({ orders: [], total: 0, addresses: [], returns: [] })
      );
    return () => {
      active = false;
    };
  }, []);

  const defaultAddress =
    data?.addresses.find((a) => a.isDefault) || data?.addresses[0];
  const count = (statuses) =>
    data?.orders.filter((o) => statuses.includes(o.status)).length || 0;
  const tracking = data?.orders.find((o) => ACTIVE.includes(o.status));
  const openReturns =
    data?.returns.filter((r) => ['requested', 'approved'].includes(r.status))
      .length || 0;

  return (
    <Container maxWidth="xl" disableGutters>
      <Grid container>
        <Grid
          item
          xs={12}
          md={8}
          sx={{ borderRight: { md: 1 }, borderColor: { md: 'divider' } }}
        >
          {/* Profile card */}
          <Box
            sx={{
              p: { xs: 2, md: 5 },
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Box
              sx={{
                borderRadius: 1,
                p: { xs: 3, md: 4 },
                background: `linear-gradient(120deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(
                  theme.palette.secondary.main,
                  0.08
                )} 100%)`,
              }}
            >
              <Stack
                direction="row"
                spacing={3}
                alignItems="center"
                sx={{ mb: 4 }}
              >
                <Avatar
                  src={user.avatar || undefined}
                  alt=""
                  sx={{
                    width: { xs: 72, md: 112 },
                    height: { xs: 72, md: 112 },
                    bgcolor: 'primary.main',
                    fontSize: 36,
                  }}
                >
                  {user.name?.charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h4" component="h1">
                    {user.name}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mt: 1 }}
                    alignItems="center"
                    flexWrap="wrap"
                  >
                    <Chip
                      size="small"
                      color="warning"
                      label={roleLabel(user.role)}
                      sx={{ color: '#fff' }}
                    />
                    {user.creationAt && (
                      <Typography variant="caption">
                        Member since {formatDate(user.creationAt)}
                      </Typography>
                    )}
                  </Stack>
                </Box>
                <Button
                  component={RouterLink}
                  to="/account/profile"
                  startIcon={<FiEdit2 />}
                  color="inherit"
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Edit information
                </Button>
              </Stack>
              <DetailRows
                rows={[
                  ['Email address', user.email],
                  [
                    'Default delivery address',
                    data ? (
                      formatAddress(defaultAddress) || 'Not set yet'
                    ) : (
                      <Skeleton width={240} />
                    ),
                  ],
                  ['Phone number', defaultAddress?.phone],
                ]}
              />
              {isStaff(user) && (
                <Button
                  component={RouterLink}
                  to="/admin"
                  variant="contained"
                  sx={{ mt: 3 }}
                >
                  Open the back office
                </Button>
              )}
            </Box>
          </Box>

          {/* Summary */}
          <Box
            sx={{
              p: { xs: 2, md: 5 },
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="h5" component="h2" sx={{ mb: 2.5 }}>
              Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <StatTile
                  icon={<FiHeart />}
                  value={wishlistCount}
                  label="Wishlist"
                  onClick={() => navigate('/wishlist')}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <StatTile
                  icon={<FiPackage />}
                  value={data ? data.total : '–'}
                  label="Orders"
                  onClick={() => navigate('/account/orders')}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <StatTile
                  icon={<FiMapPin />}
                  value={data ? data.addresses.length : '–'}
                  label="Addresses"
                  onClick={() => navigate('/account/addresses')}
                />
              </Grid>
            </Grid>
          </Box>

          {/* Track orders */}
          <Box
            sx={{
              p: { xs: 2, md: 5 },
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="h5" component="h2" sx={{ mb: 2.5 }}>
              Track orders
            </Typography>
            {!data ? (
              <Skeleton variant="rounded" height={160} />
            ) : tracking ? (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={3}
                alignItems={{ sm: 'center' }}
                sx={{ bgcolor: 'background.neutral', borderRadius: 1, p: 3 }}
              >
                <Box
                  component="img"
                  src={tracking.preview[0]?.image}
                  alt=""
                  sx={{
                    width: 140,
                    height: 110,
                    objectFit: 'contain',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                  }}
                />
                <Box sx={{ flex: 1 }}>
                  <StatusChip
                    status={tracking.status}
                    label={tracking.statusName}
                  />
                  <Typography sx={{ mt: 1.5 }}>
                    Order #{tracking.id} · {tracking.itemCount} item
                    {tracking.itemCount === 1 ? '' : 's'} · placed{' '}
                    {formatDate(tracking.placedAt)}
                  </Typography>
                  <Typography
                    component={RouterLink}
                    to={`/account/orders/${tracking.id}`}
                    sx={{
                      color: 'primary.main',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'inline-block',
                      mt: 1,
                    }}
                  >
                    Track this order
                  </Typography>
                </Box>
              </Stack>
            ) : (
              <Typography color="text.secondary">
                No orders on the way.{' '}
                <Typography
                  component={RouterLink}
                  to="/products"
                  sx={{
                    color: 'primary.main',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Start shopping
                </Typography>
              </Typography>
            )}
          </Box>

          {/* Order status */}
          <Box sx={{ p: { xs: 2, md: 5 } }}>
            <Typography variant="h5" component="h2" sx={{ mb: 2.5 }}>
              Order status
            </Typography>
            <Grid container spacing={2}>
              {[
                {
                  label: 'To pay',
                  icon: <FiCreditCard />,
                  n: count(['awaiting_payment']),
                  to: '/account/orders?status=awaiting_payment',
                },
                {
                  label: 'To ship',
                  icon: <FiTruck />,
                  n: count(['pending', 'processing']),
                  to: '/account/orders?status=pending,processing',
                },
                {
                  label: 'To receive',
                  icon: <FiBox />,
                  n: count(['shipped']),
                  to: '/account/orders?status=shipped',
                },
                {
                  label: 'Returns',
                  icon: <FiRotateCcw />,
                  n: openReturns,
                  to: '/account/returns',
                },
              ].map((t) => (
                <Grid item xs={6} md={3} key={t.label}>
                  <Box
                    component={RouterLink}
                    to={t.to}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 4,
                      borderRadius: 1,
                      bgcolor: 'background.neutral',
                      color: 'text.primary',
                      textDecoration: 'none',
                      '& svg': { fontSize: 34, color: 'primary.main' },
                      '&:hover': { bgcolor: 'background.neutralDeep' },
                    }}
                  >
                    {t.icon}
                    <Typography variant="subtitle1">
                      {t.label}
                      {t.n > 0 && (
                        <Box component="span" sx={{ color: 'error.main' }}>
                          {' '}
                          ({t.n})
                        </Box>
                      )}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Grid>

        {/* My services */}
        <Grid item xs={12} md={4} sx={{ bgcolor: 'background.neutral' }}>
          <Box
            sx={{
              p: { xs: 2, md: 5 },
              position: { md: 'sticky' },
              top: { md: 120 },
            }}
          >
            <Typography variant="h5" component="h2" sx={{ mb: 2.5 }}>
              My services
            </Typography>
            <Stack spacing={1.25}>
              {SERVICES.map((item) => (
                <ServiceLink key={item.to} item={item} />
              ))}
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default AccountOverviewPage;
