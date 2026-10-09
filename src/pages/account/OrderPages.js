// src/pages/account/OrderPages.js — order history, order detail, returns.
import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
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
  Link,
  MenuItem,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  FiFileText,
  FiGrid,
  FiInfo,
  FiList,
  FiPackage,
  FiRefreshCw,
  FiRotateCcw,
  FiTruck,
} from 'react-icons/fi';
import OrderTracker from '../../components/account/OrderTracker';
import OptionRows from '../../components/common/OptionRows';
import GiftNote from '../../components/common/GiftNote';
import OrderSuccessDialog from '../../components/checkout/OrderSuccessDialog';
import { useStore } from '../../context/StoreContext';
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
  { label: 'To receive', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled,refunded' },
];
const PERIODS = [
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 6 months', value: '182' },
  { label: 'Last 12 months', value: '365' },
  { label: 'All time', value: '' },
];
const PAGE_SIZE = 10;
const VIEW_KEY = 'orders-view';

export { OptionRows };

const DAYS = { standard: [3, 5], express: [1, 2], pickup: [0, 1] };

/** "Estimated delivery 8–10 Oct", or what happened instead. */
export const deliveryNote = (o) => {
  if (o.status === 'delivered') return ['Delivered', ''];
  if (['cancelled', 'refunded'].includes(o.status)) return ['', ''];
  const [a, b] = DAYS[o.shippingMethod] || DAYS.standard;
  const from = new Date(o.placedAt);
  const day = (n) => {
    const d = new Date(from);
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };
  return o.shippingMethod === 'pickup'
    ? ['Ready for pick-up', `from ${day(b)}`]
    : ['Estimated delivery', `${day(a)} – ${day(b)}`];
};

const productLinkOf = (item) =>
  item.productId
    ? `/products/${item.productId}${
        Object.keys(item.options || {}).length
          ? `?${new URLSearchParams(item.options)}`
          : ''
      }`
    : null;

const OrderCard = ({ order: o, detailed, onReorder, reordering }) => {
  const [expanded, setExpanded] = useState(false);
  const items = o.preview || [];
  const shown = detailed ? (expanded ? items : items.slice(0, 2)) : [];
  const [noteLabel, noteValue] = deliveryNote(o);
  const actionSx = {
    bgcolor: 'background.paper',
    '&:hover': { bgcolor: 'background.neutralDeep' },
  };

  return (
    <Box
      component="article"
      data-testid={`order-${o.id}`}
      sx={{
        bgcolor: 'background.neutral',
        borderRadius: 1,
        p: { xs: 2, md: 3 },
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ pb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Link
              component={RouterLink}
              to={`/account/orders/${o.id}`}
              underline="hover"
              color="text.primary"
              variant="subtitle1"
            >
              Order {o.number}
            </Link>
            <StatusChip status={o.status} label={o.statusName} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Placed {formatDate(o.placedAt)} · {o.itemCount} item
            {o.itemCount === 1 ? '' : 's'}
          </Typography>
        </Box>
        {noteLabel && (
          <Box sx={{ textAlign: { sm: 'right' } }}>
            <Typography
              variant="caption"
              component="div"
              sx={{ fontWeight: 600 }}
            >
              {noteLabel}
            </Typography>
            <Typography variant="body2">{noteValue}</Typography>
          </Box>
        )}
      </Stack>

      {detailed ? (
        <Stack divider={<Divider />} sx={{ py: 1 }}>
          {shown.map((item, i) => {
            const link = productLinkOf(item);
            return (
              <Stack
                key={`${item.name}-${i}`}
                direction="row"
                spacing={2}
                sx={{ py: 1.5 }}
              >
                <Box
                  component={link ? RouterLink : 'div'}
                  to={link || undefined}
                  sx={{
                    width: { xs: 72, sm: 96 },
                    height: { xs: 72, sm: 96 },
                    flexShrink: 0,
                    borderRadius: '8px',
                    bgcolor: 'background.paper',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    component="img"
                    src={item.image}
                    alt={item.name}
                    sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {link ? (
                    <Link
                      component={RouterLink}
                      to={link}
                      underline="hover"
                      color="text.primary"
                      sx={{ fontWeight: 600 }}
                    >
                      {item.name}
                    </Link>
                  ) : (
                    <Typography sx={{ fontWeight: 600 }}>
                      {item.name}
                    </Typography>
                  )}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 0.75 }}
                  >
                    {item.quantity} × {formatMoney(item.price, o.currency)}
                  </Typography>
                  <OptionRows options={item.options} dense />
                </Box>
                <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {formatMoney(item.total, o.currency)}
                </Typography>
              </Stack>
            );
          })}
          {items.length > 2 && (
            <Button
              size="small"
              onClick={() => setExpanded((v) => !v)}
              sx={{ alignSelf: 'flex-start', mt: 1 }}
            >
              {expanded ? 'Show fewer items' : `Show all ${items.length} items`}
            </Button>
          )}
        </Stack>
      ) : (
        <Stack direction="row" spacing={1} sx={{ py: 2, overflowX: 'auto' }}>
          {items.slice(0, 6).map((item, i) => (
            <Box
              key={i}
              component="img"
              src={item.image}
              alt={item.name}
              title={`${item.name}${Object.keys(item.options || {}).length ? ` — ${optionText(item.options)}` : ''}`}
              sx={{
                width: 56,
                height: 56,
                flexShrink: 0,
                objectFit: 'contain',
                borderRadius: '8px',
                bgcolor: 'background.paper',
              }}
            />
          ))}
        </Stack>
      )}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            startIcon={<FiInfo />}
            component={RouterLink}
            to={`/account/orders/${o.id}`}
            sx={actionSx}
          >
            Details
          </Button>
          {!['cancelled', 'refunded'].includes(o.status) && (
            <Button
              size="small"
              startIcon={<FiTruck />}
              component={RouterLink}
              to={`/account/track?order=${o.id}`}
              sx={actionSx}
            >
              Track
            </Button>
          )}
          <Button
            size="small"
            startIcon={<FiFileText />}
            component={RouterLink}
            to={`/account/invoices/${o.id}`}
            sx={actionSx}
          >
            Invoice
          </Button>
          <Button
            size="small"
            startIcon={<FiRefreshCw />}
            onClick={() => onReorder(o.id)}
            disabled={reordering}
            sx={actionSx}
          >
            Buy again
          </Button>
        </Stack>
        <Typography variant="subtitle1">
          Total {formatMoney(o.total, o.currency)}
        </Typography>
      </Stack>
    </Box>
  );
};
OrderCard.propTypes = {
  order: PropTypes.object.isRequired,
  detailed: PropTypes.bool,
  onReorder: PropTypes.func.isRequired,
  reordering: PropTypes.bool,
};

export const OrdersPage = () => {
  const notify = useNotify();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const days = params.get('days') ?? '';
  const page = Number(params.get('page') || 1);
  const [data, setData] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem(VIEW_KEY) || 'detailed';
    } catch {
      return 'detailed';
    }
  });

  const setFilters = (next) => {
    const merged = { status, days, ...next };
    setParams(Object.fromEntries(Object.entries(merged).filter(([, v]) => v)));
  };

  useEffect(() => {
    let active = true;
    setData(null);
    ordersApi
      .list({
        page,
        limit: PAGE_SIZE,
        status: status || undefined,
        days: days || undefined,
      })
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
  }, [page, status, days, notify]);

  const reorder = async (id) => {
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

  const changeView = (v) => {
    if (!v) return;
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // storage unavailable
    }
  };

  return (
    <AccountPage title="My orders" subtitle="Track, return or buy again.">
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Tabs
          value={FILTERS.some((f) => f.value === status) ? status : ''}
          onChange={(_, v) => setFilters({ status: v, page: '' })}
          variant="scrollable"
          sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, px: 1.5 } }}
        >
          {FILTERS.map((f) => (
            <Tab key={f.label} label={f.label} value={f.value} />
          ))}
        </Tabs>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            onChange={(_, v) => changeView(v)}
            aria-label="Order view"
          >
            <ToggleButton value="detailed" aria-label="Detailed view">
              <FiList style={{ marginRight: 6 }} /> Detailed
            </ToggleButton>
            <ToggleButton value="summary" aria-label="Summary view">
              <FiGrid style={{ marginRight: 6 }} /> Summary
            </ToggleButton>
          </ToggleButtonGroup>
          <TextField
            select
            size="small"
            value={days}
            onChange={(e) => setFilters({ days: e.target.value, page: '' })}
            inputProps={{ 'aria-label': 'Period' }}
            sx={{ minWidth: 160 }}
            SelectProps={{ displayEmpty: true }}
          >
            {PERIODS.map((p) => (
              <MenuItem key={p.label} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>
      {!data ? (
        <Stack spacing={2}>
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              variant="rounded"
              height={view === 'detailed' ? 260 : 150}
            />
          ))}
        </Stack>
      ) : !data.orders.length ? (
        <SectionCard>
          <EmptyState
            icon={<FiPackage />}
            title={status || days ? 'No orders here' : 'No orders yet'}
            action={
              <Button component={RouterLink} to="/products" variant="contained">
                Start shopping
              </Button>
            }
          >
            {status || days
              ? 'Try another filter or period.'
              : 'When you place an order, it will appear here.'}
          </EmptyState>
        </SectionCard>
      ) : (
        <Stack spacing={2}>
          {data.orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              detailed={view === 'detailed'}
              onReorder={reorder}
              reordering={reordering}
            />
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
                onPageChange={(_, p) => setFilters({ page: String(p + 1) })}
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
            <Typography variant="caption" color="text.secondary">
              How refunds work:{' '}
              <Link
                component={RouterLink}
                to="/policies/refunds"
                target="_blank"
              >
                Refund &amp; Return Policy
              </Link>
            </Typography>
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

/** The product page with the ordered options already chosen. */
const productLink = (item) => {
  const query = new URLSearchParams(item.options || {}).toString();
  return `/products/${item.productId}${query ? `?${query}` : ''}`;
};

export const OrderDetailPage = () => {
  const { finance } = useStore();
  const { id } = useParams();
  const [params] = useSearchParams();
  const justPlaced = params.get('placed') === '1';
  // Straight after checkout: the success window first, then the summary.
  const [celebrate, setCelebrate] = useState(justPlaced);
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
      title={`Order ${order.number}`}
      subtitle={`Placed ${formatDateTime(order.placedAt)}`}
      back="/account/orders"
      backLabel="My orders"
      action={
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            component={RouterLink}
            to={`/account/invoices/${order.id}`}
            startIcon={<FiFileText />}
          >
            Invoice
          </Button>
          <Button
            variant="outlined"
            startIcon={<FiRefreshCw />}
            onClick={reorder}
            disabled={reordering}
          >
            Buy again
          </Button>
        </Stack>
      }
    >
      <OrderSuccessDialog
        open={celebrate}
        order={order}
        onClose={() => setCelebrate(false)}
      />
      {justPlaced && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Thank you! Your order is confirmed. We’ve emailed a receipt to{' '}
          {order.email}.
        </Alert>
      )}
      <SectionCard title="Order progress" sx={{ mb: 3 }}>
        <OrderTracker order={order} />
      </SectionCard>
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
                      component={item.productId ? RouterLink : 'div'}
                      to={productLink(item)}
                      aria-label={
                        item.productId ? `View ${item.title}` : undefined
                      }
                      sx={{ flexShrink: 0 }}
                    >
                      <Box
                        component="img"
                        src={item.image}
                        alt=""
                        sx={{
                          width: 96,
                          height: 96,
                          objectFit: 'contain',
                          borderRadius: 1,
                          bgcolor: 'background.neutral',
                          display: 'block',
                        }}
                      />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      {item.productId ? (
                        <Link
                          component={RouterLink}
                          to={productLink(item)}
                          underline="hover"
                          color="text.primary"
                          variant="subtitle1"
                          data-testid="order-item-link"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <Typography variant="subtitle1">
                          {item.title}
                        </Typography>
                      )}
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        {item.quantity} ×{' '}
                        {formatMoney(item.price, order.currency)}
                        {item.sku ? ` · SKU ${item.sku}` : ''}
                      </Typography>
                      <Box
                        sx={{
                          display: Object.keys(item.options || {}).length
                            ? 'inline-block'
                            : 'none',
                          bgcolor: 'background.neutral',
                          borderRadius: '8px',
                          px: 1.5,
                          py: 1,
                        }}
                      >
                        <OptionRows options={item.options} />
                      </Box>
                      <Box>
                        <GiftNote gift={item.gift} />
                      </Box>
                    </Box>
                    <Stack alignItems="flex-end" spacing={1}>
                      <Typography variant="subtitle1">
                        {formatMoney(item.total, order.currency)}
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
            <SectionCard title="Order updates">
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
                  order.totals.gift ? ['Gift boxes', order.totals.gift] : null,
                  ['Delivery', order.totals.shipping],
                  [
                    finance.pricesIncludeTax
                      ? `Includes ${finance.taxLabel} (${finance.taxRate}%)`
                      : `${finance.taxLabel || 'Tax'} (${finance.taxRate}%)`,
                    order.totals.tax,
                  ],
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

// Where a return is, in the shopper's words.
const RETURN_STEPS = ['requested', 'approved', 'received', 'refunded'];
const RETURN_STEP_NAMES = {
  requested: 'Requested',
  approved: 'Approved',
  received: 'Received',
  refunded: 'Refunded',
};
const RETURN_HINTS = {
  requested: 'We’re reviewing your request.',
  approved: 'Approved. Please send the item back to us.',
  received: 'We’ve received the item and will refund you shortly.',
  refunded: 'Refunded.',
  rejected: 'This return wasn’t accepted. Contact us if you have questions.',
};
const RETURNS_PAGE_SIZE = 10;

const ReturnSteps = ({ status }) => {
  const at = RETURN_STEPS.indexOf(status);
  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
    >
      {RETURN_STEPS.map((step, i) => (
        <React.Fragment key={step}>
          {i > 0 && (
            <Box
              sx={{
                width: 16,
                height: 2,
                bgcolor: i <= at ? 'primary.main' : 'divider',
              }}
            />
          )}
          <Typography
            variant="caption"
            sx={{
              fontWeight: i === at ? 700 : 500,
              color: i <= at ? 'primary.main' : 'text.disabled',
            }}
          >
            {RETURN_STEP_NAMES[step]}
          </Typography>
        </React.Fragment>
      ))}
    </Stack>
  );
};
ReturnSteps.propTypes = { status: PropTypes.string.isRequired };

export const ReturnsPage = () => {
  const notify = useNotify();
  const [list, setList] = useState(null);
  const [page, setPage] = useState(0);
  useEffect(() => {
    ordersApi
      .listReturns()
      .then(setList)
      .catch((error) => {
        notify.error(error, 'We couldn’t load your returns.');
        setList([]);
      });
  }, [notify]);
  const shown = (list || []).slice(
    page * RETURNS_PAGE_SIZE,
    (page + 1) * RETURNS_PAGE_SIZE
  );
  return (
    <AccountPage
      title="Returns"
      subtitle={
        <>
          Return delivered items from the order page. See our{' '}
          <Link component={RouterLink} to="/policies/refunds">
            Refund &amp; Return Policy
          </Link>
          .
        </>
      }
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
          {shown.map((r) => (
            <Stack
              key={r.id}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems={{ sm: 'center' }}
              data-testid={`return-${r.id}`}
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
                  flexShrink: 0,
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1">
                  {r.quantity} × {r.product}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Return #{r.id} · {r.reasonName} · requested{' '}
                  {formatDate(r.date)} ·{' '}
                  <Typography
                    component={RouterLink}
                    to={`/account/orders/${r.orderId}`}
                    variant="body2"
                    sx={{ color: 'primary.main' }}
                  >
                    Order {r.orderNumber}
                  </Typography>
                </Typography>
                <Box sx={{ mt: 1 }}>
                  {r.status === 'rejected' ? null : (
                    <ReturnSteps status={r.status} />
                  )}
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {RETURN_HINTS[r.status]}
                    {r.refund && r.refund.status === 'processed'
                      ? ` ${formatMoney(r.refund.amount)} paid back${
                          r.refund.method === 'stripe' ? ' to your card' : ''
                        }.`
                      : ''}
                    {r.refund && r.refund.status === 'pending_approval'
                      ? ' Your refund is being approved.'
                      : ''}
                  </Typography>
                </Box>
              </Box>
              <StatusChip
                status={r.status}
                label={RETURN_STEP_NAMES[r.status] || 'Rejected'}
              />
            </Stack>
          ))}
          {list.length > RETURNS_PAGE_SIZE && (
            <Box
              sx={{
                borderRadius: 1,
                overflow: 'hidden',
                border: 1,
                borderColor: 'divider',
              }}
            >
              <StandardPagination
                count={list.length}
                page={page}
                rowsPerPage={RETURNS_PAGE_SIZE}
                label="returns"
                maxShowAll={0}
                onRowsPerPageChange={() => {}}
                onPageChange={(_, p) => setPage(p)}
              />
            </Box>
          )}
        </Stack>
      )}
    </AccountPage>
  );
};
