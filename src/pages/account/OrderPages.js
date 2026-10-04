// src/pages/account/OrderPages.js — order history, order detail, returns.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Link as RouterLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { FiPackage, FiRefreshCw, FiRotateCcw } from 'react-icons/fi';
import { orders as ordersApi } from '../../api';
import { StandardPagination } from '../../components/admin/DataTable';
import { formatAddress } from '../../api/mappers';
import { cartReplaced } from '../../redux/cartSlice';
import { useNotify } from '../../notification/NotificationProvider';
import { AccountPage } from '../../layouts/StorefrontLayout';
import { EmptyState, SectionCard, StatusChip } from '../../components/ui';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  optionText,
} from '../../utils/format';

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'To pay', value: 'awaiting_payment' },
  { label: 'To ship', value: 'pending,processing' },
  { label: 'On the way', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled,refunded' },
];
const PAGE_SIZE = 10;

const Thumbs = ({ items }) => (
  <Stack direction="row" spacing={1}>
    {items.slice(0, 4).map((p, i) => (
      <Box
        key={i}
        component="img"
        src={p.image}
        alt={p.name || p.title || ''}
        sx={{
          width: 56,
          height: 56,
          objectFit: 'contain',
          borderRadius: 1,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
        }}
      />
    ))}
  </Stack>
);

export const OrdersPage = () => {
  const notify = useNotify();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const page = Number(params.get('page') || 1);
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    setData(null);
    ordersApi
      .list({ page, limit: PAGE_SIZE, status: status || undefined })
      .then((d) => active && setData(d))
      .catch((error) => {
        if (!active) return;
        notify.error(
          error,
          'We couldn’t load your orders. Please refresh to try again.'
        );
        setData({ orders: [], total: 0 });
      });
    return () => {
      active = false;
    };
  }, [page, status, notify]);

  return (
    <AccountPage title="My orders" subtitle="Track, return or buy again.">
      <Tabs
        value={FILTERS.some((f) => f.value === status) ? status : ''}
        onChange={(_, v) => setParams(v ? { status: v } : {})}
        variant="scrollable"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        {FILTERS.map((f) => (
          <Tab key={f.label} label={f.label} value={f.value} />
        ))}
      </Tabs>
      {!data ? (
        <Stack spacing={2}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={120} />
          ))}
        </Stack>
      ) : !data.orders.length ? (
        <SectionCard>
          <EmptyState
            icon={<FiPackage />}
            title={status ? 'No orders here' : 'No orders yet'}
            action={
              <Button component={RouterLink} to="/products" variant="contained">
                Start shopping
              </Button>
            }
          >
            {status
              ? 'Try another filter.'
              : 'When you place an order, it will appear here.'}
          </EmptyState>
        </SectionCard>
      ) : (
        <Stack spacing={2}>
          {data.orders.map((o) => (
            <Box
              key={o.id}
              component={RouterLink}
              to={`/account/orders/${o.id}`}
              data-testid={`order-${o.id}`}
              sx={{
                display: 'block',
                bgcolor: 'background.neutral',
                borderRadius: 1,
                p: 3,
                color: 'text.primary',
                textDecoration: 'none',
                '&:hover': { bgcolor: 'background.neutralDeep' },
              }}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ md: 'center' }}
              >
                <Box>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="subtitle1">Order #{o.id}</Typography>
                    <StatusChip status={o.status} label={o.statusName} />
                  </Stack>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    Placed {formatDate(o.placedAt)} · {o.itemCount} item
                    {o.itemCount === 1 ? '' : 's'}
                  </Typography>
                </Box>
                <Thumbs items={o.preview} />
                <Typography variant="h6">
                  {formatMoney(o.total, o.currency)}
                </Typography>
              </Stack>
            </Box>
          ))}
          {data.total > PAGE_SIZE && (
            <Box
              sx={{
                borderRadius: 1,
                overflow: 'hidden',
                border: 1,
                borderColor: 'divider',
              }}
            >
              <StandardPagination
                count={data.total}
                page={page - 1}
                rowsPerPage={PAGE_SIZE}
                label="orders"
                maxShowAll={0}
                onRowsPerPageChange={() => {}}
                onPageChange={(_, p) =>
                  setParams({
                    ...(status ? { status } : {}),
                    page: String(p + 1),
                  })
                }
              />
            </Box>
          )}
        </Stack>
      )}
    </AccountPage>
  );
};

const ReturnDialog = ({ order, item, reasons, onClose, onDone }) => {
  const notify = useNotify();
  const returned = order.returns
    .filter((r) => r.orderItemId === item.id && r.status !== 'rejected')
    .reduce((s, r) => s + r.quantity, 0);
  const max = item.quantity - returned;
  const [form, setForm] = useState({
    quantity: 1,
    reason: '',
    opened: false,
    comment: '',
  });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await ordersApi.requestReturn({
        orderId: order.id,
        orderItemId: item.id,
        ...form,
      });
      notify.success('Return requested. We’ll email you when it’s reviewed.');
      onDone();
    } catch (error) {
      notify.error(error, 'We couldn’t request the return. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>Return {item.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Quantity"
              size="small"
              value={form.quantity}
              onChange={(e) =>
                setForm({ ...form, quantity: Number(e.target.value) })
              }
            >
              {Array.from({ length: Math.max(max, 1) }, (_, i) => i + 1).map(
                (n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                )
              )}
            </TextField>
            <TextField
              select
              required
              label="Reason"
              size="small"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            >
              {reasons.map((r) => (
                <MenuItem key={r.code} value={r.code}>
                  {r.name}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.opened}
                  onChange={(e) =>
                    setForm({ ...form, opened: e.target.checked })
                  }
                />
              }
              label="I’ve opened or used the item"
            />
            <TextField
              label="Anything else we should know? (optional)"
              multiline
              minRows={2}
              size="small"
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={busy} variant="outlined">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || !form.reason || max < 1}
          >
            Request return
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export const OrderDetailPage = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const justPlaced = params.get('placed') === '1';
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const notify = useNotify();
  const [order, setOrder] = useState(null);
  const [missing, setMissing] = useState(false);
  const [reasons, setReasons] = useState([]);
  const [returning, setReturning] = useState(null);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await ordersApi.get(id));
    } catch (error) {
      if (error.status === 404) setMissing(true);
      else
        notify.error(
          error,
          'We couldn’t load this order. Please refresh to try again.'
        );
    }
  }, [id, notify]);

  useEffect(() => {
    load();
    ordersApi
      .returnReasons()
      .then(setReasons)
      .catch(() => {});
  }, [load]);

  const reorder = async () => {
    setReordering(true);
    try {
      const { skipped, cart } = await ordersApi.reorder(id);
      dispatch(cartReplaced(cart));
      notify.success(
        skipped
          ? 'Added the available items to your cart. Some are no longer in stock.'
          : 'Added to your cart.'
      );
      navigate('/cart');
    } catch (error) {
      notify.error(error, 'We couldn’t add these items to your cart.');
    } finally {
      setReordering(false);
    }
  };

  if (missing) {
    return (
      <AccountPage
        title="Order not found"
        back="/account/orders"
        backLabel="My orders"
      >
        <Typography color="text.secondary">
          This order doesn’t exist or belongs to another account.
        </Typography>
      </AccountPage>
    );
  }
  if (!order) {
    return (
      <AccountPage title="Order" back="/account/orders" backLabel="My orders">
        <Skeleton variant="rounded" height={320} />
      </AccountPage>
    );
  }

  const canReturn = order.status === 'delivered';
  return (
    <AccountPage
      title={`Order #${order.id}`}
      subtitle={`Placed ${formatDateTime(order.placedAt)}`}
      back="/account/orders"
      backLabel="My orders"
      action={
        <Button
          variant="outlined"
          startIcon={<FiRefreshCw />}
          onClick={reorder}
          disabled={reordering}
        >
          Buy again
        </Button>
      }
    >
      {justPlaced && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Thank you! Your order is confirmed. We’ve emailed a receipt to{' '}
          {order.email}.
        </Alert>
      )}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Stack spacing={3}>
            <SectionCard
              title="Items"
              action={
                <StatusChip status={order.status} label={order.statusName} />
              }
            >
              <Stack divider={<Divider />} spacing={2}>
                {order.items.map((item) => (
                  <Stack
                    key={item.id}
                    direction="row"
                    spacing={2}
                    alignItems="center"
                  >
                    <Box
                      component="img"
                      src={item.image}
                      alt=""
                      sx={{
                        width: 72,
                        height: 72,
                        objectFit: 'contain',
                        borderRadius: 1,
                        bgcolor: 'background.neutral',
                      }}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1">{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {[
                          optionText(item.options),
                          `Qty ${item.quantity}`,
                          formatMoney(item.price),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Typography>
                    </Box>
                    <Stack alignItems="flex-end" spacing={1}>
                      <Typography variant="subtitle1">
                        {formatMoney(item.total)}
                      </Typography>
                      {canReturn && (
                        <Button
                          size="small"
                          startIcon={<FiRotateCcw />}
                          onClick={() => setReturning(item)}
                        >
                          Return
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </SectionCard>
            <SectionCard title="Progress">
              <Stack
                spacing={2.5}
                component="ol"
                sx={{ listStyle: 'none', p: 0, m: 0 }}
              >
                {[...order.history].reverse().map((h, i) => (
                  <Stack key={i} component="li" direction="row" spacing={2}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        mt: 0.75,
                        borderRadius: '50%',
                        bgcolor: i === 0 ? 'primary.main' : 'divider',
                        flexShrink: 0,
                      }}
                    />
                    <Box>
                      <Typography variant="subtitle2">
                        {h.statusName}
                      </Typography>
                      <Typography variant="caption">
                        {formatDateTime(h.date)}
                      </Typography>
                      {h.comment && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {h.comment}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </SectionCard>
            {order.returns.length > 0 && (
              <SectionCard title="Returns">
                <Stack spacing={1.5}>
                  {order.returns.map((r) => (
                    <Stack
                      key={r.id}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography variant="body2">
                        {r.quantity} × {r.product} · {r.reasonName}
                      </Typography>
                      <StatusChip status={r.status} label={r.status} />
                    </Stack>
                  ))}
                </Stack>
              </SectionCard>
            )}
          </Stack>
        </Grid>
        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            <SectionCard title="Summary" tinted>
              <Stack spacing={1}>
                {[
                  ['Subtotal', order.totals.subtotal],
                  order.totals.discount
                    ? [
                        `Promo code${order.coupon ? ` (${order.coupon})` : ''}`,
                        -order.totals.discount,
                      ]
                    : null,
                  ['Delivery', order.totals.shipping],
                  ['Tax', order.totals.tax],
                ]
                  .filter(Boolean)
                  .map(([label, value]) => (
                    <Stack
                      key={label}
                      direction="row"
                      justifyContent="space-between"
                    >
                      <Typography color="text.secondary">{label}</Typography>
                      <Typography>{formatMoney(value)}</Typography>
                    </Stack>
                  ))}
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle1">Total</Typography>
                  <Typography variant="subtitle1">
                    {formatMoney(order.total, order.currency)}
                  </Typography>
                </Stack>
              </Stack>
            </SectionCard>
            <SectionCard title="Delivery" tinted>
              <Typography variant="subtitle2">
                {order.shippingAddress.firstName}{' '}
                {order.shippingAddress.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatAddress(order.shippingAddress)}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {order.shippingMethod === 'express'
                  ? 'Express delivery'
                  : 'Standard delivery'}
              </Typography>
            </SectionCard>
            <SectionCard title="Payment" tinted>
              <Typography variant="body2">
                {order.paymentMethod === 'stripe'
                  ? 'Card (Stripe)'
                  : 'Cash on delivery'}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <StatusChip
                  status={order.paymentStatus}
                  label={order.paymentStatus}
                />
              </Box>
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
      {returning && (
        <ReturnDialog
          order={order}
          item={returning}
          reasons={reasons}
          onClose={() => setReturning(null)}
          onDone={() => {
            setReturning(null);
            load();
          }}
        />
      )}
    </AccountPage>
  );
};

export const ReturnsPage = () => {
  const notify = useNotify();
  const [list, setList] = useState(null);
  useEffect(() => {
    ordersApi
      .listReturns()
      .then(setList)
      .catch((error) => {
        notify.error(error, 'We couldn’t load your returns.');
        setList([]);
      });
  }, [notify]);
  return (
    <AccountPage
      title="Returns"
      subtitle="Return delivered items from the order page."
    >
      {!list ? (
        <Skeleton variant="rounded" height={200} />
      ) : !list.length ? (
        <SectionCard>
          <EmptyState icon={<FiRotateCcw />} title="No returns">
            To return something, open a delivered order and choose Return next
            to the item.
          </EmptyState>
        </SectionCard>
      ) : (
        <Stack spacing={2}>
          {list.map((r) => (
            <Stack
              key={r.id}
              direction="row"
              spacing={2}
              alignItems="center"
              sx={{ bgcolor: 'background.neutral', borderRadius: 1, p: 2.5 }}
            >
              <Box
                component="img"
                src={r.image}
                alt=""
                sx={{
                  width: 56,
                  height: 56,
                  objectFit: 'contain',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                }}
              />
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1">
                  {r.quantity} × {r.product}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {r.reasonName} · requested {formatDate(r.date)} ·{' '}
                  <Typography
                    component={RouterLink}
                    to={`/account/orders/${r.orderId}`}
                    variant="body2"
                    sx={{ color: 'primary.main' }}
                  >
                    Order #{r.orderId}
                  </Typography>
                </Typography>
              </Box>
              <StatusChip status={r.status} label={r.status} />
            </Stack>
          ))}
        </Stack>
      )}
    </AccountPage>
  );
};
