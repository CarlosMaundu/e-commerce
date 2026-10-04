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
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
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
  FiDownload,
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
  PanelTabs,
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
  downloadCsv,
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyCompact,
  formatShortDate,
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

const Customer = ({ c, email = true }) =>
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
        {email && c.email && (
          <Typography variant="caption" noWrap component="div">
            {c.email}
          </Typography>
        )}
      </Box>
    </Stack>
  ) : (
    '—'
  );
Customer.propTypes = { c: PropTypes.object, email: PropTypes.bool };

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
                          {i.order_number}
                        </Link>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {formatShortDate(i.issued_at)}
                      </TableCell>
                      <TableCell
                        sx={{
                          whiteSpace: 'nowrap',
                          color: overdue ? 'error.main' : 'text.secondary',
                        }}
                      >
                        {i.balance > 0 && i.due_at
                          ? formatShortDate(i.due_at)
                          : '—'}
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
        subtitle={`${invoice.number} · order ${invoice.order_number}`}
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
                <TableCell>Method</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!data ? (
                <LoadingRows cols={7} rows={PAGE_SIZE} />
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
                    <TableCell
                      sx={{ whiteSpace: 'nowrap' }}
                      title={formatDateTime(p.received_at)}
                    >
                      {formatShortDate(p.received_at)}
                    </TableCell>
                    <TableCell>
                      <Customer c={p.customer} email={false} />
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
                <EmptyRow cols={7}>No payments match.</EmptyRow>
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

const REFUND_TABS = [
  { value: 'pending', label: 'Pending approval', status: 'pending_approval' },
  { value: 'approved', label: 'Approved', status: 'processed,failed' },
  { value: 'rejected', label: 'Rejected', status: 'rejected' },
];

const refundFilters = (get) => ({
  ...(get('search') ? { search: get('search') } : {}),
  ...(get('method') ? { method: get('method') } : {}),
  ...(get('days') ? { days: get('days') } : {}),
  ...(get('customer') ? { customer: get('customer') } : {}),
});

export const RefundsPage = () => {
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const { params, get, set, page } = useListParams();
  const tab = REFUND_TABS.find((t) => t.value === get('tab')) || REFUND_TABS[0];
  const canApprove = hasPermission(user, PERMISSIONS.refundsApprove);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    let active = true;
    setData(null);
    adminFinance
      .refunds({
        status: tab.status,
        page: page + 1,
        limit: PAGE_SIZE,
        ...refundFilters(get),
      })
      .then((d) => active && setData(d))
      .catch((e) => {
        notify.error(e, 'We couldn’t load refunds.');
        if (active) setData({ refunds: [], total: 0, counts: {} });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, notify]);
  useEffect(load, [load]);

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

  // Everything matching the tab and filters, not just this page.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = [];
      for (let p = 1; ; p += 1) {
        // eslint-disable-next-line no-await-in-loop
        const d = await adminFinance.refunds({
          status: tab.status,
          page: p,
          limit: 100,
          ...refundFilters(get),
        });
        all.push(...d.refunds);
        if (all.length >= d.total || !d.refunds.length) break;
      }
      downloadCsv(
        `refunds-${tab.value}.csv`,
        [
          'Refund',
          'Date',
          'Order',
          'Invoice',
          'Customer',
          'Reason',
          'Method',
          'Reference',
          'Amount',
          'Restocking fee',
          'Status',
          'Requested by',
          'Approved by',
        ],
        all.map((r) => [
          r.refund_id,
          formatShortDate(r.date_added),
          r.order_id,
          r.invoice_number || '',
          r.customer?.name || '',
          r.reason,
          METHOD_NAMES[r.method] || r.method,
          r.reference || '',
          r.amount,
          r.restocking_fee,
          (REFUND_STATES[r.status] || [r.status])[0],
          r.requested_by || '',
          r.approved_by || '',
        ])
      );
    } catch (e) {
      notify.error(e, 'We couldn’t export refunds.');
    } finally {
      setExporting(false);
    }
  };

  const counts = data?.counts || {};
  const countOf = (t) =>
    t.status.split(',').reduce((n, s) => n + (counts[s] || 0), 0);
  const cols = 9;

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[{ label: 'Home', to: '/admin' }, { label: 'Refunds' }]}
        title="Refunds"
        subtitle={
          get('customer') ? (
            <Chip
              size="small"
              label={`Customer: ${get('customerName') || `#${get('customer')}`}`}
              onDelete={() => {
                set('customer', '');
              }}
              color="primary"
              variant="outlined"
              sx={{ mt: 0.5 }}
            />
          ) : (
            'Money paid back to customers, and refunds waiting for approval.'
          )
        }
        actions={
          <Button
            variant="outlined"
            startIcon={<FiDownload />}
            onClick={exportCsv}
            disabled={exporting || !data?.total}
            sx={{ bgcolor: 'background.paper' }}
          >
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        }
      />
      <TablePanel>
        <PanelTabs
          value={tab.value}
          onChange={(v) => set('tab', v)}
          tabs={REFUND_TABS.map((t) => ({
            value: t.value,
            label: t.label,
            count: data ? countOf(t) : undefined,
          }))}
        />
        <PanelToolbar>
          <Search
            value={get('search')}
            onChange={(v) => set('search', v)}
            placeholder="Search refund reason, order, invoice, customer"
          />
          <Box sx={{ flex: 1 }} />
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
                <TableCell>Refund</TableCell>
                <TableCell>Date</TableCell>
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
              {!data ? (
                <LoadingRows cols={cols} rows={PAGE_SIZE} />
              ) : data.refunds.length ? (
                data.refunds.map((r) => {
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
                      <TableCell sx={{ fontWeight: 700 }}>
                        #{r.refund_id}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {formatShortDate(r.date_added)}
                      </TableCell>
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to={`/admin/orders/${r.order_id}`}
                          underline="hover"
                        >
                          {r.order_number || `#${r.order_id}`}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Customer c={r.customer} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 260 }}>
                        <Typography variant="body2" noWrap title={r.reason}>
                          {r.reason}
                        </Typography>
                        <Typography variant="caption" component="div">
                          {r.return_id && (
                            <Link
                              component={RouterLink}
                              to={`/admin/returns?search=${r.return_id}`}
                              underline="hover"
                            >
                              Return #{r.return_id}
                            </Link>
                          )}
                          {r.return_id && r.requested_by ? ' · ' : ''}
                          {r.requested_by ? `By ${r.requested_by}` : ''}
                          {r.approved_by && r.status !== 'pending_approval'
                            ? ` · ${r.status === 'rejected' ? 'rejected' : 'approved'} by ${r.approved_by}`
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
                <EmptyRow cols={cols}>
                  {tab.value === 'pending'
                    ? 'No refunds are waiting for approval.'
                    : 'No refunds match.'}
                </EmptyRow>
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
            label="refunds"
          />
        )}
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

const JOURNAL_KINDS = {
  sale: ['Sale', 'primary'],
  payment: ['Payment', 'success'],
  refund: ['Refund', 'warning'],
  void: ['Cancelled invoice', 'default'],
  adjustment: ['Adjustment', 'default'],
};

/** One journal entry in full: what happened, links, and the double entry. */
const JournalDialog = ({ journal: j, onClose }) => {
  const [kindLabel, tone] = (j && JOURNAL_KINDS[j.kind]) || ['', 'default'];
  return (
    <Dialog open={!!j} onClose={onClose} fullWidth maxWidth="sm">
      {j && (
        <>
          <DialogTitle sx={{ pr: 6 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <span>Journal J{j.journal_id}</span>
              <Pill label={kindLabel} tone={tone} />
            </Stack>
            <IconButton
              aria-label="Close"
              onClick={onClose}
              sx={{ position: 'absolute', right: 12, top: 12 }}
            >
              <FiX />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ fontWeight: 600 }}>{j.description}</Typography>
            <Box
              component="dl"
              sx={{
                mt: 2,
                mb: 0,
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr)',
                columnGap: 2,
                rowGap: 1,
                '& dt': { color: 'text.secondary', fontSize: '0.875rem' },
                '& dd': { m: 0, fontSize: '0.875rem' },
              }}
            >
              <dt>When</dt>
              <dd>{formatDateTime(j.occurred_at)}</dd>
              <dt>Amount</dt>
              <dd>
                <strong>{formatMoney(j.amount, j.currency)}</strong>
              </dd>
              {j.customer && (
                <>
                  <dt>Customer</dt>
                  <dd>
                    <Link
                      component={RouterLink}
                      to={`/admin/users/${j.customer.customer_id}`}
                    >
                      {j.customer.name}
                    </Link>
                  </dd>
                </>
              )}
              {j.order_id && (
                <>
                  <dt>Order</dt>
                  <dd>
                    <Link
                      component={RouterLink}
                      to={`/admin/orders/${j.order_id}`}
                    >
                      {j.order_number || `#${j.order_id}`}
                    </Link>
                  </dd>
                </>
              )}
              {j.invoice_id && (
                <>
                  <dt>Invoice</dt>
                  <dd>
                    <Link
                      component={RouterLink}
                      to={`/admin/invoices/${j.invoice_id}`}
                    >
                      {j.invoice_number}
                    </Link>
                  </dd>
                </>
              )}
              {j.refund_id && (
                <>
                  <dt>Refund</dt>
                  <dd>
                    <Link
                      component={RouterLink}
                      to={`/admin/refunds?tab=approved&search=${j.order_number || ''}`}
                    >
                      Refund #{j.refund_id}
                    </Link>
                  </dd>
                </>
              )}
              <dt>Note</dt>
              <dd>{j.memo}</dd>
            </Box>
            <Table size="small" sx={{ mt: 2.5 }}>
              <TableHead sx={headSx}>
                <TableRow>
                  <TableCell>Account</TableCell>
                  <TableCell align="right">Debit</TableCell>
                  <TableCell align="right">Credit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {j.lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ pl: l.credit ? 4 : 2 }}>
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
          </DialogContent>
        </>
      )}
    </Dialog>
  );
};
JournalDialog.propTypes = {
  journal: PropTypes.object,
  onClose: PropTypes.func,
};

export const LedgerPage = () => {
  const [openJournal, setOpenJournal] = useState(null);
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
        ...(get('kind') ? { kind: get('kind') } : {}),
        ...(get('search') ? { search: get('search') } : {}),
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
        subtitle="Every sale, payment and refund, kept as balanced double entries."
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

      <Typography variant="h5" component="h2">
        Journal entries
      </Typography>
      <TablePanel>
        <PanelToolbar>
          <Search
            value={get('search')}
            onChange={(v) => set('search', v)}
            placeholder="Search customer, order, invoice"
          />
          <Box sx={{ flex: 1 }} />
          <FilterMenu
            label="Type"
            value={get('kind')}
            onChange={(v) => set('kind', v)}
            options={[
              { value: '', label: 'All' },
              ...Object.entries(JOURNAL_KINDS).map(([value, [label]]) => ({
                value,
                label,
              })),
            ]}
          />
          <FilterMenu
            label="Account"
            value={get('account')}
            onChange={(v) => set('account', v)}
            options={[
              { value: '', label: 'All' },
              ...(data?.accounts || []).map((a) => ({
                value: a.account,
                label: a.name,
              })),
            ]}
          />
        </PanelToolbar>
        <TableContainer>
          <Table>
            <TableHead sx={headSx}>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!data ? (
                <LoadingRows cols={4} rows={PAGE_SIZE} />
              ) : data.journals.length ? (
                data.journals.map((j) => {
                  const [kindLabel, tone] = JOURNAL_KINDS[j.kind] || [
                    j.kind_name,
                    'default',
                  ];
                  return (
                    <TableRow
                      key={j.journal_id}
                      hover
                      tabIndex={0}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setOpenJournal(j)}
                      onKeyDown={(e) => e.key === 'Enter' && setOpenJournal(j)}
                      data-testid={`journal-${j.journal_id}`}
                    >
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {formatShortDate(j.occurred_at)}
                      </TableCell>
                      <TableCell>
                        <Pill label={kindLabel} tone={tone} />
                      </TableCell>
                      <TableCell>{j.description}</TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                      >
                        {formatMoney(j.amount, j.currency)}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <EmptyRow cols={4}>Nothing matches.</EmptyRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {data && data.total_journals > 0 && (
          <StandardPagination
            count={data.total_journals}
            page={page}
            rowsPerPage={PAGE_SIZE}
            onPageChange={(_, p) => set('page', String(p + 1))}
            onRowsPerPageChange={() => {}}
            maxShowAll={0}
            label="entries"
          />
        )}
      </TablePanel>
      <JournalDialog
        journal={openJournal}
        onClose={() => setOpenJournal(null)}
      />
    </Stack>
  );
};
