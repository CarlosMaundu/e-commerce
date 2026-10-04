// src/pages/admin/finance/FinancePages.js — invoices (Aurora-style list and
// a printable invoice), payments, refunds with approval, refund settings
// and the ledger.
import React, { useCallback, useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Link as RouterLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  InputAdornment,
  Link,
  MenuItem,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  FiAlertCircle,
  FiArrowDownLeft,
  FiArrowUpRight,
  FiCheck,
  FiCheckCircle,
  FiCreditCard,
  FiDollarSign,
  FiEdit2,
  FiFileText,
  FiPlus,
  FiPrinter,
  FiSave,
  FiX,
} from 'react-icons/fi';
import { AuthContext } from '../../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../../auth/permissions';
import { adminFinance } from '../../../api';
import { useNotify } from '../../../notification/NotificationProvider';
import { SectionCard } from '../../../components/ui';
import {
  EmptyRow,
  FilterMenu,
  LoadingRows,
  PAGE_SIZE,
  PageHeader,
  PanelToolbar,
  Pill,
  SearchField,
  StandardPagination,
  TablePanel,
} from '../../../components/admin/DataTable';
import InvoiceDocument from '../../../components/invoice/InvoiceDocument';
import { initialsOf } from '../../../components/common/BrandMark';
import { useHideHelpWhile } from '../../../layouts/AdminLayout';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyCompact,
  getCurrency,
} from '../../../utils/format';
import { METHOD_NAMES, RecordPaymentDialog } from '../orders/OrderDialogs';

export const INVOICE_STATES = {
  issued: ['Due', 'warning'],
  partially_paid: ['Part paid', 'warning'],
  paid: ['Paid', 'success'],
  void: ['Void', 'default'],
  refunded: ['Refunded', 'info'],
  partially_refunded: ['Part refunded', 'info'],
};
const PERIODS = [
  { value: '', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
];

const headSx = {
  bgcolor: 'background.neutral',
  '& th': { fontWeight: 600, color: 'text.secondary', whiteSpace: 'nowrap' },
};

/** Small summary tile above a list. */
const Tile = ({ icon, label, value, tone = 'primary' }) => {
  const theme = useTheme();
  const c = theme.palette[tone].main;
  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="center"
      sx={{
        p: 2.5,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: '8px',
          display: 'grid',
          placeItems: 'center',
          fontSize: 20,
          color: c,
          bgcolor: alpha(c, 0.12),
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="caption" component="div" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.35rem' }}>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
};
Tile.propTypes = {
  icon: PropTypes.node,
  label: PropTypes.string,
  value: PropTypes.node,
  tone: PropTypes.string,
};

const Tiles = ({ children }) => (
  <Box
    sx={{
      display: 'grid',
      gap: 2,
      gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
    }}
  >
    {children}
  </Box>
);
Tiles.propTypes = { children: PropTypes.node };

const Customer = ({ c }) =>
  c ? (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Avatar
        sx={{
          width: 32,
          height: 32,
          fontSize: 12,
          fontWeight: 700,
          bgcolor: 'highlight.main',
          color: 'text.primary',
        }}
      >
        {initialsOf(c.name || c.email)}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        {c.customer_id ? (
          <Link
            component={RouterLink}
            to={`/admin/users/${c.customer_id}`}
            underline="hover"
            sx={{ fontWeight: 600, display: 'block' }}
            onClick={(e) => e.stopPropagation()}
          >
            {c.name || c.email}
          </Link>
        ) : (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {c.name || c.email}
          </Typography>
        )}
        {c.email && (
          <Typography variant="caption" noWrap component="div">
            {c.email}
          </Typography>
        )}
      </Box>
    </Stack>
  ) : (
    '—'
  );
Customer.propTypes = { c: PropTypes.object };

/** Search box that updates the list a moment after typing stops. */
const Search = ({ value, onChange, placeholder }) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    if (v === value) return undefined;
    const t = setTimeout(() => onChange(v), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
  return <SearchField value={v} onChange={setV} placeholder={placeholder} />;
};
Search.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

const useListParams = () => {
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || '';
  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  return { params, get, set, page: Number(get('page') || 1) - 1 };
};

// ---------- Invoices ----------

export const InvoicesPage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const notify = useNotify();
  const { params, get, set, page } = useListParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    setData(null);
    adminFinance
      .invoices({
        page: page + 1,
        limit: PAGE_SIZE,
        ...(get('search') ? { search: get('search') } : {}),
        ...(get('status') ? { status: get('status') } : {}),
        ...(get('days') ? { days: get('days') } : {}),
        ...(get('customer') ? { customer: get('customer') } : {}),
      })
      .then((d) => active && setData(d))
      .catch((e) => {
        notify.error(e, 'We couldn’t load invoices.');
        if (active) setData({ invoices: [], total: 0, summary: {} });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, notify]);

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[{ label: 'Home', to: '/admin' }, { label: 'Invoices' }]}
        title="Invoice list"
        actions={
          hasPermission(user, PERMISSIONS.ordersCreate) && (
            <Button
              variant="contained"
              startIcon={<FiPlus />}
              component={RouterLink}
              to="/admin/orders/new"
            >
              Create order and invoice
            </Button>
          )
        }
      />
      <Tiles>
        <Tile
          icon={<FiFileText />}
          label="Billed"
          value={
            data ? (
              formatMoneyCompact(data.summary.billed)
            ) : (
              <Skeleton width={90} />
            )
          }
        />
        <Tile
          icon={<FiCheckCircle />}
          label="Paid"
          tone="success"
          value={
            data ? (
              formatMoneyCompact(data.summary.paid)
            ) : (
              <Skeleton width={90} />
            )
          }
        />
        <Tile
          icon={<FiAlertCircle />}
          label="Outstanding"
          tone="warning"
          value={
            data ? (
              formatMoneyCompact(data.summary.outstanding)
            ) : (
              <Skeleton width={90} />
            )
          }
        />
      </Tiles>
      <TablePanel>
        <PanelToolbar>
          <Search
            value={get('search')}
            onChange={(v) => set('search', v)}
            placeholder="Search invoice, order, customer"
          />
          <Box sx={{ flex: 1 }} />
          <FilterMenu
            label="Status"
            value={get('status')}
            onChange={(v) => set('status', v)}
            options={[
              { value: '', label: 'All' },
              ...Object.entries(INVOICE_STATES).map(([value, [label]]) => ({
                value,
                label,
              })),
            ]}
          />
          <TextField
            select
            size="small"
            value={get('days')}
            onChange={(e) => set('days', e.target.value)}
            SelectProps={{ displayEmpty: true }}
            sx={{ minWidth: 160 }}
            inputProps={{ 'aria-label': 'Date range' }}
          >
            {PERIODS.map((p) => (
              <MenuItem key={p.label} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
        </PanelToolbar>
        <TableContainer>
          <Table>
            <TableHead sx={headSx}>
              <TableRow>
                <TableCell>Invoice</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Due</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Balance</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!data ? (
                <LoadingRows cols={8} rows={PAGE_SIZE} />
              ) : data.invoices.length ? (
                data.invoices.map((i) => {
                  const [label, tone] = INVOICE_STATES[i.status] || [
                    i.status,
                    'default',
                  ];
                  const overdue =
                    i.balance > 0 &&
                    i.due_at &&
                    new Date(i.due_at) < new Date() &&
                    i.status !== 'void';
                  return (
                    <TableRow
                      key={i.invoice_id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() =>
                        navigate(`/admin/invoices/${i.invoice_id}`)
                      }
                      data-testid={`invoice-${i.invoice_id}`}
                    >
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to={`/admin/invoices/${i.invoice_id}`}
                          underline="hover"
                          sx={{ fontWeight: 700 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {i.number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Customer c={i.customer} />
                      </TableCell>
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to={`/admin/orders/${i.order_id}`}
                          underline="hover"
                          onClick={(e) => e.stopPropagation()}
                        >
                          #{i.order_id}
                        </Link>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {formatDate(i.issued_at)}
                      </TableCell>
                      <TableCell
                        sx={{
                          whiteSpace: 'nowrap',
                          color: overdue ? 'error.main' : 'text.secondary',
                        }}
                      >
                        {i.balance > 0 && i.due_at ? formatDate(i.due_at) : '—'}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                      >
                        {formatMoney(i.total, i.currency)}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {formatMoney(i.balance, i.currency)}
                      </TableCell>
                      <TableCell>
                        <Pill
                          label={overdue ? 'Overdue' : label}
                          tone={overdue ? 'error' : tone}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <EmptyRow cols={8}>No invoices match.</EmptyRow>
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
            label="invoices"
          />
        )}
      </TablePanel>
    </Stack>
  );
};

export const InvoiceDetailPage = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const [data, setData] = useState(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(
    () =>
      adminFinance
        .invoice(id)
        .then(setData)
        .catch((e) => notify.error(e, 'We couldn’t load this invoice.')),
    [id, notify]
  );
  useEffect(() => {
    load();
  }, [load]);

  if (!data)
    return (
      <Skeleton variant="rounded" height={640} data-testid="invoice-loading" />
    );
  const { invoice, order, payments } = data;
  const [label, tone] = INVOICE_STATES[invoice.status] || [
    invoice.status,
    'default',
  ];

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Invoices', to: '/admin/invoices' },
          { label: invoice.number },
        ]}
        title={
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            component="span"
          >
            <span>Invoice details</span>
            <Pill label={label} tone={tone} />
          </Stack>
        }
        subtitle={`${invoice.number} · order #${invoice.order_id}`}
        actions={
          <Stack
            direction="row"
            spacing={1}
            className="no-print"
            flexWrap="wrap"
            useFlexGap
          >
            <Button
              variant="outlined"
              component={RouterLink}
              to={`/admin/orders/${invoice.order_id}`}
              startIcon={<FiEdit2 />}
            >
              Open order
            </Button>
            {invoice.balance > 0 &&
              invoice.status !== 'void' &&
              hasPermission(user, PERMISSIONS.paymentsRecord) && (
                <Button
                  variant="outlined"
                  startIcon={<FiCreditCard />}
                  onClick={() => setPaying(true)}
                >
                  Record payment
                </Button>
              )}
            <Button
              variant="contained"
              startIcon={<FiPrinter />}
              onClick={() => window.print()}
            >
              Print or download
            </Button>
          </Stack>
        }
      />
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8.5}>
          <InvoiceDocument
            order={{
              ...order,
              paymentStatus:
                invoice.status === 'paid' ? 'paid' : order.paymentStatus,
            }}
          />
        </Grid>
        <Grid item xs={12} lg={3.5} className="no-print">
          <Stack spacing={3}>
            <SectionCard title="Balance">
              <Stack spacing={1}>
                {[
                  ['Total', invoice.total],
                  ['Paid', invoice.amount_paid],
                  ...(invoice.amount_refunded
                    ? [['Refunded', -invoice.amount_refunded]]
                    : []),
                ].map(([l, v]) => (
                  <Stack key={l} direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">{l}</Typography>
                    <Typography>{formatMoney(v, invoice.currency)}</Typography>
                  </Stack>
                ))}
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle1">Balance due</Typography>
                  <Typography variant="subtitle1" data-testid="invoice-balance">
                    {formatMoney(invoice.balance, invoice.currency)}
                  </Typography>
                </Stack>
                {invoice.due_at && invoice.balance > 0 && (
                  <Typography variant="caption">
                    Due {formatDate(invoice.due_at)}
                  </Typography>
                )}
              </Stack>
            </SectionCard>
            <SectionCard title="Payments">
              {payments.length ? (
                <Stack divider={<Divider />}>
                  {payments.map((p) => (
                    <Box key={p.payment_id} sx={{ py: 1 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {p.kind === 'refund' ? 'Refund · ' : ''}
                          {METHOD_NAMES[p.method] || p.method}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            color:
                              p.kind === 'refund'
                                ? 'error.main'
                                : 'text.primary',
                          }}
                        >
                          {p.kind === 'refund' ? '− ' : ''}
                          {formatMoney(p.amount, p.currency)}
                        </Typography>
                      </Stack>
                      <Typography variant="caption">
                        {formatDateTime(p.received_at)}
                        {p.reference ? ` · ${p.reference}` : ''}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No payments yet.
                </Typography>
              )}
            </SectionCard>
            {invoice.notes && (
              <SectionCard title="Notes">
                <Typography variant="body2">{invoice.notes}</Typography>
              </SectionCard>
            )}
          </Stack>
        </Grid>
      </Grid>
      <RecordPaymentDialog
        open={paying}
        invoice={invoice}
        onClose={() => setPaying(false)}
        onDone={() => {
          setPaying(false);
          load();
        }}
      />
    </Stack>
  );
};

// ---------- Payments ----------

export const PaymentsPage = () => {
  const notify = useNotify();
  const { params, get, set, page } = useListParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    setData(null);
    adminFinance
      .payments({
        page: page + 1,
        limit: PAGE_SIZE,
        ...(get('search') ? { search: get('search') } : {}),
        ...(get('kind') ? { kind: get('kind') } : {}),
        ...(get('method') ? { method: get('method') } : {}),
        ...(get('days') ? { days: get('days') } : {}),
        ...(get('customer') ? { customer: get('customer') } : {}),
      })
      .then((d) => active && setData(d))
      .catch((e) => {
        notify.error(e, 'We couldn’t load payments.');
        if (active) setData({ payments: [], total: 0, summary: {} });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, notify]);

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[{ label: 'Home', to: '/admin' }, { label: 'Payments' }]}
        title="Payments"
        subtitle="Every payment and refund, with its order, invoice and reference."
      />
      <Tiles>
        <Tile
          icon={<FiArrowDownLeft />}
          label="Received"
          tone="success"
          value={
            data ? (
              formatMoneyCompact(data.summary.received)
            ) : (
              <Skeleton width={90} />
            )
          }
        />
        <Tile
          icon={<FiArrowUpRight />}
          label="Refunded"
          tone="error"
          value={
            data ? (
              formatMoneyCompact(data.summary.refunded)
            ) : (
              <Skeleton width={90} />
            )
          }
        />
        <Tile
          icon={<FiDollarSign />}
          label="Net"
          value={
            data ? (
              formatMoneyCompact(data.summary.net)
            ) : (
              <Skeleton width={90} />
            )
          }
        />
      </Tiles>
      <TablePanel>
        <PanelToolbar>
          <Search
            value={get('search')}
            onChange={(v) => set('search', v)}
            placeholder="Search reference, invoice, order, customer"
          />
          <Box sx={{ flex: 1 }} />
          <FilterMenu
            label="Type"
            value={get('kind')}
            onChange={(v) => set('kind', v)}
            options={[
              { value: '', label: 'All' },
              { value: 'payment', label: 'Payments' },
              { value: 'refund', label: 'Refunds' },
            ]}
          />
          <FilterMenu
            label="Method"
            value={get('method')}
            onChange={(v) => set('method', v)}
            options={[
              { value: '', label: 'All' },
              ...['stripe', 'cod', 'cash', 'mpesa', 'bank'].map((m) => ({
                value: m,
                label: METHOD_NAMES[m],
              })),
            ]}
          />
          <TextField
            select
            size="small"
            value={get('days')}
            onChange={(e) => set('days', e.target.value)}
            SelectProps={{ displayEmpty: true }}
            sx={{ minWidth: 160 }}
            inputProps={{ 'aria-label': 'Date range' }}
          >
            {PERIODS.map((p) => (
              <MenuItem key={p.label} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
        </PanelToolbar>
        <TableContainer>
          <Table>
            <TableHead sx={headSx}>
              <TableRow>
                <TableCell>Reference</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Invoice</TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!data ? (
                <LoadingRows cols={8} rows={PAGE_SIZE} />
              ) : data.payments.length ? (
                data.payments.map((p) => (
                  <TableRow
                    key={p.payment_id}
                    hover
                    data-testid={`payment-${p.payment_id}`}
                  >
                    <TableCell
                      sx={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '0.8rem',
                      }}
                    >
                      {p.reference || `#${p.payment_id}`}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(p.received_at)}
                    </TableCell>
                    <TableCell>
                      <Customer c={p.customer} />
                    </TableCell>
                    <TableCell>
                      {p.invoice_id ? (
                        <Link
                          component={RouterLink}
                          to={`/admin/invoices/${p.invoice_id}`}
                          underline="hover"
                        >
                          {p.invoice_number}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {p.order_id ? (
                        <Link
                          component={RouterLink}
                          to={`/admin/orders/${p.order_id}`}
                          underline="hover"
                        >
                          #{p.order_id}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {METHOD_NAMES[p.method] || p.method}
                    </TableCell>
                    <TableCell>
                      <Pill
                        label={p.kind === 'refund' ? 'Refund' : 'Payment'}
                        tone={p.kind === 'refund' ? 'info' : 'success'}
                      />
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        color:
                          p.kind === 'refund' ? 'error.main' : 'text.primary',
                      }}
                    >
                      {p.kind === 'refund' ? '− ' : ''}
                      {formatMoney(p.amount, p.currency)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyRow cols={8}>No payments match.</EmptyRow>
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
            label="payments"
          />
        )}
      </TablePanel>
    </Stack>
  );
};

// ---------- Refunds ----------

const REFUND_STATES = {
  pending_approval: ['Waiting approval', 'warning'],
  processed: ['Paid back', 'success'],
  rejected: ['Rejected', 'default'],
  failed: ['Failed', 'error'],
};

export const RefundsPage = () => {
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const { get, set } = useListParams();
  const status = get('status');
  const canApprove = hasPermission(user, PERMISSIONS.refundsApprove);
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    setList(null);
    adminFinance
      .refunds(status || undefined)
      .then(setList)
      .catch((e) => {
        notify.error(e, 'We couldn’t load refunds.');
        setList([]);
      });
  }, [status, notify]);
  useEffect(() => {
    load();
  }, [load]);

  const decide = async (r, action) => {
    setBusy(r.refund_id);
    try {
      await adminFinance.decideRefund(r.refund_id, action);
      notify.success(
        action === 'approve'
          ? 'Refund approved and paid back.'
          : 'Refund rejected.'
      );
      load();
    } catch (e) {
      notify.error(e, 'We couldn’t update this refund.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[{ label: 'Home', to: '/admin' }, { label: 'Refunds' }]}
        title="Refunds"
        subtitle="Money paid back to customers, and refunds waiting for approval."
      />
      <TablePanel>
        <PanelToolbar>
          <FilterMenu
            label="Status"
            value={status}
            onChange={(v) => set('status', v)}
            options={[
              { value: '', label: 'All' },
              ...Object.entries(REFUND_STATES).map(([value, [label]]) => ({
                value,
                label,
              })),
            ]}
          />
        </PanelToolbar>
        <TableContainer>
          <Table>
            <TableHead sx={headSx}>
              <TableRow>
                <TableCell>Refund</TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Method</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {!list ? (
                <LoadingRows cols={8} rows={5} />
              ) : list.length ? (
                list.map((r) => {
                  const [label, tone] = REFUND_STATES[r.status] || [
                    r.status,
                    'default',
                  ];
                  return (
                    <TableRow
                      key={r.refund_id}
                      hover
                      data-testid={`refund-${r.refund_id}`}
                    >
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          #{r.refund_id}
                        </Typography>
                        <Typography variant="caption">
                          {formatDate(r.date_added)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to={`/admin/orders/${r.order_id}`}
                          underline="hover"
                        >
                          #{r.order_id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Customer c={r.customer} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 260 }}>
                        <Typography variant="body2" noWrap title={r.reason}>
                          {r.reason}
                        </Typography>
                        <Typography variant="caption">
                          {r.requested_by ? `By ${r.requested_by}` : ''}
                          {r.approved_by && r.status !== 'pending_approval'
                            ? ` · approved by ${r.approved_by}`
                            : ''}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {METHOD_NAMES[r.method] || r.method}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {formatMoney(r.amount)}
                        </Typography>
                        {r.restocking_fee > 0 && (
                          <Typography variant="caption">
                            fee {formatMoney(r.restocking_fee)} kept
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Pill label={label} tone={tone} />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {r.status === 'pending_approval' && canApprove && (
                          <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="flex-end"
                          >
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<FiCheck />}
                              disabled={busy === r.refund_id}
                              onClick={() => decide(r, 'approve')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              startIcon={<FiX />}
                              disabled={busy === r.refund_id}
                              onClick={() => decide(r, 'reject')}
                            >
                              Reject
                            </Button>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <EmptyRow cols={8}>No refunds here.</EmptyRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TablePanel>
    </Stack>
  );
};

// ---------- Refund settings ----------

export const RefundSettingsPage = () => {
  const notify = useNotify();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  useHideHelpWhile(editing);

  useEffect(() => {
    adminFinance
      .refundSettings()
      .then((s) => {
        setForm(s);
        setSaved(s);
      })
      .catch((e) => notify.error(e, 'We couldn’t load the refund settings.'));
  }, [notify]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const next = await adminFinance.saveRefundSettings({
        ...form,
        approval_threshold:
          form.approval_threshold === null || form.approval_threshold === ''
            ? null
            : Number(form.approval_threshold),
      });
      setForm(next);
      setSaved(next);
      setEditing(false);
      notify.success('Refund settings saved.');
    } catch (error) {
      setErrors(error?.fieldErrors || {});
      notify.error(error, 'We couldn’t save the refund settings.');
    } finally {
      setBusy(false);
    }
  };
  const err = (k) => (errors[k] ? { error: true, helperText: errors[k] } : {});

  return (
    <Box component="form" onSubmit={save} noValidate>
      <PageHeader
        crumbs={[{ label: 'Home', to: '/admin' }, { label: 'Refund settings' }]}
        title="Refund settings"
        subtitle="How returns and refunds work, and who must approve large refunds."
        actions={
          !editing && (
            <Button
              variant="contained"
              startIcon={<FiEdit2 />}
              onClick={() => setEditing(true)}
              disabled={!form}
            >
              Edit settings
            </Button>
          )
        }
      />
      {!form ? (
        <Skeleton variant="rounded" height={360} sx={{ mt: 3 }} />
      ) : (
        <Box
          component="fieldset"
          disabled={!editing}
          sx={{ border: 0, m: 0, p: 0, mt: 3, minWidth: 0, maxWidth: 900 }}
        >
          <Stack spacing={3}>
            <SectionCard
              title="Returns"
              subtitle="When customers can send items back."
            >
              <TextField
                label="Return window"
                type="number"
                value={form.return_window_days}
                onChange={(e) =>
                  setForm((f) => ({ ...f, return_window_days: e.target.value }))
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      days after delivery
                    </InputAdornment>
                  ),
                }}
                helperText={
                  errors.return_window_days ||
                  'Use 0 to accept returns at any time.'
                }
                error={Boolean(errors.return_window_days)}
                sx={{ maxWidth: 360 }}
              />
            </SectionCard>
            <SectionCard
              title="What’s refunded"
              subtitle="Applied when staff refund an order or a return."
            >
              <Stack spacing={2.5}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.refund_delivery}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          refund_delivery: e.target.checked,
                        }))
                      }
                    />
                  }
                  label="Refund the delivery charge when the whole order is refunded"
                />
                <TextField
                  label="Restocking fee"
                  type="number"
                  value={form.restocking_fee_percent}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      restocking_fee_percent: e.target.value,
                    }))
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        % of returned goods
                      </InputAdornment>
                    ),
                  }}
                  helperText={
                    errors.restocking_fee_percent ||
                    'Kept by the shop on returns. Use 0 for none.'
                  }
                  error={Boolean(errors.restocking_fee_percent)}
                  sx={{ maxWidth: 360 }}
                />
              </Stack>
            </SectionCard>
            <SectionCard
              title="Approval"
              subtitle="Large refunds wait for someone with “Approve refunds above the approval limit”."
            >
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.approval_threshold !== null}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          approval_threshold: e.target.checked ? 10000 : null,
                        }))
                      }
                    />
                  }
                  label="Require approval for large refunds"
                />
                {form.approval_threshold !== null && (
                  <TextField
                    label="Approval needed above"
                    type="number"
                    value={form.approval_threshold}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        approval_threshold: e.target.value,
                      }))
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          {getCurrency()}
                        </InputAdornment>
                      ),
                    }}
                    {...err('approval_threshold')}
                    sx={{ maxWidth: 360 }}
                  />
                )}
              </Stack>
            </SectionCard>
          </Stack>
        </Box>
      )}
      {form && editing && (
        <Stack
          direction="row"
          justifyContent="flex-end"
          spacing={1.5}
          sx={{
            position: 'sticky',
            bottom: 0,
            mt: 3,
            py: 2,
            maxWidth: 900,
            bgcolor: 'background.neutral',
            borderTop: 1,
            borderColor: 'divider',
            zIndex: 2,
          }}
        >
          <Button
            variant="outlined"
            size="large"
            disabled={busy}
            sx={{ bgcolor: 'background.paper' }}
            onClick={() => {
              setForm(saved);
              setErrors({});
              setEditing(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={<FiSave />}
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </Stack>
      )}
    </Box>
  );
};

// ---------- Ledger ----------

const TYPE_NAMES = {
  asset: 'Asset',
  liability: 'Liability',
  income: 'Income',
  contra: 'Contra-income',
};

export const LedgerPage = () => {
  const notify = useNotify();
  const { params, get, set, page } = useListParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    setData(null);
    adminFinance
      .ledger({
        page: page + 1,
        limit: PAGE_SIZE,
        ...(get('days') ? { days: get('days') } : {}),
        ...(get('account') ? { account: get('account') } : {}),
      })
      .then((d) => active && setData(d))
      .catch((e) => notify.error(e, 'We couldn’t load the ledger.'));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, notify]);

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[{ label: 'Home', to: '/admin' }, { label: 'Ledger' }]}
        title="Ledger"
        subtitle="Every sale, payment and refund as balanced double-entry journals."
        actions={
          <TextField
            select
            size="small"
            value={get('days')}
            onChange={(e) => set('days', e.target.value)}
            SelectProps={{ displayEmpty: true }}
            sx={{ minWidth: 160, bgcolor: 'background.paper' }}
            inputProps={{ 'aria-label': 'Period' }}
          >
            {PERIODS.map((p) => (
              <MenuItem key={p.label} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
        }
      />
      <SectionCard
        title="Account balances"
        action={
          data && (
            <Chip
              icon={
                data.totals.balanced ? <FiCheckCircle /> : <FiAlertCircle />
              }
              color={data.totals.balanced ? 'success' : 'error'}
              variant="outlined"
              label={
                data.totals.balanced ? 'Debits equal credits' : 'Out of balance'
              }
              data-testid="ledger-balanced"
            />
          )
        }
      >
        {!data ? (
          <Skeleton variant="rounded" height={320} />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead sx={headSx}>
                <TableRow>
                  <TableCell>Account</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Debits</TableCell>
                  <TableCell align="right">Credits</TableCell>
                  <TableCell align="right">Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.accounts.map((a) => (
                  <TableRow
                    key={a.account}
                    hover
                    selected={get('account') === a.account}
                    sx={{ cursor: 'pointer' }}
                    onClick={() =>
                      set(
                        'account',
                        get('account') === a.account ? '' : a.account
                      )
                    }
                  >
                    <TableCell sx={{ fontWeight: 600 }}>{a.name}</TableCell>
                    <TableCell>{TYPE_NAMES[a.type]}</TableCell>
                    <TableCell align="right">{formatMoney(a.debit)}</TableCell>
                    <TableCell align="right">{formatMoney(a.credit)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {formatMoney(a.balance)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow
                  sx={{
                    '& td': {
                      fontWeight: 800,
                      borderTop: 2,
                      borderColor: 'divider',
                    },
                  }}
                >
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell align="right">
                    {formatMoney(data.totals.debit)}
                  </TableCell>
                  <TableCell align="right">
                    {formatMoney(data.totals.credit)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>

      <SectionCard
        title="Journals"
        subtitle={
          get('account')
            ? `Showing journals that touch ${data?.accounts.find((a) => a.account === get('account'))?.name || get('account')}`
            : 'Newest first. Click an account above to filter.'
        }
      >
        {!data ? (
          <Skeleton variant="rounded" height={320} />
        ) : !data.journals.length ? (
          <Typography color="text.secondary">
            No journals in this period.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {data.journals.map((j) => (
              <Box
                key={j.journal_id}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  sx={{ px: 2, py: 1.25, bgcolor: 'background.neutral' }}
                  flexWrap="wrap"
                  useFlexGap
                >
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    J{j.journal_id}
                  </Typography>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {j.memo}
                  </Typography>
                  {j.order_id && (
                    <Link
                      component={RouterLink}
                      to={`/admin/orders/${j.order_id}`}
                      variant="body2"
                      underline="hover"
                    >
                      Order #{j.order_id}
                    </Link>
                  )}
                  <Typography variant="caption">
                    {formatDateTime(j.occurred_at)}
                  </Typography>
                </Stack>
                <Table size="small">
                  <TableBody>
                    {j.lines.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ pl: l.credit ? 5 : 2, width: '50%' }}>
                          {l.name}
                        </TableCell>
                        <TableCell align="right">
                          {l.debit ? formatMoney(l.debit, j.currency) : ''}
                        </TableCell>
                        <TableCell align="right">
                          {l.credit ? formatMoney(l.credit, j.currency) : ''}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ))}
            <Box
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <StandardPagination
                count={data.total_journals}
                page={page}
                rowsPerPage={PAGE_SIZE}
                onPageChange={(_, p) => set('page', String(p + 1))}
                onRowsPerPageChange={() => {}}
                maxShowAll={0}
                label="journals"
              />
            </Box>
          </Stack>
        )}
      </SectionCard>
    </Stack>
  );
};
