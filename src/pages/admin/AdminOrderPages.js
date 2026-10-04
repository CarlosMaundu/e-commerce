// src/pages/admin/AdminOrderPages.js — order list, order detail with status
// workflow, and returns.
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  Link as RouterLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Avatar,
  Link,
} from '@mui/material';
import { FiChevronLeft, FiDownload, FiEye, FiUser } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { adminOrders } from '../../api';
import { formatAddress } from '../../api/mappers';
import { hasPermission } from '../../auth/permissions';
import { useNotify } from '../../notification/NotificationProvider';
import { SectionCard, StatusChip } from '../../components/ui';
import {
  EmptyRow,
  FilterMenu,
  LoadingRows,
  PAGE_SIZE,
  PageHeader,
  PanelTabs,
  PanelToolbar,
  Pill,
  RowActions,
  SearchField,
  StandardPagination,
  TablePanel,
  usePaging,
} from '../../components/admin/DataTable';
import { formatDateTime, formatMoney, optionText } from '../../utils/format';

const STATUS_NAMES = {
  awaiting_payment: 'Awaiting payment',
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const PAYMENT = {
  paid: ['Paid', 'success'],
  pending: ['Due', 'warning'],
  failed: ['Failed', 'error'],
  refunded: ['Refunded', 'default'],
};
const FULFILMENT = {
  awaiting_payment: ['Unfulfilled', 'default'],
  pending: ['Unfulfilled', 'default'],
  processing: ['Processing', 'info'],
  shipped: ['Shipped', 'info'],
  delivered: ['Fulfilled', 'success'],
  cancelled: ['Cancelled', 'error'],
  refunded: ['Refunded', 'default'],
};
const SHIPPING = {
  standard: ['Standard', 'info'],
  express: ['Express', 'warning'],
};

const DATE_RANGES = [
  { value: '', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
];

const ordersCsv = (rows) => {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    [
      'Order',
      'Date',
      'Customer',
      'Email',
      'Payment',
      'Fulfilment',
      'Shipping',
      'Total',
    ]
      .map(cell)
      .join(','),
    ...rows.map((o) =>
      [
        o.id,
        formatDateTime(o.placedAt),
        o.customer?.name,
        o.email,
        PAYMENT[o.paymentStatus]?.[0],
        FULFILMENT[o.status]?.[0],
        SHIPPING[o.shippingMethod]?.[0],
        o.total,
      ]
        .map(cell)
        .join(',')
    ),
  ].join('\n');
};

export const AdminOrdersPage = () => {
  const notify = useNotify();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || '';
  const [search, setSearch] = useState(get('search'));
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setPage(0);
  };

  useEffect(() => {
    let active = true;
    setData(null);
    setSelected([]);
    adminOrders
      .list({
        page: page + 1,
        limit: rowsPerPage,
        status: get('status') || undefined,
        search: get('search') || undefined,
        paymentStatus: get('payment') || undefined,
        shippingMethod: get('shipping') || undefined,
        paymentMethod: get('method') || undefined,
        days: get('days') || undefined,
      })
      .then((d) => active && setData(d))
      .catch(
        (error) =>
          active &&
          (notify.error(error, 'We couldn’t load orders.'),
          setData({ orders: [], total: 0 }))
      );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, params, notify]);

  const rows = data?.orders || [];
  const allChecked = rows.length > 0 && selected.length === rows.length;
  const exportCsv = () => {
    const chosen = selected.length
      ? rows.filter((o) => selected.includes(o.id))
      : rows;
    const url = URL.createObjectURL(
      new Blob([ordersCsv(chosen)], { type: 'text/csv' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Orders', to: '/admin/orders' },
        ]}
        title="Order list"
        actions={
          <Button
            startIcon={<FiDownload />}
            onClick={exportCsv}
            disabled={!rows.length}
            sx={{ bgcolor: 'background.neutral' }}
          >
            {selected.length ? `Export ${selected.length}` : 'Export'}
          </Button>
        }
      />
      <TablePanel>
        <PanelToolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            onSubmit={() => setFilter('search', search.trim())}
            placeholder="Search order #, customer or email"
            label="Search orders"
          />
          <Box sx={{ flex: 1 }} />
          <TextField
            select
            size="small"
            value={get('days')}
            onChange={(e) => setFilter('days', e.target.value)}
            inputProps={{ 'aria-label': 'Date range' }}
            SelectProps={{ displayEmpty: true }}
            sx={{
              minWidth: 170,
              '& .MuiOutlinedInput-root': { bgcolor: 'background.neutral' },
            }}
          >
            {DATE_RANGES.map((r) => (
              <MenuItem key={r.value} value={r.value}>
                {r.label}
              </MenuItem>
            ))}
          </TextField>
        </PanelToolbar>
        <Stack
          direction="row"
          spacing={0.5}
          flexWrap="wrap"
          useFlexGap
          sx={{ px: 2, pb: 1.5 }}
        >
          <FilterMenu
            label="Payment"
            value={get('payment')}
            onChange={(v) => setFilter('payment', v)}
            options={[
              { value: '', label: 'All' },
              { value: 'paid', label: 'Paid' },
              { value: 'pending', label: 'Due' },
              { value: 'failed', label: 'Failed' },
              { value: 'refunded', label: 'Refunded' },
            ]}
          />
          <FilterMenu
            label="Fulfilment"
            value={get('status')}
            onChange={(v) => setFilter('status', v)}
            options={[
              { value: '', label: 'All' },
              { value: 'awaiting_payment,pending', label: 'Unfulfilled' },
              { value: 'processing', label: 'Processing' },
              { value: 'shipped', label: 'Shipped' },
              { value: 'delivered', label: 'Fulfilled' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: 'refunded', label: 'Refunded' },
            ]}
          />
          <FilterMenu
            label="Shipping"
            value={get('shipping')}
            onChange={(v) => setFilter('shipping', v)}
            options={[
              { value: '', label: 'All' },
              { value: 'standard', label: 'Standard' },
              { value: 'express', label: 'Express' },
            ]}
          />
          <FilterMenu
            label="Payment method"
            value={get('method')}
            onChange={(v) => setFilter('method', v)}
            options={[
              { value: '', label: 'All' },
              { value: 'stripe', label: 'Card' },
              { value: 'cod', label: 'Cash on delivery' },
            ]}
          />
          {['payment', 'status', 'shipping', 'method', 'days', 'search'].some(
            (k) => get(k)
          ) && (
            <Button
              size="small"
              onClick={() => {
                setSearch('');
                setParams({}, { replace: true });
                setPage(0);
              }}
            >
              Clear filters
            </Button>
          )}
        </Stack>
        <TableContainer>
          <Table aria-label="Orders" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allChecked}
                    indeterminate={selected.length > 0 && !allChecked}
                    onChange={() =>
                      setSelected(allChecked ? [] : rows.map((o) => o.id))
                    }
                    inputProps={{
                      'aria-label': 'Select all orders on this page',
                    }}
                  />
                </TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Payment status</TableCell>
                <TableCell>Fulfillment status</TableCell>
                <TableCell>Shipping method</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {!data && <LoadingRows cols={9} />}
              {data && !rows.length && (
                <EmptyRow cols={9}>No orders match.</EmptyRow>
              )}
              {rows.map((o) => {
                const pay = PAYMENT[o.paymentStatus] || [
                  o.paymentStatus,
                  'default',
                ];
                const ful = FULFILMENT[o.status] || [o.statusName, 'default'];
                const ship = SHIPPING[o.shippingMethod] || [
                  o.shippingMethod || '—',
                  'default',
                ];
                const name = o.customer?.name || o.email;
                return (
                  <TableRow
                    key={o.id}
                    hover
                    selected={selected.includes(o.id)}
                    data-testid={`admin-order-${o.id}`}
                    onClick={(e) => {
                      // Checkbox, links and the ⋯ menu keep their own action.
                      if (!e.target.closest('a, button, input, [role="menu"]'))
                        navigate(`/admin/orders/${o.id}`);
                    }}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected.includes(o.id)}
                        onChange={() =>
                          setSelected((s) =>
                            s.includes(o.id)
                              ? s.filter((x) => x !== o.id)
                              : [...s, o.id]
                          )
                        }
                        inputProps={{ 'aria-label': `Select order ${o.id}` }}
                      />
                    </TableCell>
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
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(o.placedAt)}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: '0.85rem',
                            bgcolor: 'primary.light',
                            color: 'primary.main',
                          }}
                        >
                          {name.charAt(0).toUpperCase()}
                        </Avatar>
                        {o.customer?.customer_id ? (
                          <Link
                            component={RouterLink}
                            to={`/admin/users/${o.customer.customer_id}`}
                            underline="hover"
                          >
                            {name}
                          </Link>
                        ) : (
                          <Typography variant="body2">{name}</Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Pill label={pay[0]} tone={pay[1]} />
                    </TableCell>
                    <TableCell>
                      <Pill label={ful[0]} tone={ful[1]} />
                    </TableCell>
                    <TableCell>
                      <Pill label={ship[0]} tone={ship[1]} />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle2">
                        {formatMoney(o.total, o.currency)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <RowActions
                        label={`Actions for order ${o.id}`}
                        items={[
                          {
                            label: 'View order',
                            icon: <FiEye />,
                            onClick: () => navigate(`/admin/orders/${o.id}`),
                          },
                          {
                            label: 'View customer',
                            icon: <FiUser />,
                            hidden: !o.customer?.customer_id,
                            onClick: () =>
                              navigate(
                                `/admin/users/${o.customer.customer_id}`
                              ),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <StandardPagination
          count={data?.total || 0}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(0);
          }}
        />
      </TablePanel>
    </Stack>
  );
};

export const AdminOrderDetailPage = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const canUpdate = hasPermission(user, 'orders.orders.update');
  const [order, setOrder] = useState(null);
  const [form, setForm] = useState({ status: '', comment: '', notify: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const o = await adminOrders.get(id);
      setOrder(o);
      setForm({ status: o.status, comment: '', notify: true });
    } catch (error) {
      notify.error(error, 'We couldn’t load this order.');
    }
  }, [id, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await adminOrders.updateStatus(id, form);
      setOrder(updated);
      setForm({ status: updated.status, comment: '', notify: true });
      notify.success(
        form.notify
          ? 'Order updated and the customer was emailed.'
          : 'Order updated.'
      );
    } catch (error) {
      notify.error(error, 'We couldn’t update the order.');
    } finally {
      setSaving(false);
    }
  };

  if (!order) return <Skeleton variant="rounded" height={420} />;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography
          component={RouterLink}
          to="/admin/orders"
          variant="body2"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'text.secondary',
            textDecoration: 'none',
          }}
        >
          <FiChevronLeft /> Orders
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
          <Typography variant="h3" component="h1">
            Order #{order.id}
          </Typography>
          <StatusChip status={order.status} label={order.statusName} />
        </Stack>
        <Typography color="text.secondary">
          Placed {formatDateTime(order.placedAt)} by{' '}
          {order.customer?.name || order.email} ({order.email})
        </Typography>
      </Box>
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Stack spacing={3}>
            <SectionCard title="Items">
              <Stack divider={<Divider />} spacing={1.5}>
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
                        width: 52,
                        height: 52,
                        objectFit: 'contain',
                        borderRadius: 1,
                        bgcolor: 'background.neutral',
                      }}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2">{item.title}</Typography>
                      <Typography variant="caption">
                        {[
                          optionText(item.options),
                          `${item.quantity} × ${formatMoney(item.price)}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Typography>
                    </Box>
                    <Typography variant="subtitle2">
                      {formatMoney(item.total)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={0.75} sx={{ maxWidth: 320, ml: 'auto' }}>
                {[
                  ['Subtotal', order.totals.subtotal],
                  order.totals.discount
                    ? [`Promo ${order.coupon || ''}`, -order.totals.discount]
                    : null,
                  ['Delivery', order.totals.shipping],
                  ['Tax', order.totals.tax],
                ]
                  .filter(Boolean)
                  .map(([l, v]) => (
                    <Stack
                      key={l}
                      direction="row"
                      justifyContent="space-between"
                    >
                      <Typography color="text.secondary">{l}</Typography>
                      <Typography>{formatMoney(v)}</Typography>
                    </Stack>
                  ))}
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle1">Total</Typography>
                  <Typography variant="subtitle1">
                    {formatMoney(order.total, order.currency)}
                  </Typography>
                </Stack>
              </Stack>
            </SectionCard>
            <SectionCard title="History">
              <Stack spacing={2}>
                {[...order.history].reverse().map((h, i) => (
                  <Stack key={i} direction="row" spacing={2}>
                    <StatusChip status={h.status} label={h.statusName} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption">
                        {formatDateTime(h.date)}
                        {h.notified ? ' · customer emailed' : ''}
                      </Typography>
                      {h.comment && (
                        <Typography variant="body2">{h.comment}</Typography>
                      )}
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </SectionCard>
          </Stack>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            {canUpdate && (
              <SectionCard title="Update order">
                <Stack component="form" spacing={2} onSubmit={save}>
                  <TextField
                    select
                    size="small"
                    label="Status"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                    helperText={
                      order.nextStatuses.length
                        ? 'Only valid next steps are offered.'
                        : 'This order is final.'
                    }
                  >
                    <MenuItem value={order.status}>
                      {STATUS_NAMES[order.status]} (current)
                    </MenuItem>
                    {order.nextStatuses.map((s) => (
                      <MenuItem key={s} value={s}>
                        {STATUS_NAMES[s]}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    label="Comment"
                    multiline
                    minRows={2}
                    value={form.comment}
                    onChange={(e) =>
                      setForm({ ...form, comment: e.target.value })
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.notify}
                        onChange={(e) =>
                          setForm({ ...form, notify: e.target.checked })
                        }
                      />
                    }
                    label="Email the customer"
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={
                      saving ||
                      (form.status === order.status && !form.comment.trim())
                    }
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </Stack>
              </SectionCard>
            )}
            <SectionCard title="Delivery" tinted>
              <Typography variant="subtitle2">
                {order.shippingAddress.firstName}{' '}
                {order.shippingAddress.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatAddress(order.shippingAddress)}
              </Typography>
              {order.shippingAddress.phone && (
                <Typography variant="body2">
                  {order.shippingAddress.phone}
                </Typography>
              )}
              <Typography variant="body2" sx={{ mt: 1 }}>
                {order.shippingMethod === 'express' ? 'Express' : 'Standard'}{' '}
                delivery
              </Typography>
              {order.comment && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Note: {order.comment}
                </Typography>
              )}
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
    </Stack>
  );
};

export const AdminReturnsPage = () => {
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const canUpdate = hasPermission(user, 'orders.returns.update');
  const [status, setStatus] = useState('requested');
  const [list, setList] = useState(null);
  const paging = usePaging();

  const load = useCallback(() => {
    setList(null);
    adminOrders
      .listReturns(status || undefined)
      .then(setList)
      .catch((error) => {
        notify.error(error, 'We couldn’t load returns.');
        setList([]);
      });
  }, [status, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (r, next) => {
    try {
      await adminOrders.updateReturn(r.id, next);
      notify.success(`Return marked ${next}.`);
      load();
    } catch (error) {
      notify.error(error, 'We couldn’t update the return.');
    }
  };

  const actions = {
    requested: ['approved', 'rejected'],
    approved: ['refunded'],
  };

  const shown = paging.slice(list || []);

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Returns', to: '/admin/returns' },
        ]}
        title="Returns"
      />
      <TablePanel>
        <PanelTabs
          value={status}
          onChange={(v) => {
            setStatus(v);
            paging.reset();
          }}
          tabs={[
            { value: 'requested', label: 'Requested' },
            { value: 'approved', label: 'Approved' },
            { value: 'refunded', label: 'Refunded' },
            { value: 'rejected', label: 'Rejected' },
            { value: '', label: 'All' },
          ]}
        />
        <TableContainer>
          <Table aria-label="Returns">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {!list && <LoadingRows cols={5} />}
              {shown.map((r) => (
                <TableRow key={r.id} hover data-testid={`return-row-${r.id}`}>
                  <TableCell>
                    <Typography variant="subtitle2">
                      {r.quantity} × {r.product}
                    </Typography>
                    <Typography
                      variant="caption"
                      component={RouterLink}
                      to={`/admin/orders/${r.orderId}`}
                    >
                      Order #{r.orderId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{r.customer?.name}</Typography>
                    <Typography variant="caption">
                      {r.customer?.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {r.reasonName}
                      {r.opened ? ' · opened' : ''}
                    </Typography>
                    {r.comment && (
                      <Typography variant="caption">{r.comment}</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusChip status={r.status} label={r.status} />
                  </TableCell>
                  <TableCell align="right">
                    <RowActions
                      label={`Actions for return of ${r.product}`}
                      items={(canUpdate ? actions[r.status] || [] : []).map(
                        (next) => ({
                          label:
                            next === 'approved'
                              ? 'Approve'
                              : next === 'rejected'
                                ? 'Reject'
                                : 'Mark refunded',
                          color: next === 'rejected' ? 'error' : undefined,
                          onClick: () => update(r, next),
                        })
                      )}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {list && !list.length && (
                <EmptyRow cols={5}>No returns here.</EmptyRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <StandardPagination count={list?.length || 0} {...paging.props} />
      </TablePanel>
    </Stack>
  );
};
