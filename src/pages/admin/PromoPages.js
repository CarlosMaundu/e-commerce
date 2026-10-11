// src/pages/admin/PromoPages.js — Back office → Promo codes: every code with
// its discount, dates, limits and how much it's been used; a code's page with
// its totals and each use (customer, order, invoice, discount); and the
// dialog that creates or changes a code.
import React, { useCallback, useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Link as RouterLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  InputAdornment,
  LinearProgress,
  Link,
  MenuItem,
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
  FiEdit2,
  FiPlus,
  FiShoppingBag,
  FiTrash2,
  FiTrendingDown,
  FiUsers,
  FiDollarSign,
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../auth/permissions';
import { adminPromos } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { useStore } from '../../context/StoreContext';
import {
  EmptyRow,
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
import { SectionCard } from '../../components/ui';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import { formatDate, formatDateTime, formatMoney } from '../../utils/format';

const fieldErrors = (error) => error?.fieldErrors || {};

export const PROMO_STATES = {
  active: ['Active', 'success'],
  scheduled: ['Scheduled', 'info'],
  used_up: ['Used up', 'warning'],
  expired: ['Expired', 'default'],
  inactive: ['Off', 'default'],
};
const TABS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'used_up', label: 'Used up' },
  { value: 'expired', label: 'Expired' },
  { value: 'inactive', label: 'Off' },
];
const ORDER_STATUS = {
  awaiting_payment: ['Awaiting payment', 'warning'],
  pending: ['Pending', 'warning'],
  processing: ['Processing', 'info'],
  shipped: ['Shipped', 'info'],
  delivered: ['Delivered', 'success'],
  refunded: ['Refunded', 'default'],
};

const discountText = (p, currency) =>
  p.type === 'percent'
    ? `${p.value}% off`
    : `${formatMoney(p.value, currency)} off`;

const validText = (p) => {
  if (!p.starts_at && !p.ends_at) return 'No end date';
  if (p.starts_at && p.ends_at)
    return `${formatDate(p.starts_at)} – ${formatDate(p.ends_at)}`;
  return p.ends_at
    ? `Until ${formatDate(p.ends_at)}`
    : `From ${formatDate(p.starts_at)}`;
};

// "2026-10-11T09:30" for datetime-local inputs, in the viewer's time zone.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

const Usage = ({ promo }) => (
  <Box sx={{ minWidth: 110 }}>
    <Typography variant="body2" sx={{ fontWeight: 600 }}>
      {promo.uses}
      {promo.uses_limit ? ` of ${promo.uses_limit}` : ''}
    </Typography>
    {promo.uses_limit ? (
      <LinearProgress
        variant="determinate"
        value={Math.min(100, (promo.uses / promo.uses_limit) * 100)}
        sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
        aria-label={`${promo.uses} of ${promo.uses_limit} uses`}
      />
    ) : (
      <Typography variant="caption" color="text.secondary">
        No limit
      </Typography>
    )}
  </Box>
);
Usage.propTypes = { promo: PropTypes.object.isRequired };

const EMPTY = {
  code: '',
  description: '',
  type: 'percent',
  value: '',
  min_total: '',
  starts_at: '',
  ends_at: '',
  uses_limit: '',
  per_customer_limit: '',
  audience: 'everyone',
  new_customer_days: '',
  max_discount: '',
  exclude_sale_items: false,
  send_on_signup: false,
  active: true,
};

const AUDIENCES = {
  everyone: 'Everyone',
  first_order: 'First order only',
  new_customers: 'New customers (recently signed up)',
  returning: 'Returning customers (second order on)',
};

/** The code's rules in a line, e.g. "First order only · max KES 500 · not on sale items". */
export const rulesText = (p, currency) =>
  [
    p.audience === 'new_customers'
      ? `Joined in the last ${p.new_customer_days} days`
      : p.audience && p.audience !== 'everyone'
        ? AUDIENCES[p.audience].replace(/ \(.*\)$/, '')
        : '',
    p.max_discount ? `max ${formatMoney(p.max_discount, currency)}` : '',
    p.exclude_sale_items ? 'not on sale items' : '',
    p.send_on_signup ? 'emailed on sign-up' : '',
  ]
    .filter(Boolean)
    .join(' · ');

/** Create (no `promo.code` yet) or change a promo code. */
export const PromoDialog = ({ promo, onClose, onSaved }) => {
  const notify = useNotify();
  const shop = useStore();
  const editing = Boolean(promo?.date_added);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!promo) return;
    setErrors({});
    setForm({
      ...EMPTY,
      ...promo,
      value: promo.value ?? '',
      min_total: promo.min_total || '',
      starts_at: toLocalInput(promo.starts_at),
      ends_at: toLocalInput(promo.ends_at),
      uses_limit: promo.uses_limit ?? '',
      per_customer_limit: promo.per_customer_limit ?? '',
      new_customer_days: promo.new_customer_days ?? '',
      max_discount: promo.max_discount ?? '',
    });
  }, [promo]);
  const set = (key) => (e) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }));
  const err = (key) =>
    errors[key] ? { error: true, helperText: errors[key] } : {};
  const currency = shop.finance?.currency || '';

  const save = async () => {
    setSaving(true);
    setErrors({});
    const body = {
      ...form,
      code: form.code.trim(),
      min_total: form.min_total === '' ? 0 : form.min_total,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : '',
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : '',
    };
    try {
      const saved = editing
        ? await adminPromos.update(promo.code, body)
        : await adminPromos.create(body);
      notify.success(
        editing ? `${saved.code} saved.` : `${saved.code} created.`
      );
      onSaved(saved);
    } catch (error) {
      setErrors(fieldErrors(error));
      notify.error(error, 'We couldn’t save the promo code.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(promo)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {editing ? `Edit ${promo.code}` : 'New promo code'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Code"
              value={form.code}
              onChange={(e) =>
                setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
              }
              disabled={editing}
              {...err('code')}
              helperText={errors.code || 'What customers type, e.g. WELCOME10.'}
              inputProps={{ maxLength: 40 }}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Description"
              value={form.description}
              onChange={set('description')}
              {...err('description')}
              helperText={
                errors.description || 'Shown to customers with the discount.'
              }
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              label="Discount type"
              value={form.type}
              onChange={set('type')}
              fullWidth
            >
              <MenuItem value="percent">Percentage off</MenuItem>
              <MenuItem value="fixed">Fixed amount off</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Discount"
              type="number"
              value={form.value}
              onChange={set('value')}
              {...err('value')}
              fullWidth
              required
              InputProps={{
                [form.type === 'percent' ? 'endAdornment' : 'startAdornment']: (
                  <InputAdornment
                    position={form.type === 'percent' ? 'end' : 'start'}
                  >
                    {form.type === 'percent' ? '%' : currency}
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Minimum order"
              type="number"
              value={form.min_total}
              onChange={set('min_total')}
              {...err('min_total')}
              helperText={errors.min_total || 'Leave empty for no minimum.'}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">{currency}</InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Total uses"
              type="number"
              value={form.uses_limit}
              onChange={set('uses_limit')}
              {...err('uses_limit')}
              helperText={errors.uses_limit || 'Leave empty for no limit.'}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Starts"
              type="datetime-local"
              value={form.starts_at}
              onChange={set('starts_at')}
              {...err('starts_at')}
              helperText={errors.starts_at || 'Leave empty to start now.'}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Ends"
              type="datetime-local"
              value={form.ends_at}
              onChange={set('ends_at')}
              {...err('ends_at')}
              helperText={errors.ends_at || 'Leave empty for no end date.'}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Uses per customer"
              type="number"
              value={form.per_customer_limit}
              onChange={set('per_customer_limit')}
              {...err('per_customer_limit')}
              helperText={
                errors.per_customer_limit || 'Leave empty for no limit.'
              }
              fullWidth
            />
          </Grid>
          <Grid
            item
            xs={12}
            sm={6}
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <FormControlLabel
              control={
                <Switch checked={form.active} onChange={set('active')} />
              }
              label={form.active ? 'On: customers can use it' : 'Off'}
            />
          </Grid>
          <Grid item xs={12}>
            <Divider sx={{ my: 0.5 }} />
            <Typography variant="subtitle2" sx={{ mt: 1.5 }}>
              Rules
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              label="Who can use it"
              value={form.audience}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  audience: e.target.value,
                  new_customer_days:
                    e.target.value === 'new_customers'
                      ? f.new_customer_days || 30
                      : f.new_customer_days,
                  send_on_signup:
                    e.target.value === 'returning' ? false : f.send_on_signup,
                }))
              }
              {...err('audience')}
              fullWidth
            >
              {Object.entries(AUDIENCES).map(([v, l]) => (
                <MenuItem key={v} value={v}>
                  {l}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            {form.audience === 'new_customers' && (
              <TextField
                label="Days after signing up"
                type="number"
                value={form.new_customer_days}
                onChange={set('new_customer_days')}
                {...err('new_customer_days')}
                helperText={
                  errors.new_customer_days ||
                  'The code works this many days after an account is created.'
                }
                fullWidth
              />
            )}
          </Grid>
          {form.type === 'percent' && (
            <Grid item xs={12} sm={6}>
              <TextField
                label="Maximum discount"
                type="number"
                value={form.max_discount}
                onChange={set('max_discount')}
                {...err('max_discount')}
                helperText={
                  errors.max_discount ||
                  'A cap on the amount off. Leave empty for none.'
                }
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">{currency}</InputAdornment>
                  ),
                }}
              />
            </Grid>
          )}
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.exclude_sale_items}
                  onChange={set('exclude_sale_items')}
                />
              }
              label="Not on items already on sale"
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.send_on_signup}
                  onChange={set('send_on_signup')}
                  disabled={form.audience === 'returning'}
                />
              }
              label="Email this code to new customers when they sign up"
            />
            {errors.send_on_signup && (
              <Typography variant="caption" color="error" component="div">
                {errors.send_on_signup}
              </Typography>
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save code' : 'Create code'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
PromoDialog.propTypes = {
  promo: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export const PromoCodesPage = () => {
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const navigate = useNavigate();
  const shop = useStore();
  const currency = shop.finance?.currency;
  const canManage = hasPermission(user, PERMISSIONS.promosManage);
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || '';
  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const tab = get('tab') || 'all';
  const page = Number(get('page') || 1) - 1;
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(() => {
    let active = true;
    setData(null);
    adminPromos
      .list({
        status: tab,
        search: get('search') || undefined,
        page: page + 1,
        limit: PAGE_SIZE,
      })
      .then((d) => active && setData(d))
      .catch((error) => {
        notify.error(error, 'We couldn’t load promo codes.');
        if (active) setData({ promos: [], total: 0, counts: {} });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, notify]);
  useEffect(load, [load]);

  const remove = async () => {
    try {
      await adminPromos.remove(deleting.code);
      notify.success(`${deleting.code} deleted.`);
      setDeleting(null);
      load();
    } catch (error) {
      notify.error(error, 'We couldn’t delete the promo code.');
      setDeleting(null);
    }
  };
  const toggle = async (p) => {
    try {
      await adminPromos.update(p.code, { ...p, active: !p.active });
      notify.success(
        p.active ? `${p.code} switched off.` : `${p.code} switched on.`
      );
      load();
    } catch (error) {
      notify.error(error, 'We couldn’t update the promo code.');
    }
  };

  const counts = data?.counts || {};
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const cols = 8;

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Promo codes', to: '/admin/promos' },
        ]}
        title="Promo codes"
        subtitle="Discount codes customers enter at checkout, and how each one is used."
        actions={
          canManage && (
            <Button
              variant="contained"
              startIcon={<FiPlus />}
              onClick={() => setEditing({ ...EMPTY })}
            >
              New promo code
            </Button>
          )
        }
      />
      <TablePanel>
        <PanelTabs
          value={tab}
          onChange={(v) => set('tab', v === 'all' ? '' : v)}
          tabs={TABS.map((t) => ({
            ...t,
            count: data
              ? t.value === 'all'
                ? all
                : counts[t.value] || 0
              : undefined,
          }))}
        />
        <PanelToolbar>
          <SearchField
            value={get('search')}
            onChange={(v) => set('search', v)}
            placeholder="Search code or description"
          />
        </PanelToolbar>
        <TableContainer>
          <Table aria-label="Promo codes">
            <TableHead sx={{ bgcolor: 'background.neutral' }}>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Discount</TableCell>
                <TableCell>Valid</TableCell>
                <TableCell>Uses</TableCell>
                <TableCell align="right">Discount given</TableCell>
                <TableCell align="right">Sales</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {!data && <LoadingRows cols={cols} rows={PAGE_SIZE} />}
              {data?.promos.map((p) => {
                const [label, tone] = PROMO_STATES[p.state] || [
                  p.state,
                  'default',
                ];
                return (
                  <TableRow
                    key={p.code}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() =>
                      navigate(`/admin/promos/${encodeURIComponent(p.code)}`)
                    }
                    data-testid={`promo-row-${p.code}`}
                  >
                    <TableCell>
                      <Link
                        component={RouterLink}
                        to={`/admin/promos/${encodeURIComponent(p.code)}`}
                        underline="hover"
                        onClick={(e) => e.stopPropagation()}
                        sx={{
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          fontSize: '0.95rem',
                        }}
                      >
                        {p.code}
                      </Link>
                      {p.description && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="div"
                          noWrap
                          sx={{ maxWidth: 240 }}
                        >
                          {p.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {discountText(p, currency)}
                      </Typography>
                      {p.min_total > 0 && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="div"
                        >
                          Orders over {formatMoney(p.min_total, currency)}
                        </Typography>
                      )}
                      {rulesText(p, currency) && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="div"
                        >
                          {rulesText(p, currency)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {validText(p)}
                    </TableCell>
                    <TableCell>
                      <Usage promo={p} />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {formatMoney(p.discount_total, currency)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}
                    >
                      {formatMoney(p.sales_total, currency)}
                    </TableCell>
                    <TableCell>
                      <Pill label={label} tone={tone} />
                    </TableCell>
                    <TableCell
                      align="right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <RowActions
                        label={`Actions for ${p.code}`}
                        items={[
                          {
                            label: 'View uses',
                            onClick: () =>
                              navigate(
                                `/admin/promos/${encodeURIComponent(p.code)}`
                              ),
                          },
                          ...(canManage
                            ? [
                                {
                                  label: 'Edit',
                                  icon: <FiEdit2 />,
                                  onClick: () => setEditing(p),
                                },
                                {
                                  label: p.active ? 'Switch off' : 'Switch on',
                                  onClick: () => toggle(p),
                                },
                                ...(p.uses === 0
                                  ? [
                                      {
                                        label: 'Delete',
                                        icon: <FiTrash2 />,
                                        color: 'error',
                                        onClick: () => setDeleting(p),
                                      },
                                    ]
                                  : []),
                              ]
                            : []),
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {data && !data.promos.length && (
                <EmptyRow cols={cols}>No promo codes here.</EmptyRow>
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
            label="promo codes"
          />
        )}
      </TablePanel>
      <PromoDialog
        promo={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setEditing(null);
          if (!editing?.date_added)
            navigate(`/admin/promos/${encodeURIComponent(saved.code)}`);
          else load();
        }}
      />
      <ConfirmationDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.code || ''}?`}
        content="It hasn’t been used yet, so nothing else changes."
        confirmText="Delete code"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </Stack>
  );
};

const Stat = ({ icon, label, value, note, tone }) => {
  const theme = useTheme();
  const c = theme.palette[tone].main;
  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '8px',
            display: 'grid',
            placeItems: 'center',
            fontSize: 18,
            color: c,
            bgcolor: alpha(c, 0.12),
          }}
        >
          {icon}
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
      </Stack>
      <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', mt: 1.5 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {note}
      </Typography>
    </Box>
  );
};
Stat.propTypes = {
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  value: PropTypes.node,
  note: PropTypes.node,
  tone: PropTypes.string.isRequired,
};

export const PromoCodePage = () => {
  const { code } = useParams();
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const shop = useStore();
  const currency = shop.finance?.currency;
  const canManage = hasPermission(user, PERMISSIONS.promosManage);
  const canInvoices = hasPermission(user, PERMISSIONS.invoicesView);
  const [promo, setPromo] = useState(null);
  const [uses, setUses] = useState(null);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(null);

  const loadPromo = useCallback(
    () =>
      adminPromos
        .get(code)
        .then(setPromo)
        .catch((error) =>
          notify.error(error, 'We couldn’t load this promo code.')
        ),
    [code, notify]
  );
  useEffect(() => {
    loadPromo();
  }, [loadPromo]);
  useEffect(() => {
    setUses(null);
    adminPromos
      .uses(code, { page: page + 1, limit: PAGE_SIZE })
      .then(setUses)
      .catch(() => setUses({ uses: [], total: 0 }));
  }, [code, page]);

  const [label, tone] = promo
    ? PROMO_STATES[promo.state] || [promo.state, 'default']
    : [];
  const card = (v) => (promo ? v : '—');
  const cols = 7;

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Promo codes', to: '/admin/promos' },
          { label: code, to: `/admin/promos/${encodeURIComponent(code)}` },
        ]}
        title={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <span>{code.toUpperCase()}</span>
            {promo && <Pill label={label} tone={tone} />}
          </Stack>
        }
        subtitle={
          promo
            ? [
                discountText(promo, currency),
                promo.description,
                rulesText(promo, currency),
                validText(promo),
              ]
                .filter(Boolean)
                .join(' · ')
            : ' '
        }
        actions={
          canManage &&
          promo && (
            <Button
              variant="contained"
              startIcon={<FiEdit2 />}
              onClick={() => setEditing(promo)}
            >
              Edit code
            </Button>
          )
        }
      />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
        }}
      >
        <Stat
          icon={<FiShoppingBag />}
          label="Times used"
          tone="primary"
          value={card(promo?.uses)}
          note={
            promo?.uses_limit
              ? `of ${promo.uses_limit} allowed`
              : 'No limit on uses'
          }
        />
        <Stat
          icon={<FiUsers />}
          label="Customers"
          tone="info"
          value={card(promo?.customers)}
          note={
            promo?.per_customer_limit
              ? `Up to ${promo.per_customer_limit} each`
              : 'No limit per customer'
          }
        />
        <Stat
          icon={<FiTrendingDown />}
          label="Discount given"
          tone="warning"
          value={card(formatMoney(promo?.discount_total || 0, currency))}
          note="Taken off orders"
        />
        <Stat
          icon={<FiDollarSign />}
          label="Sales with this code"
          tone="success"
          value={card(formatMoney(promo?.sales_total || 0, currency))}
          note={
            promo?.last_used_at
              ? `Last used ${formatDate(promo.last_used_at)}`
              : 'Not used yet'
          }
        />
      </Box>

      <TablePanel>
        <Box sx={{ px: 2.5, py: 2 }}>
          <Typography variant="h6">Uses</Typography>
          <Typography variant="body2" color="text.secondary">
            Every order placed with this code. Cancelled orders aren’t counted.
          </Typography>
        </Box>
        <TableContainer>
          <Table aria-label="Uses">
            <TableHead sx={{ bgcolor: 'background.neutral' }}>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Invoice</TableCell>
                <TableCell align="right">Discount</TableCell>
                <TableCell align="right">Order total</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!uses && <LoadingRows cols={cols} rows={5} />}
              {uses?.uses.map((u) => {
                const [s, t] = ORDER_STATUS[u.order_status] || [
                  u.order_status,
                  'default',
                ];
                return (
                  <TableRow
                    key={u.order_id}
                    hover
                    data-testid={`promo-use-${u.order_number}`}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(u.date_added)}
                    </TableCell>
                    <TableCell>
                      {u.customer.customer_id ? (
                        <Link
                          component={RouterLink}
                          to={`/admin/users/${u.customer.customer_id}`}
                          underline="hover"
                          sx={{ fontWeight: 600 }}
                        >
                          {u.customer.name}
                        </Link>
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {u.customer.name}
                        </Typography>
                      )}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="div"
                      >
                        {u.customer.email}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Link
                        component={RouterLink}
                        to={`/admin/orders/${u.order_id}`}
                        underline="hover"
                      >
                        {u.order_number}
                      </Link>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {!u.invoice ? (
                        '—'
                      ) : canInvoices ? (
                        <Link
                          component={RouterLink}
                          to={`/admin/invoices/${u.invoice.invoice_id}`}
                          underline="hover"
                        >
                          {u.invoice.number}
                        </Link>
                      ) : (
                        u.invoice.number
                      )}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ whiteSpace: 'nowrap', color: 'error.main' }}
                    >
                      −{formatMoney(u.discount, u.currency)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}
                    >
                      {formatMoney(u.total, u.currency)}
                    </TableCell>
                    <TableCell>
                      <Pill label={s} tone={t} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {uses && !uses.uses.length && (
                <EmptyRow cols={cols}>Nobody has used this code yet.</EmptyRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {uses && uses.total > 0 && (
          <StandardPagination
            count={uses.total}
            page={page}
            rowsPerPage={PAGE_SIZE}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={() => {}}
            maxShowAll={0}
            label="uses"
          />
        )}
      </TablePanel>
      {promo?.created_by && (
        <SectionCard>
          <Typography variant="body2" color="text.secondary">
            Created {formatDateTime(promo.date_added)} by {promo.created_by}.
            Last changed {formatDateTime(promo.date_modified)}.
          </Typography>
        </SectionCard>
      )}
      <PromoDialog
        promo={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          loadPromo();
        }}
      />
    </Stack>
  );
};
