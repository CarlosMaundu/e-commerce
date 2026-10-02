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
} from '@mui/material';
import { FiChevronLeft } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { adminOrders } from '../../api';
import { formatAddress } from '../../api/mappers';
import { hasPermission } from '../../auth/permissions';
import { useNotify } from '../../notification/NotificationProvider';
import { SectionCard, StatusChip } from '../../components/ui';
import {
  EmptyRow,
  LoadingRows,
  PAGE_SIZE,
  PageHeader,
  PanelTabs,
  PanelToolbar,
  RowActions,
  SearchField,
  StandardPagination,
  TablePanel,
  usePaging,
} from '../../components/admin/DataTable';
import { formatDateTime, formatMoney, optionText } from '../../utils/format';

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'To fulfil', value: 'pending,processing' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Awaiting payment', value: 'awaiting_payment' },
  { label: 'Cancelled', value: 'cancelled,refunded' },
];
const STATUS_NAMES = {
  awaiting_payment: 'Awaiting payment',
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const AdminOrdersPage = () => {
  const notify = useNotify();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [search, setSearch] = useState(params.get('search') || '');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE);
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    setData(null);
    adminOrders
      .list({
        page: page + 1,
        limit: rowsPerPage,
        status: status || undefined,
        search: params.get('search') || undefined,
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
  }, [status, page, rowsPerPage, params, notify]);

  const submitSearch = () => {
    setPage(0);
    setParams({
      ...(status ? { status } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    });
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Orders', to: '/admin/orders' },
        ]}
        title="Orders"
      />
      <TablePanel>
        <PanelTabs
          value={STATUS_TABS.some((t) => t.value === status) ? status : ''}
          onChange={(v) => {
            setPage(0);
            setParams(v ? { status: v } : {});
          }}
          tabs={STATUS_TABS.map((t) => ({ value: t.value, label: t.label }))}
        />
        <PanelToolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            onSubmit={submitSearch}
            placeholder="Order #, email or name"
            label="Search orders"
          />
        </PanelToolbar>
        <TableContainer>
          <Table aria-label="Orders">
            <TableHead>
              <TableRow>
                <TableCell>Order</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Placed</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!data &&
                [0, 1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton height={32} />
                    </TableCell>
                  </TableRow>
                ))}
              {data?.orders.map((o) => (
                <TableRow
                  key={o.id}
                  hover
                  onClick={() => navigate(`/admin/orders/${o.id}`)}
                  sx={{ cursor: 'pointer' }}
                  data-testid={`admin-order-${o.id}`}
                >
                  <TableCell>
                    <Typography
                      variant="subtitle2"
                      component={RouterLink}
                      to={`/admin/orders/${o.id}`}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ color: 'text.primary', textDecoration: 'none' }}
                    >
                      #{o.id}
                    </Typography>
                    <br />
                    <Typography variant="caption">
                      {o.itemCount} items
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {o.customer?.name || '—'}
                    </Typography>
                    <Typography variant="caption">{o.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDateTime(o.placedAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={o.status} label={o.statusName} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {o.paymentMethod === 'stripe' ? 'Card' : 'Cash'}
                    </Typography>
                    <Typography variant="caption">{o.paymentStatus}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2">
                      {formatMoney(o.total, o.currency)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {data && !data.orders.length && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    align="center"
                    sx={{ py: 5, color: 'text.secondary' }}
                  >
                    No orders match.
                  </TableCell>
                </TableRow>
              )}
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
