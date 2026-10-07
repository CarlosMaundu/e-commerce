// src/pages/admin/reports/SlaReportPage.js — fulfilment SLA performance: how
// many orders met, breached or are still within their targets, average time
// per stage, and every order in a filterable table. A row opens the order's
// stage-by-stage breakdown (SlaOrderPage).
import React, { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Link as RouterLink,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  Box,
  Button,
  Link,
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
import { alpha, useTheme } from '@mui/material/styles';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiSettings,
  FiXCircle,
} from 'react-icons/fi';
import { AuthContext } from '../../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../../auth/permissions';
import { adminReports } from '../../../api';
import { useNotify } from '../../../notification/NotificationProvider';
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
import {
  daysText,
  hoursText,
  slaState,
  targetText,
} from '../../../components/admin/Sla';
import { downloadCsv, formatShortDate } from '../../../utils/format';

const PERIODS = [
  { value: '', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
];
const TABS = [
  { value: '', label: 'All' },
  { value: 'met', label: 'Met' },
  { value: 'breached', label: 'Breached' },
  { value: 'pending', label: 'Pending' },
  { value: 'at_risk', label: 'At risk' },
];
const DELIVERY = {
  standard: 'Standard',
  express: 'Express',
  pickup: 'Pick up',
};

/** Summary card: icon, label, big number, a line of context. */
const StatCard = ({ icon, label, value, note, tone, onClick, active }) => {
  const theme = useTheme();
  const c = theme.palette[tone].main;
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      data-testid={`sla-stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
      sx={{
        p: 2.5,
        borderRadius: 1,
        border: 1,
        borderColor: active ? c : 'divider',
        bgcolor: active ? alpha(c, 0.05) : 'background.paper',
        cursor: 'pointer',
        transition: 'border-color .15s',
        '&:hover': { borderColor: alpha(c, 0.6) },
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
StatCard.propTypes = {
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  value: PropTypes.node,
  note: PropTypes.node,
  tone: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  active: PropTypes.bool,
};

const SlaReportPage = () => {
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || '';
  const set = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) =>
      v ? next.set(k, v) : next.delete(k)
    );
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };
  const page = Number(get('page') || 1) - 1;
  const [search, setSearch] = useState(get('search'));
  const [data, setData] = useState(null);
  const [exporting, setExporting] = useState(false);

  const filters = () => ({
    ...(get('days') ? { days: get('days') } : {}),
    ...(get('from') ? { date_from: get('from') } : {}),
    ...(get('to') ? { date_to: get('to') } : {}),
    ...(get('state') ? { state: get('state') } : {}),
    ...(get('delivery') ? { shipping_method: get('delivery') } : {}),
    ...(get('search') ? { search: get('search') } : {}),
  });

  useEffect(() => {
    let active = true;
    setData(null);
    adminReports
      .sla({ ...filters(), page: page + 1, limit: PAGE_SIZE })
      .then((d) => active && setData(d))
      .catch((e) => {
        notify.error(e, 'We couldn’t load the SLA report.');
        if (active) setData({ summary: null, orders: [], total: 0 });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, notify]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = [];
      for (let p = 1; ; p += 1) {
        // eslint-disable-next-line no-await-in-loop
        const d = await adminReports.sla({ ...filters(), page: p, limit: 100 });
        all.push(...d.orders);
        if (all.length >= d.total || !d.orders.length) break;
      }
      downloadCsv(
        'sla-report.csv',
        [
          'Order',
          'Customer',
          'Placed',
          'Delivery',
          'Status',
          'Days',
          'Target days',
          'SLA',
          'Breached stages',
        ],
        all.map((o) => [
          o.order_number,
          o.customer?.name || '',
          formatShortDate(o.placed_at),
          DELIVERY[o.shipping_method] || o.shipping_method,
          o.status_name,
          o.days,
          o.target_days,
          slaState(o.state)[0],
          o.breached_stages.join('; '),
        ])
      );
    } catch (e) {
      notify.error(e, 'We couldn’t export the report.');
    } finally {
      setExporting(false);
    }
  };

  const s = data?.summary;
  const state = get('state');
  const card = (value) => (s ? value : <Skeleton width={60} />);

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'SLA performance', to: '/admin/reports/sla' },
        ]}
        title="SLA performance"
        subtitle="How quickly orders move from placement to delivery, against your targets."
        actions={
          <Stack direction="row" spacing={1}>
            {hasPermission(user, PERMISSIONS.settingsManage) && (
              <Button
                variant="outlined"
                startIcon={<FiSettings />}
                component={RouterLink}
                to="/admin/settings?tab=sla"
                sx={{ bgcolor: 'background.paper' }}
              >
                SLA settings
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<FiDownload />}
              onClick={exportCsv}
              disabled={exporting || !data?.total}
              sx={{ bgcolor: 'background.paper' }}
            >
              {exporting ? 'Exporting…' : 'Export'}
            </Button>
          </Stack>
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
        <StatCard
          icon={<FiCheckCircle />}
          label="Met SLAs"
          tone="success"
          value={card(s?.met)}
          note={
            s?.met_rate !== null && s?.met_rate !== undefined
              ? `${s.met_rate}% of delivered orders`
              : 'No delivered orders yet'
          }
          active={state === 'met'}
          onClick={() => set({ state: state === 'met' ? '' : 'met' })}
        />
        <StatCard
          icon={<FiXCircle />}
          label="Breached SLAs"
          tone="error"
          value={card(s?.breached)}
          note="Over their target, delivered or not"
          active={state === 'breached'}
          onClick={() => set({ state: state === 'breached' ? '' : 'breached' })}
        />
        <StatCard
          icon={<FiClock />}
          label="Pending"
          tone="info"
          value={card(s?.pending)}
          note={s ? `${s.at_risk} at risk of breaching` : ''}
          active={state === 'pending'}
          onClick={() => set({ state: state === 'pending' ? '' : 'pending' })}
        />
        <StatCard
          icon={<FiAlertTriangle />}
          label="Average to deliver"
          tone="warning"
          value={card(daysText(s?.average_days ?? null))}
          note="Placement to delivery, delivered orders"
          active={false}
          onClick={() => set({ state: '' })}
        />
      </Box>

      {s?.stages && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          {s.stages.map((st) => {
            const over =
              st.average_hours !== null && st.average_hours > st.target_hours;
            return (
              <Box
                key={st.key}
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: 'background.neutral',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {st.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Average{' '}
                  <Box
                    component="strong"
                    sx={{ color: over ? 'error.main' : 'text.primary' }}
                  >
                    {hoursText(st.average_hours)}
                  </Box>{' '}
                  · target {targetText(st.target_hours)} · {st.breached}{' '}
                  breached
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      <TablePanel>
        <PanelTabs
          value={state}
          onChange={(v) => set({ state: v })}
          tabs={TABS.map((t) => ({
            value: t.value,
            label: t.label,
            count: s ? (t.value === '' ? s.total : s[t.value]) : undefined,
          }))}
        />
        <PanelToolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            onSubmit={(q) => set({ search: q })}
            placeholder="Search order number or customer"
            label="Search SLA report"
          />
          <Box sx={{ flex: 1 }} />
          <FilterMenu
            label="Delivery"
            value={get('delivery')}
            onChange={(v) => set({ delivery: v })}
            options={[
              { value: '', label: 'All' },
              ...Object.entries(DELIVERY).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
          <TextField
            select
            size="small"
            value={get('from') || get('to') ? 'custom' : get('days')}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'custom') {
                const d = new Date();
                const to = d.toISOString().slice(0, 10);
                d.setDate(d.getDate() - 29);
                set({ days: '', from: d.toISOString().slice(0, 10), to });
              } else set({ days: v, from: '', to: '' });
            }}
            SelectProps={{ displayEmpty: true }}
            inputProps={{ 'aria-label': 'Date range' }}
            sx={{ minWidth: 160 }}
          >
            {PERIODS.map((p) => (
              <MenuItem key={p.label} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
            <MenuItem value="custom">Custom range…</MenuItem>
          </TextField>
          {(get('from') || get('to')) && (
            <Stack direction="row" spacing={1}>
              <TextField
                type="date"
                size="small"
                label="From"
                value={get('from')}
                onChange={(e) => set({ from: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                type="date"
                size="small"
                label="To"
                value={get('to')}
                onChange={(e) => set({ to: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          )}
        </PanelToolbar>
        <TableContainer>
          <Table aria-label="SLA report">
            <TableHead sx={{ bgcolor: 'background.neutral' }}>
              <TableRow>
                <TableCell>Order</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Placed</TableCell>
                <TableCell>Delivery</TableCell>
                <TableCell>Stage</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>SLA</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!data ? (
                <LoadingRows cols={7} rows={PAGE_SIZE} />
              ) : data.orders.length ? (
                data.orders.map((o) => {
                  const [label, tone] = slaState(o.state);
                  return (
                    <TableRow
                      key={o.order_id}
                      hover
                      tabIndex={0}
                      sx={{ cursor: 'pointer' }}
                      data-testid={`sla-row-${o.order_id}`}
                      onClick={(e) => {
                        if (!e.target.closest('a'))
                          navigate(`/admin/reports/sla/${o.order_id}`);
                      }}
                      onKeyDown={(e) =>
                        e.key === 'Enter' &&
                        navigate(`/admin/reports/sla/${o.order_id}`)
                      }
                    >
                      <TableCell sx={{ fontWeight: 700 }}>
                        {o.order_number}
                      </TableCell>
                      <TableCell>
                        {o.customer ? (
                          <Link
                            component={RouterLink}
                            to={`/admin/users/${o.customer.customer_id}`}
                            underline="hover"
                          >
                            {o.customer.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {formatShortDate(o.placed_at)}
                      </TableCell>
                      <TableCell>
                        {DELIVERY[o.shipping_method] || o.shipping_method}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {o.done
                            ? 'Delivered'
                            : o.current_stage || o.status_name}
                        </Typography>
                        {o.breached_stages.length > 0 && (
                          <Typography variant="caption" color="error.main">
                            Late: {o.breached_stages.join(', ')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {daysText(o.days)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {o.done ? 'taken' : 'elapsed'} · target{' '}
                          {o.target_days}d
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Pill label={label} tone={tone} />
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <EmptyRow cols={7}>No orders match.</EmptyRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {data && data.total > 0 && (
          <StandardPagination
            count={data.total}
            page={page}
            rowsPerPage={PAGE_SIZE}
            onPageChange={(_, p) => set({ page: String(p + 1) })}
            onRowsPerPageChange={() => {}}
            maxShowAll={0}
            label="orders"
          />
        )}
      </TablePanel>
    </Stack>
  );
};

export default SlaReportPage;
