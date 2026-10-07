// src/pages/admin/AdminOrderPages.js — order list, order detail with status
// workflow, and returns.
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  Link as RouterLink,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  MenuItem,
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
import { FiDownload, FiEye, FiPlus, FiUser } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { adminOrders } from '../../api';
import { hasPermission } from '../../auth/permissions';
import { useNotify } from '../../notification/NotificationProvider';
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
} from '../../components/admin/DataTable';
import { SlaCell, slaState } from '../../components/admin/Sla';
import {
  formatDateTime,
  formatMoney,
  formatShortDate,
} from '../../utils/format';

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
      'SLA (days)',
      'SLA status',
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
        o.sla?.days ?? '',
        o.sla ? slaState(o.sla.state)[0] : '',
        o.total,
      ]
        .map(cell)
        .join(',')
    ),
  ].join('\n');
};

export const AdminOrdersPage = () => {
  const { user } = useContext(AuthContext);
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
        dateFrom: get('from') || undefined,
        dateTo: get('to') || undefined,
        customer: get('customer') || undefined,
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
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<FiDownload />}
              onClick={exportCsv}
              disabled={!rows.length}
              sx={{ bgcolor: 'background.paper' }}
            >
              {selected.length ? `Export ${selected.length}` : 'Export'}
            </Button>
            {hasPermission(user, 'orders.orders.create') && (
              <Button
                variant="contained"
                startIcon={<FiPlus />}
                component={RouterLink}
                to={`/admin/orders/new${get('customer') ? `?customer=${get('customer')}` : ''}`}
              >
                Create order
              </Button>
            )}
          </Stack>
        }
      />
      <TablePanel>
        <PanelToolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            onSubmit={(q) => setFilter('search', q)}
            placeholder="Search order number, customer or email"
            label="Search orders"
          />
          <Box sx={{ flex: 1 }} />
          <TextField
            select
            size="small"
            value={get('from') || get('to') ? 'custom' : get('days')}
            onChange={(e) => {
              const v = e.target.value;
              const next = new URLSearchParams(params);
              next.delete('days');
              if (v !== 'custom') {
                next.delete('from');
                next.delete('to');
                if (v) next.set('days', v);
              } else if (!get('from') && !get('to')) {
                // Start the custom range at the last 30 days.
                const d = new Date();
                next.set('to', d.toISOString().slice(0, 10));
                d.setDate(d.getDate() - 29);
                next.set('from', d.toISOString().slice(0, 10));
              }
              setParams(next, { replace: true });
              setPage(0);
            }}
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
            <MenuItem value="custom">Custom range…</MenuItem>
          </TextField>
          {(get('from') || get('to')) && (
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                type="date"
                size="small"
                label="From"
                value={get('from')}
                onChange={(e) => setFilter('from', e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: get('to') || undefined }}
              />
              <TextField
                type="date"
                size="small"
                label="To"
                value={get('to')}
                onChange={(e) => setFilter('to', e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: get('from') || undefined }}
              />
            </Stack>
          )}
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
          {get('customer') && (
            <Chip
              label={`Customer: ${get('customerName') || `#${get('customer')}`}`}
              onDelete={() => {
                const next = new URLSearchParams(params);
                next.delete('customer');
                next.delete('customerName');
                setParams(next, { replace: true });
              }}
              color="primary"
              variant="outlined"
            />
          )}
          {[
            'payment',
            'status',
            'shipping',
            'method',
            'days',
            'search',
            'customer',
          ].some((k) => get(k)) && (
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
                <TableCell>SLA</TableCell>
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
                        {o.number}
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
                      <SlaCell sla={o.sla} />
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

// The order page lives in ./orders/AdminOrderDetail.
export { default as AdminOrderDetailPage } from './orders/AdminOrderDetail';

// Returns: requested → approved (customer sends it back) → received (checked
// in, optionally back on sale) → refunded (creates the refund). Rejection is
// possible until it's refunded.
export const RETURN_STATES = {
  requested: ['Requested', 'warning'],
  approved: ['Awaiting item', 'info'],
  received: ['Item received', 'primary'],
  refunded: ['Refunded', 'success'],
  rejected: ['Rejected', 'default'],
};
const RETURN_TABS = [
  { value: 'requested', label: 'Requested' },
  { value: 'approved', label: 'Awaiting item' },
  { value: 'received', label: 'Received' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];
const REFUND_PILL = {
  pending_approval: ['Refund awaiting approval', 'warning'],
  processed: ['Paid back', 'success'],
  rejected: ['Refund rejected', 'default'],
  failed: ['Refund failed', 'error'],
};
const RETURN_ACTIONS = {
  requested: [
    { status: 'approved', label: 'Approve — ask for the item back' },
    { status: 'rejected', label: 'Reject', color: 'error' },
  ],
  approved: [
    { status: 'received', label: 'Item received — back in stock' },
    {
      status: 'received',
      restock: false,
      label: 'Item received — don’t restock',
    },
    { status: 'rejected', label: 'Reject', color: 'error' },
  ],
  received: [
    { status: 'refunded', label: 'Refund the customer' },
    { status: 'rejected', label: 'Reject', color: 'error' },
  ],
};
const DONE = {
  approved: 'Return approved. The customer can send the item back.',
  received: 'Item received.',
  refunded: 'Return refunded.',
  rejected: 'Return rejected.',
};

export const AdminReturnsPage = () => {
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || '';
  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const customer = get('customer');
  // A customer's returns, or a search: show every status by default.
  const tab = get('tab') || (customer || get('search') ? 'all' : 'requested');
  const page = Number(get('page') || 1) - 1;
  const canUpdate = hasPermission(user, 'orders.returns.update');
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    let active = true;
    setData(null);
    adminOrders
      .returnsPage({
        page: page + 1,
        limit: PAGE_SIZE,
        status: tab === 'all' ? undefined : tab,
        search: get('search') || undefined,
        days: get('days') || undefined,
        customer: customer || undefined,
      })
      .then((d) => active && setData(d))
      .catch((error) => {
        notify.error(error, 'We couldn’t load returns.');
        if (active) setData({ returns: [], total: 0, counts: {} });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, notify]);
  useEffect(load, [load]);

  const update = async (r, action) => {
    try {
      const next = await adminOrders.updateReturn(r.id, action.status, {
        restock: action.restock,
      });
      notify.success(
        action.status === 'refunded' &&
          next.refund?.status === 'pending_approval'
          ? 'Return refunded. The refund is waiting for approval.'
          : DONE[action.status]
      );
      load();
    } catch (error) {
      notify.error(error, 'We couldn’t update the return.');
    }
  };

  const counts = data?.counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const cols = 9;

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Returns', to: '/admin/returns' },
        ]}
        title="Returns"
        subtitle={
          customer ? (
            <Chip
              size="small"
              label={`Customer: ${get('customerName') || `#${customer}`}`}
              onDelete={() => setParams({}, { replace: true })}
              color="primary"
              variant="outlined"
            />
          ) : (
            'Approve requests, check items in when they arrive, then refund.'
          )
        }
      />
      <TablePanel>
        <PanelTabs
          value={tab}
          onChange={(v) => set('tab', v)}
          tabs={RETURN_TABS.map((t) => ({
            value: t.value,
            label: t.label,
            count: data
              ? t.value === 'all'
                ? total
                : counts[t.value] || 0
              : undefined,
          }))}
        />
        <PanelToolbar>
          <SearchField
            value={get('search')}
            onChange={(v) => set('search', v)}
            placeholder="Search item, order, return or customer"
          />
          <Box sx={{ flex: 1 }} />
          <TextField
            select
            size="small"
            value={get('days')}
            onChange={(e) => set('days', e.target.value)}
            SelectProps={{ displayEmpty: true }}
            sx={{ minWidth: 160 }}
            inputProps={{ 'aria-label': 'Date range' }}
          >
            {DATE_RANGES.map((d) => (
              <MenuItem key={d.label} value={d.value}>
                {d.label}
              </MenuItem>
            ))}
          </TextField>
        </PanelToolbar>
        <TableContainer>
          <Table aria-label="Returns">
            <TableHead sx={{ bgcolor: 'background.neutral' }}>
              <TableRow>
                <TableCell>Return</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Item</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell align="right">Value</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Refund</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {!data && <LoadingRows cols={cols} rows={PAGE_SIZE} />}
              {data?.returns.map((r) => {
                const [label, tone] = RETURN_STATES[r.status] || [
                  r.status,
                  'default',
                ];
                const [refundLabel, refundTone] = r.refund
                  ? REFUND_PILL[r.refund.status] || [r.refund.status, 'default']
                  : [];
                const actions = canUpdate ? RETURN_ACTIONS[r.status] || [] : [];
                return (
                  <TableRow key={r.id} hover data-testid={`return-row-${r.id}`}>
                    <TableCell sx={{ fontWeight: 700 }}>#{r.id}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatShortDate(r.date)}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                          component="img"
                          src={r.image}
                          alt=""
                          sx={{
                            width: 40,
                            height: 40,
                            objectFit: 'contain',
                            borderRadius: '8px',
                            bgcolor: 'background.neutral',
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" noWrap>
                            {r.quantity} × {r.product}
                          </Typography>
                          <Link
                            component={RouterLink}
                            to={`/admin/orders/${r.orderId}`}
                            variant="caption"
                            underline="hover"
                          >
                            {r.orderNumber}
                          </Link>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {r.customer?.name || r.customer?.email}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Typography variant="body2">
                        {r.reasonName}
                        {r.opened ? ' · opened' : ''}
                      </Typography>
                      {r.comment && (
                        <Typography variant="caption" noWrap component="div">
                          {r.comment}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {r.amount !== undefined ? formatMoney(r.amount) : '—'}
                    </TableCell>
                    <TableCell>
                      <Pill label={label} tone={tone} />
                    </TableCell>
                    <TableCell>
                      {r.refund ? (
                        <Stack spacing={0.25} alignItems="flex-start">
                          <Pill label={refundLabel} tone={refundTone} />
                          <Link
                            component={RouterLink}
                            to={`/admin/refunds?tab=${
                              r.refund.status === 'pending_approval'
                                ? 'pending'
                                : r.refund.status === 'rejected'
                                  ? 'rejected'
                                  : 'approved'
                            }&search=${r.orderId}`}
                            variant="caption"
                            underline="hover"
                          >
                            Refund #{r.refund.id} ·{' '}
                            {formatMoney(r.refund.amount)}
                          </Link>
                        </Stack>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {actions.length > 0 && (
                        <RowActions
                          label={`Actions for return of ${r.product}`}
                          items={actions.map((a) => ({
                            label: a.label,
                            color: a.color,
                            onClick: () => update(r, a),
                          }))}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {data && !data.returns.length && (
                <EmptyRow cols={cols}>No returns here.</EmptyRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {data && data.total > 0 && (
          <StandardPagination
            count={data.total}
            page={page}
            rowsPerPage={PAGE_SIZE}
            onPageChange={(_, p) => set('page', String(p + 1))}
            onRowsPerPageChange={() => {}}
            maxShowAll={0}
            label="returns"
          />
        )}
      </TablePanel>
    </Stack>
  );
};
