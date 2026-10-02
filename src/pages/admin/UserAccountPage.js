// src/pages/admin/UserAccountPage.js — a read-only view of one person's
// account for the back office: profile, role and status, shopping summary,
// addresses, recent orders, sessions and activity. Viewing is not acting:
// nothing here signs in as the customer (that is "View as customer").
import React, { useContext, useEffect, useState } from 'react';
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
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { adminSecurity, adminUsers } from '../../api';
import { formatAddress } from '../../api/mappers';
import { hasPermission, PERMISSIONS, roleLabel } from '../../auth/permissions';
import { useNotify } from '../../notification/NotificationProvider';
import { SectionCard, StatTile, StatusChip } from '../../components/ui';
import { PageHeader, EmptyRow } from '../../components/admin/DataTable';
import {
  ActivityList,
  SessionsTable,
  timeAgo,
} from '../../components/security/SecurityWidgets';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import { formatDate, formatDateTime, formatMoney } from '../../utils/format';

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

  const tiles = staff
    ? []
    : [
        ['Orders', stats.orders, <FiPackage key="o" />, 'primary'],
        [
          'Total spent',
          formatMoney(stats.spent),
          <FiDollarSign key="s" />,
          'success',
        ],
        ['In cart', stats.cart, <FiShoppingCart key="c" />, 'info'],
        ['Wishlist', stats.wishlist, <FiHeart key="w" />, 'error'],
        ['Returns', stats.returns, <FiRotateCcw key="r" />, 'warning'],
        ['Reviews', stats.reviews, <FiStar key="v" />, 'warning'],
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
          <SectionCard tinted>
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              sx={{ mb: 2.5 }}
            >
              <Avatar
                src={user.avatar || undefined}
                alt=""
                sx={{
                  width: 64,
                  height: 64,
                  fontSize: '1.6rem',
                  bgcolor: 'primary.main',
                }}
              >
                {user.name.charAt(0)}
              </Avatar>
              <Box>
                <Typography variant="h5">{user.name}</Typography>
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
            <Stack spacing={1.5}>
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
                <Box key={label}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}
                  >
                    {value}
                  </Typography>
                </Box>
              ))}
            </Stack>
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
            <Grid container spacing={2}>
              {tiles.map(([label, value, icon, color]) => (
                <Grid item xs={6} md={4} key={label}>
                  <StatTile
                    label={label}
                    value={value}
                    icon={icon}
                    color={color}
                  />
                </Grid>
              ))}
            </Grid>
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
            <Box
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <TableContainer>
                <Table aria-label="Recent orders">
                  <TableHead>
                    <TableRow>
                      <TableCell>Order</TableCell>
                      <TableCell>Placed</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Items</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!data.orders.length && (
                      <EmptyRow cols={5}>No orders yet.</EmptyRow>
                    )}
                    {data.orders.map((o) => (
                      <TableRow key={o.id} hover>
                        <TableCell>
                          <Link
                            component={RouterLink}
                            to={`/admin/orders/${o.id}`}
                            underline="hover"
                            sx={{ fontWeight: 600 }}
                          >
                            #{o.id}
                          </Link>
                        </TableCell>
                        <TableCell>{formatDateTime(o.placedAt)}</TableCell>
                        <TableCell>
                          <StatusChip status={o.status} label={o.statusName} />
                        </TableCell>
                        <TableCell>{o.itemCount}</TableCell>
                        <TableCell align="right">
                          {formatMoney(o.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {stats.orders > data.orders.length && (
                <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
                  <Button
                    component={RouterLink}
                    to={`/admin/orders?search=${encodeURIComponent(user.email)}`}
                  >
                    See all {stats.orders} orders
                  </Button>
                </Box>
              )}
            </Box>
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
          <SessionsTable
            sessions={activity?.sessions}
            emptyText="Not signed in anywhere."
          />
        )}
        {current === 'activity' && (
          <ActivityList activity={activity?.activity} />
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
