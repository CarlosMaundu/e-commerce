// src/pages/admin/UserAccountPage.js — a read-only view of one person's
// account for the back office: profile, role and status, shopping summary,
// addresses, recent orders, sessions and activity. Viewing is not acting:
// nothing here signs in as the customer (that is "View as customer").
import React, { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { alpha, useTheme } from '@mui/material/styles';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Grid,
  Link,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import {
  FiDollarSign,
  FiEye,
  FiHeart,
  FiKey,
  FiLogOut,
  FiPackage,
  FiRotateCcw,
  FiShoppingCart,
  FiStar,
  FiUnlock,
  FiArrowUpRight,
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { adminOrders, adminSecurity, adminUsers } from '../../api';
import { formatAddress } from '../../api/mappers';
import { hasPermission, PERMISSIONS, roleLabel } from '../../auth/permissions';
import { useNotify } from '../../notification/NotificationProvider';
import { SectionCard, StatusChip } from '../../components/ui';
import {
  EmptyRow,
  LoadingRows,
  PageHeader,
  PagedList,
  Pill,
  StandardPagination,
  TablePanel,
  usePaging,
} from '../../components/admin/DataTable';
import {
  ActivityList,
  SessionsTable,
  timeAgo,
} from '../../components/security/SecurityWidgets';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatShortDate,
} from '../../utils/format';

/** Compact white stat card: icon square, small caps label and value; a link when it has details. */
const CustomerStat = ({ label, value, icon, color, to }) => {
  const theme = useTheme();
  const main = theme.palette[color].main;
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      component={to ? RouterLink : 'div'}
      to={to || undefined}
      aria-label={to ? `${label}: ${value}. View details` : undefined}
      data-testid={`customer-stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
      sx={{
        px: 2,
        py: 1.5,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: 'text.primary',
        textDecoration: 'none',
        transition: 'border-color .15s, box-shadow .15s',
        ...(to && {
          '&:hover': {
            borderColor: alpha(main, 0.5),
            boxShadow: `0 6px 18px ${alpha(main, 0.1)}`,
          },
        }),
      }}
    >
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: '8px',
          display: 'grid',
          placeItems: 'center',
          fontSize: 16,
          flexShrink: 0,
          color: main,
          bgcolor: alpha(main, 0.12),
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          noWrap
          sx={{
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'text.secondary',
          }}
        >
          {label}
        </Typography>
        <Typography noWrap sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
          {value}
        </Typography>
      </Box>
      {to && (
        <Box sx={{ color: 'text.disabled', fontSize: 16, flexShrink: 0 }}>
          <FiArrowUpRight />
        </Box>
      )}
    </Stack>
  );
};
CustomerStat.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node,
  icon: PropTypes.node.isRequired,
  color: PropTypes.string.isRequired,
  to: PropTypes.string,
};

const PAYMENT_PILLS = {
  paid: ['Paid', 'success'],
  pending: ['Due', 'warning'],
  failed: ['Failed', 'error'],
  refunded: ['Refunded', 'default'],
};

/** The customer's orders in the standard table, paged on the server. */
const CustomerOrders = ({ customerId }) => {
  const notify = useNotify();
  const paging = usePaging();
  const [data, setData] = useState(null);
  const { page, rowsPerPage } = paging;
  useEffect(() => {
    let active = true;
    setData(null);
    adminOrders
      .list({ customer: customerId, page: page + 1, limit: rowsPerPage })
      .then((d) => active && setData(d))
      .catch((error) => {
        notify.error(error, 'We couldn’t load orders.');
        if (active) setData({ orders: [], total: 0 });
      });
    return () => {
      active = false;
    };
  }, [customerId, page, rowsPerPage, notify]);

  return (
    <TablePanel>
      <TableContainer>
        <Table aria-label="Orders">
          <TableHead sx={{ bgcolor: 'background.neutral' }}>
            <TableRow>
              <TableCell>Order</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Items</TableCell>
              <TableCell>Payment</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!data && <LoadingRows cols={6} rows={rowsPerPage} />}
            {data && !data.orders.length && (
              <EmptyRow cols={6}>No orders yet.</EmptyRow>
            )}
            {data?.orders.map((o) => {
              const [payLabel, payTone] = PAYMENT_PILLS[o.paymentStatus] || [
                o.paymentStatus || '—',
                'default',
              ];
              return (
                <TableRow
                  key={o.id}
                  hover
                  data-testid={`customer-order-${o.id}`}
                >
                  <TableCell>
                    <Link
                      component={RouterLink}
                      to={`/admin/orders/${o.id}`}
                      underline="hover"
                      sx={{ fontWeight: 700 }}
                    >
                      #{o.id}
                    </Link>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {formatShortDate(o.placedAt)}
                  </TableCell>
                  <TableCell>{o.itemCount}</TableCell>
                  <TableCell>
                    <Pill label={payLabel} tone={payTone} />
                  </TableCell>
                  <TableCell>
                    <StatusChip status={o.status} label={o.statusName} />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {formatMoney(o.total)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {data && data.total > 0 && (
        <StandardPagination
          count={data.total}
          {...paging.props}
          label="orders"
        />
      )}
    </TablePanel>
  );
};
CustomerOrders.propTypes = { customerId: PropTypes.number.isRequired };

const UserAccountPage = () => {
  const { id } = useParams();
  const { user: me, startImpersonation } = useContext(AuthContext);
  const notify = useNotify();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [activity, setActivity] = useState(null);
  const [tab, setTab] = useState('overview');
  const [confirm, setConfirm] = useState(null); // 'act' | 'signout' | 'reset'
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([adminUsers.account(id), adminSecurity.userActivity(id)])
      .then(([account, act]) => {
        setData(account);
        setActivity(act);
      })
      .catch((error) => {
        notify.error(error, 'We couldn’t load that account.');
        navigate('/admin/users');
      });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) {
    return (
      <Stack spacing={2}>
        <Skeleton height={60} width="40%" />
        <Skeleton variant="rounded" height={200} />
      </Stack>
    );
  }

  const { user, stats, staff } = data;
  // Staff accounts have no orders or addresses to show.
  const current =
    staff && (tab === 'overview' || tab === 'addresses') ? 'sessions' : tab;
  const can = (p) => hasPermission(me, p);

  const run = async (fn, success) => {
    setBusy(true);
    try {
      await fn();
      if (success) notify.success(success);
      setConfirm(null);
      load();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(false);
    }
  };

  const actAs = async () => {
    setBusy(true);
    try {
      await startImpersonation(user.id);
      notify.success(`You’re now viewing the shop as ${user.name}.`);
      navigate('/');
    } catch (error) {
      notify.error(error, 'We couldn’t start acting as that customer.');
      setBusy(false);
    }
  };

  // Each card opens its details (filtered to this customer); the cart is
  // only shown. Pages not built yet open a "coming soon" page.
  const who = `customer=${user.id}&customerName=${encodeURIComponent(user.name)}`;
  const tiles = staff
    ? []
    : [
        [
          'Orders',
          stats.orders,
          <FiPackage key="o" />,
          'primary',
          `/admin/orders?${who}`,
        ],
        [
          'Total spent',
          formatMoney(stats.spent),
          <FiDollarSign key="s" />,
          'success',
          `/admin/soon/customer-revenue?${who}&name=${encodeURIComponent(user.name)}`,
        ],
        ['In cart', stats.cart, <FiShoppingCart key="c" />, 'info', null],
        [
          'Wishlist',
          stats.wishlist,
          <FiHeart key="w" />,
          'error',
          `/admin/soon/customer-wishlist?name=${encodeURIComponent(user.name)}`,
        ],
        [
          'Returns',
          stats.returns,
          <FiRotateCcw key="r" />,
          'warning',
          `/admin/returns?${who}`,
        ],
        [
          'Reviews',
          stats.reviews,
          <FiStar key="v" />,
          'warning',
          `/admin/soon/reviews?name=${encodeURIComponent(user.name)}`,
        ],
      ];

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Users', to: '/admin/users' },
          { label: user.name, to: `/admin/users/${user.id}` },
        ]}
        title={user.name}
        subtitle={user.email}
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {user.lockedUntil && can(PERMISSIONS.usersUnlock) && (
              <Button
                variant="outlined"
                startIcon={<FiUnlock />}
                disabled={busy}
                onClick={() =>
                  run(
                    () => adminSecurity.unlock(user.id),
                    `${user.email} can sign in again.`
                  )
                }
              >
                Unlock
              </Button>
            )}
            {can(PERMISSIONS.usersResetPassword) && (
              <Button
                variant="outlined"
                startIcon={<FiKey />}
                onClick={() => setConfirm('reset')}
              >
                Send password reset
              </Button>
            )}
            {can(PERMISSIONS.usersSignout) &&
              user.id !== me.id &&
              stats.sessions > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<FiLogOut />}
                  onClick={() => setConfirm('signout')}
                >
                  Sign out everywhere
                </Button>
              )}
            {!staff &&
              user.status === 'active' &&
              can(PERMISSIONS.usersImpersonate) && (
                <Button
                  variant="contained"
                  startIcon={<FiEye />}
                  onClick={() => setConfirm('act')}
                >
                  View as customer
                </Button>
              )}
          </Stack>
        }
      />

      <Alert severity="info" icon={false}>
        You’re viewing this account read-only. To place an order or change their
        cart, use “View as customer”.
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={4}>
          <SectionCard sx={{ height: '100%', p: { xs: 2, md: 2.5 } }}>
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              sx={{ pb: 1.5, mb: 1.5, borderBottom: 1, borderColor: 'divider' }}
            >
              <Avatar
                src={user.avatar || undefined}
                alt=""
                sx={{
                  width: 48,
                  height: 48,
                  fontSize: '1.2rem',
                  bgcolor: 'primary.main',
                }}
              >
                {user.name.charAt(0)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" noWrap>
                  {user.name}
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                  <Chip
                    size="small"
                    color={staff ? 'primary' : 'default'}
                    label={roleLabel(user.role)}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    color={user.status === 'suspended' ? 'error' : 'success'}
                    label={user.status === 'suspended' ? 'Suspended' : 'Active'}
                  />
                  {user.lockedUntil && (
                    <Chip size="small" color="warning" label="Locked" />
                  )}
                </Stack>
              </Box>
            </Stack>
            <Box
              component="dl"
              sx={{
                m: 0,
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr)',
                columnGap: 2,
                rowGap: 1,
                alignItems: 'baseline',
              }}
            >
              {[
                ['Email', user.email],
                ['Joined', formatDate(user.creationAt)],
                [
                  'Last sign-in',
                  user.lastLogin ? timeAgo(user.lastLogin) : 'Never',
                ],
                [
                  'Sign-in method',
                  user.hasPassword ? 'Email and password' : 'Google',
                ],
                [
                  'Signed in on',
                  `${stats.sessions} device${stats.sessions === 1 ? '' : 's'}`,
                ],
                ...(user.lockedUntil
                  ? [['Locked until', formatDateTime(user.lockedUntil)]]
                  : []),
                ...(staff
                  ? []
                  : [
                      [
                        'Last order',
                        stats.lastOrder
                          ? formatDate(stats.lastOrder)
                          : 'None yet',
                      ],
                    ]),
              ].map(([label, value]) => (
                <React.Fragment key={label}>
                  <Typography
                    component="dt"
                    sx={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </Typography>
                  <Typography
                    component="dd"
                    variant="body2"
                    sx={{ m: 0, fontWeight: 500, overflowWrap: 'anywhere' }}
                  >
                    {value}
                  </Typography>
                </React.Fragment>
              ))}
            </Box>
          </SectionCard>
        </Grid>
        <Grid item xs={12} lg={8}>
          {staff ? (
            <SectionCard
              title="Permissions"
              subtitle={`What the ${roleLabel(user.role)} role can do.`}
            >
              {user.permissions.includes('*') ? (
                <Chip
                  color="primary"
                  label="Everything, including roles and security"
                />
              ) : (
                <Stack direction="row" flexWrap="wrap" gap={0.75}>
                  {user.permissions.map((p) => (
                    <Chip key={p} size="small" variant="outlined" label={p} />
                  ))}
                </Stack>
              )}
            </SectionCard>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(3, minmax(0, 1fr))',
                },
              }}
            >
              {tiles.map(([label, value, icon, color, to]) => (
                <CustomerStat
                  key={label}
                  label={label}
                  value={value}
                  icon={icon}
                  color={color}
                  to={to}
                />
              ))}
            </Box>
          )}
        </Grid>
      </Grid>

      <Box>
        <Tabs
          value={current}
          onChange={(_, v) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
        >
          {!staff && <Tab value="overview" label="Orders" />}
          {!staff && (
            <Tab
              value="addresses"
              label={`Addresses (${data.addresses.length})`}
            />
          )}
          <Tab value="sessions" label="Sessions" />
          <Tab value="activity" label="Activity" />
        </Tabs>

        {current === 'overview' &&
          (data.orders === null ? (
            <Alert severity="info">
              You don’t have permission to see orders.
            </Alert>
          ) : (
            <CustomerOrders customerId={user.id} />
          ))}

        {current === 'addresses' && (
          <Grid container spacing={2}>
            {!data.addresses.length && (
              <Grid item xs={12}>
                <Typography color="text.secondary">
                  No saved addresses.
                </Typography>
              </Grid>
            )}
            {data.addresses.map((a) => (
              <Grid item xs={12} md={6} lg={4} key={a.id}>
                <SectionCard tinted>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle1">
                      {a.firstName} {a.lastName}
                    </Typography>
                    {a.isDefault && (
                      <Chip size="small" color="primary" label="Default" />
                    )}
                  </Stack>
                  <Typography color="text.secondary">
                    {formatAddress(a)}
                  </Typography>
                  {a.phone && (
                    <Typography color="text.secondary">{a.phone}</Typography>
                  )}
                </SectionCard>
              </Grid>
            ))}
          </Grid>
        )}

        {current === 'sessions' && (
          <PagedList rows={activity?.sessions} label="sessions">
            {(rows) => (
              <SessionsTable
                sessions={rows}
                emptyText="Not signed in anywhere."
              />
            )}
          </PagedList>
        )}
        {current === 'activity' && (
          <PagedList rows={activity?.activity} label="events" padded>
            {(rows) => <ActivityList activity={rows} />}
          </PagedList>
        )}
      </Box>

      <ConfirmationDialog
        open={confirm === 'act'}
        title={`View the shop as ${user.name}?`}
        content="You’ll see their cart, orders and account, and can place orders or request returns for them, for up to 30 minutes. Everything you do is recorded under your name."
        confirmText="View as customer"
        loading={busy}
        onConfirm={actAs}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmationDialog
        open={confirm === 'signout'}
        title={`Sign ${user.email} out everywhere?`}
        content="They’ll be signed out on every device straight away."
        confirmText="Sign out"
        loading={busy}
        onConfirm={() =>
          run(
            () => adminSecurity.signOutEverywhere(user.id),
            `${user.email} was signed out everywhere.`
          )
        }
        onCancel={() => setConfirm(null)}
      />
      <ConfirmationDialog
        open={confirm === 'reset'}
        title="Send password reset email?"
        content={`We’ll email ${user.email} a link to choose a new password.`}
        confirmText="Send email"
        loading={busy}
        onConfirm={() =>
          run(
            () => adminUsers.sendPasswordReset(user.id),
            `Password reset email sent to ${user.email}.`
          )
        }
        onCancel={() => setConfirm(null)}
      />
    </Stack>
  );
};

export default UserAccountPage;
