// src/pages/account/AccountOverviewPage.js — the account home: a greeting,
// clickable summary cards, the latest order with its progress, recent
// orders and the default delivery address.
import React, { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box, Button, Link, Skeleton, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  FiArrowRight,
  FiHeart,
  FiMapPin,
  FiPackage,
  FiRotateCcw,
  FiTruck,
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { addresses as addressApi, orders as ordersApi } from '../../api';
import { formatAddress } from '../../api/mappers';
import { isStaff } from '../../auth/permissions';
import { EmptyState, SectionCard, StatusChip } from '../../components/ui';
import OrderTracker from '../../components/account/OrderTracker';
import { formatDate, formatMoney } from '../../utils/format';

const ACTIVE = ['awaiting_payment', 'pending', 'processing', 'shipped'];

const SummaryCard = ({ icon, value, label, to, tone }) => {
  const theme = useTheme();
  const color = theme.palette[tone].main;
  return (
    <Box
      component={RouterLink}
      to={to}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2.5,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: 'text.primary',
        textDecoration: 'none',
        transition: 'border-color .15s, box-shadow .15s',
        '&:hover': {
          borderColor: alpha(color, 0.5),
          boxShadow: `0 8px 24px ${alpha(color, 0.12)}`,
        },
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '8px',
          display: 'grid',
          placeItems: 'center',
          fontSize: 22,
          color,
          bgcolor: alpha(color, 0.12),
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{ fontWeight: 800, fontSize: '1.5rem', lineHeight: 1.1 }}
        >
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Box>
  );
};
SummaryCard.propTypes = {
  icon: PropTypes.node.isRequired,
  value: PropTypes.node,
  label: PropTypes.string.isRequired,
  to: PropTypes.string.isRequired,
  tone: PropTypes.string.isRequired,
};

const AccountOverviewPage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const wishlistCount = useSelector((s) => s.wishlist.items.length);
  const [data, setData] = useState(null);
  const [latest, setLatest] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      ordersApi.list({ limit: 50 }),
      addressApi.list(),
      ordersApi.listReturns(),
    ])
      .then(([orderPage, addressList, returnList]) => {
        if (!active) return;
        setData({ ...orderPage, addresses: addressList, returns: returnList });
        const newest =
          orderPage.orders.find((o) => ACTIVE.includes(o.status)) ||
          orderPage.orders[0];
        if (newest)
          ordersApi
            .get(newest.id)
            .then((o) => active && setLatest(o))
            .catch(() => {});
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

  const firstName = user.firstName || user.name.split(' ')[0];
  const onTheWay = data?.orders.filter((o) => ACTIVE.includes(o.status)).length;
  const openReturns = data?.returns.filter((r) =>
    ['requested', 'approved'].includes(r.status)
  ).length;
  const defaultAddress =
    data?.addresses.find((a) => a.isDefault) || data?.addresses[0];
  const loading = (v) => (data ? v : <Skeleton width={32} />);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'flex-end' }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box>
          <Typography variant="h4" component="h1">
            Hi, {firstName}
          </Typography>
          <Typography color="text.secondary">
            Your orders, deliveries and details in one place.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {isStaff(user) && (
            <Button component={RouterLink} to="/admin">
              Back office
            </Button>
          )}
          <Button component={RouterLink} to="/products" variant="contained">
            Continue shopping
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
        }}
      >
        <SummaryCard
          icon={<FiPackage />}
          value={loading(data?.total)}
          label="Orders"
          to="/account/orders"
          tone="primary"
        />
        <SummaryCard
          icon={<FiTruck />}
          value={loading(onTheWay)}
          label="On the way"
          to="/account/track"
          tone="warning"
        />
        <SummaryCard
          icon={<FiHeart />}
          value={wishlistCount}
          label="Wishlist"
          to="/account/wishlist"
          tone="error"
        />
        <SummaryCard
          icon={<FiRotateCcw />}
          value={loading(openReturns)}
          label="Open returns"
          to="/account/returns"
          tone="success"
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(0, 2fr) minmax(0, 1fr)',
          },
          alignItems: 'start',
        }}
      >
        <SectionCard
          title={latest ? `Latest order #${latest.id}` : 'Latest order'}
          subtitle={
            latest
              ? `Placed ${formatDate(latest.placedAt)} · ${formatMoney(latest.total, latest.currency)}`
              : undefined
          }
          action={
            latest && (
              <Button
                component={RouterLink}
                to={`/account/orders/${latest.id}`}
                endIcon={<FiArrowRight />}
              >
                Details
              </Button>
            )
          }
        >
          {!data ? (
            <Skeleton variant="rounded" height={160} />
          ) : !data.orders.length ? (
            <EmptyState
              icon={<FiPackage />}
              title="No orders yet"
              action={
                <Button
                  component={RouterLink}
                  to="/products"
                  variant="contained"
                >
                  Start shopping
                </Button>
              }
            >
              Your orders will appear here.
            </EmptyState>
          ) : !latest ? (
            <Skeleton variant="rounded" height={160} />
          ) : (
            <Stack spacing={3}>
              <OrderTracker order={latest} />
              <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto' }}>
                {latest.items.slice(0, 5).map((item) => (
                  <Box
                    key={item.id}
                    component={item.productId ? RouterLink : 'div'}
                    to={
                      item.productId
                        ? `/products/${item.productId}?${new URLSearchParams(item.options || {})}`
                        : undefined
                    }
                    title={item.title}
                    sx={{
                      width: 72,
                      height: 72,
                      flexShrink: 0,
                      borderRadius: '8px',
                      bgcolor: 'background.neutral',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      component="img"
                      src={item.image}
                      alt={item.title}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            </Stack>
          )}
        </SectionCard>

        <Stack spacing={3}>
          <SectionCard
            title="Delivery address"
            action={
              <Button
                component={RouterLink}
                to="/account/addresses"
                size="small"
              >
                Manage
              </Button>
            }
          >
            {!data ? (
              <Skeleton height={80} />
            ) : defaultAddress ? (
              <Stack direction="row" spacing={1.5}>
                <Box sx={{ color: 'primary.main', mt: 0.25 }}>
                  <FiMapPin />
                </Box>
                <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                  <strong>{`${defaultAddress.firstName} ${defaultAddress.lastName}`}</strong>
                  <br />
                  {formatAddress(defaultAddress)}
                  {defaultAddress.phone && (
                    <>
                      <br />
                      {defaultAddress.phone}
                    </>
                  )}
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No address yet. Add one to check out faster.
              </Typography>
            )}
          </SectionCard>
          <SectionCard title="Your details">
            <Stack spacing={1}>
              <Typography variant="body2">{user.email}</Typography>
              <Typography variant="body2" color="text.secondary">
                {user.phone || 'No phone number yet'}
              </Typography>
              <Link
                component={RouterLink}
                to="/account/profile"
                variant="body2"
              >
                Edit profile
              </Link>
            </Stack>
          </SectionCard>
        </Stack>
      </Box>

      <SectionCard
        title="Recent orders"
        action={
          <Button
            component={RouterLink}
            to="/account/orders"
            endIcon={<FiArrowRight />}
          >
            All orders
          </Button>
        }
      >
        {!data ? (
          <Skeleton variant="rounded" height={180} />
        ) : !data.orders.length ? (
          <Typography color="text.secondary">No orders yet.</Typography>
        ) : (
          <Stack
            divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}
          >
            {data.orders.slice(0, 5).map((o) => (
              <Stack
                key={o.id}
                direction="row"
                alignItems="center"
                spacing={2}
                onClick={() => navigate(`/account/orders/${o.id}`)}
                sx={{
                  py: 1.5,
                  cursor: 'pointer',
                  '&:hover .order-link': { textDecoration: 'underline' },
                }}
              >
                <Box
                  component="img"
                  src={o.preview[0]?.image}
                  alt=""
                  sx={{
                    width: 44,
                    height: 44,
                    objectFit: 'contain',
                    borderRadius: '8px',
                    bgcolor: 'background.neutral',
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography className="order-link" variant="subtitle2">
                    Order #{o.id}
                  </Typography>
                  <Typography variant="caption" noWrap component="div">
                    {formatDate(o.placedAt)} · {o.itemCount} item
                    {o.itemCount === 1 ? '' : 's'}
                  </Typography>
                </Box>
                <StatusChip status={o.status} label={o.statusName} />
                <Typography
                  variant="subtitle2"
                  sx={{
                    minWidth: 110,
                    textAlign: 'right',
                    display: { xs: 'none', sm: 'block' },
                  }}
                >
                  {formatMoney(o.total, o.currency)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </SectionCard>
    </Stack>
  );
};

export default AccountOverviewPage;
