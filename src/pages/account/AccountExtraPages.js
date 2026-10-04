// src/pages/account/AccountExtraPages.js — Track an order, Invoices (one
// per placed order) and a printable invoice.
import React, { useEffect, useState } from 'react';
import {
  Link as RouterLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  Box,
  Button,
  InputAdornment,
  LinearProgress,
  Link,
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
import {
  FiArrowRight,
  FiFileText,
  FiPrinter,
  FiSearch,
  FiTruck,
} from 'react-icons/fi';
import { orders as ordersApi } from '../../api';
import { AccountPage } from '../../layouts/StorefrontLayout';
import { EmptyState, SectionCard, StatusChip } from '../../components/ui';
import OrderTracker, {
  progressOf,
} from '../../components/account/OrderTracker';
import InvoiceDocument, {
  invoiceNumber,
  invoiceState,
} from '../../components/invoice/InvoiceDocument';
import {
  LoadingRows,
  PAGE_SIZE,
  Pill,
  StandardPagination,
} from '../../components/admin/DataTable';
import { formatDate, formatMoney } from '../../utils/format';

const ACTIVE = ['awaiting_payment', 'pending', 'processing', 'shipped'];

// ---------- Track an order ----------

export const TrackOrderPage = () => {
  const [params, setParams] = useSearchParams();
  const [number, setNumber] = useState(params.get('order') || '');
  const [active, setActive] = useState(null);
  const [found, setFound] = useState(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ordersApi
      .list({ limit: 50 })
      .then((r) => setActive(r.orders.filter((o) => ACTIVE.includes(o.status))))
      .catch(() => setActive([]));
  }, []);

  const lookUp = async (id) => {
    const clean = String(id).replace(/[^0-9]/g, '');
    if (!clean) {
      setProblem('Please enter your order number, for example 1024.');
      return;
    }
    setBusy(true);
    setProblem('');
    try {
      setFound(await ordersApi.get(clean));
      setParams({ order: clean }, { replace: true });
    } catch {
      setFound(null);
      setProblem(`We couldn’t find order #${clean} in your account.`);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (params.get('order')) lookUp(params.get('order'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AccountPage
      title="Track an order"
      subtitle="See where your order is right now."
    >
      <Stack spacing={3}>
        <SectionCard>
          <Stack
            component="form"
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            onSubmit={(e) => {
              e.preventDefault();
              lookUp(number);
            }}
          >
            <TextField
              label="Order number"
              placeholder="e.g. 1024"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              error={Boolean(problem)}
              helperText={
                problem || 'You’ll find it in your order confirmation email.'
              }
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">#</InputAdornment>
                ),
              }}
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={<FiSearch />}
              disabled={busy}
              sx={{ height: 56, px: 3, flexShrink: 0 }}
            >
              Track
            </Button>
          </Stack>
        </SectionCard>

        {found && (
          <SectionCard
            title={`Order #${found.id}`}
            subtitle={`Placed ${formatDate(found.placedAt)} · ${found.items.length} item${found.items.length === 1 ? '' : 's'} · ${formatMoney(found.total, found.currency)}`}
            action={
              <Button
                component={RouterLink}
                to={`/account/orders/${found.id}`}
                endIcon={<FiArrowRight />}
              >
                Order details
              </Button>
            }
          >
            <OrderTracker order={found} />
          </SectionCard>
        )}

        <SectionCard
          title="On the way"
          subtitle="Orders that haven’t arrived yet."
        >
          {!active ? (
            <Skeleton variant="rounded" height={120} />
          ) : !active.length ? (
            <EmptyState icon={<FiTruck />} title="Nothing on the way">
              Orders you place will show here until they’re delivered.
            </EmptyState>
          ) : (
            <Stack spacing={1.5}>
              {active.map((o) => (
                <Stack
                  key={o.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems={{ sm: 'center' }}
                  sx={{
                    p: 2,
                    borderRadius: '8px',
                    bgcolor: 'background.neutral',
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                    {o.preview.slice(0, 3).map((p) => (
                      <Box
                        key={p.image + p.name}
                        component="img"
                        src={p.image}
                        alt=""
                        sx={{
                          width: 48,
                          height: 48,
                          objectFit: 'contain',
                          borderRadius: '8px',
                          bgcolor: 'background.paper',
                        }}
                      />
                    ))}
                  </Stack>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle2">Order #{o.id}</Typography>
                      <StatusChip status={o.status} label={o.statusName} />
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={progressOf(o.status)}
                      sx={{ mt: 1, height: 6, borderRadius: 999 }}
                      aria-label={`Order #${o.id} progress`}
                    />
                  </Box>
                  <Button
                    onClick={() => {
                      setNumber(String(o.id));
                      lookUp(o.id);
                    }}
                    aria-label={`Track order #${o.id}`}
                    sx={{ flexShrink: 0 }}
                  >
                    Track
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
        </SectionCard>
      </Stack>
    </AccountPage>
  );
};

// ---------- Invoices ----------

export const InvoicesPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    setResult(null);
    ordersApi
      .list({ page: page + 1, limit: PAGE_SIZE })
      .then(setResult)
      .catch(() => setResult({ orders: [], total: 0 }));
  }, [page]);

  return (
    <AccountPage
      title="Invoices"
      subtitle="An invoice for every order, ready to download or print."
    >
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'background.paper',
        }}
      >
        <TableContainer>
          <Table>
            <TableHead
              sx={{
                bgcolor: 'background.neutral',
                '& th': {
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                },
              }}
            >
              <TableRow>
                <TableCell>Invoice</TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {!result ? (
                <LoadingRows cols={6} rows={5} />
              ) : result.orders.length ? (
                result.orders.map((o) => {
                  const [label, tone] = invoiceState(o);
                  return (
                    <TableRow
                      key={o.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/account/invoices/${o.id}`)}
                      data-testid={`invoice-row-${o.id}`}
                    >
                      <TableCell sx={{ fontWeight: 700 }}>
                        <Link
                          component={RouterLink}
                          to={`/account/invoices/${o.id}`}
                          underline="hover"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {invoiceNumber(o.id)}
                        </Link>
                      </TableCell>
                      <TableCell>#{o.id}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {formatDate(o.placedAt)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                      >
                        {formatMoney(o.total, o.currency)}
                      </TableCell>
                      <TableCell>
                        <Pill label={label} tone={tone} />
                      </TableCell>
                      <TableCell align="right">
                        <FiFileText aria-hidden />
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState icon={<FiFileText />} title="No invoices yet">
                      Each order you place gets an invoice here.
                    </EmptyState>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {result && result.total > 0 && (
          <StandardPagination
            count={result.total}
            page={page}
            rowsPerPage={PAGE_SIZE}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={() => {}}
            maxShowAll={0}
            label="invoices"
          />
        )}
      </Box>
    </AccountPage>
  );
};

export const InvoicePage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    ordersApi
      .get(id)
      .then(setOrder)
      .catch(() => setMissing(true));
  }, [id]);

  return (
    <AccountPage
      title={invoiceNumber(id)}
      subtitle={order ? `For order #${order.id}` : ' '}
      back="/account/invoices"
      backLabel="Invoices"
      action={
        <Stack direction="row" spacing={1} className="no-print">
          {order && (
            <Button component={RouterLink} to={`/account/orders/${order.id}`}>
              View order
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<FiPrinter />}
            onClick={() => window.print()}
            disabled={!order}
          >
            Print or save PDF
          </Button>
        </Stack>
      }
    >
      {missing ? (
        <EmptyState icon={<FiFileText />} title="Invoice not found">
          We couldn’t find that invoice in your account.
        </EmptyState>
      ) : !order ? (
        <Skeleton variant="rounded" height={640} />
      ) : (
        <InvoiceDocument order={order} />
      )}
    </AccountPage>
  );
};
