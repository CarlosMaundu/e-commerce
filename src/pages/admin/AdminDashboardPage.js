// src/pages/admin/AdminDashboardPage.js — "Store overview": KPIs, sales
// performance against the previous period, top categories, fulfilment,
// average order value, inventory health, customer locations, top products
// and recent orders. Everything comes from GET /admin/dashboard?days=.
import React, { useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Link,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { FiChevronDown, FiDownload, FiPlus } from 'react-icons/fi';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { AuthContext } from '../../context/AuthContext';
import { hasPermission } from '../../auth/permissions';
import { adminOrders } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import {
  LoadingRows,
  PAGE_SIZE,
  Pill,
  StandardPagination,
} from '../../components/admin/DataTable';
import KenyaMap from '../../components/admin/KenyaMap';
import { formatMoney, formatMoneyCompact } from '../../utils/format';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
);

const PERIODS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '6 months' },
  { value: 365, label: '12 months' },
];

// ---------- building blocks ----------

const Card = ({ children, sx, ...rest }) => (
  <Box
    sx={{
      bgcolor: 'background.paper',
      border: 1,
      borderColor: 'divider',
      borderRadius: 1,
      p: { xs: 2.5, md: 3 },
      minWidth: 0,
      ...sx,
    }}
    {...rest}
  >
    {children}
  </Box>
);
Card.propTypes = { children: PropTypes.node, sx: PropTypes.object };

const CardTitle = ({ title, subtitle, action }) => (
  <Stack
    direction="row"
    alignItems="flex-start"
    justifyContent="space-between"
    spacing={2}
    sx={{ mb: 2.5 }}
  >
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
    {action}
  </Stack>
);
CardTitle.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  action: PropTypes.node,
};

/** "+12.4%" chip; tone is the card's colour, the sign tells the direction. */
const ChangeChip = ({ value, tone = 'primary', suffix = '%' }) => {
  const theme = useTheme();
  const color =
    tone === 'highlight'
      ? theme.palette.highlight.contrastText
      : theme.palette[tone].main;
  const bg =
    tone === 'highlight'
      ? theme.palette.highlight.light
      : alpha(theme.palette[tone].main, 0.12);
  return (
    <Box
      component="span"
      sx={{
        px: 1,
        py: 0.5,
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 700,
        color,
        bgcolor: bg,
        whiteSpace: 'nowrap',
      }}
    >
      {value >= 0 ? '+' : ''}
      {Number(value.toFixed(1))}
      {suffix}
    </Box>
  );
};
ChangeChip.propTypes = {
  value: PropTypes.number.isRequired,
  tone: PropTypes.string,
  suffix: PropTypes.string,
};

const Kpi = ({ label, value, caption, change, tone, testId, suffix }) => (
  <Card data-testid={testId}>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
      <ChangeChip value={change} tone={tone} suffix={suffix} />
    </Stack>
    <Typography
      sx={{
        mt: 2,
        mb: 1,
        fontWeight: 800,
        fontSize: { xs: '1.4rem', md: '1.6rem' },
        letterSpacing: '-0.03em',
        lineHeight: 1.1,
      }}
    >
      {value}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {caption}
    </Typography>
  </Card>
);
Kpi.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  caption: PropTypes.node,
  change: PropTypes.number.isRequired,
  tone: PropTypes.string,
  testId: PropTypes.string,
  suffix: PropTypes.string,
};

/** Grey pill group with one white, raised choice (Revenue/Orders, tabs). */
const Segmented = ({ value, onChange, options, label }) => (
  <Box
    role="tablist"
    aria-label={label}
    sx={{
      display: 'inline-flex',
      p: 0.5,
      gap: 0.5,
      borderRadius: '8px',
      bgcolor: 'background.neutral',
      flexWrap: 'wrap',
    }}
  >
    {options.map((o) => {
      const on = o.value === value;
      return (
        <Box
          key={o.value}
          component="button"
          type="button"
          role="tab"
          aria-selected={on}
          onClick={() => onChange(o.value)}
          sx={{
            border: 0,
            cursor: 'pointer',
            font: 'inherit',
            fontSize: '0.85rem',
            fontWeight: 600,
            px: 1.75,
            height: 36,
            borderRadius: '6px',
            color: on ? 'primary.main' : 'text.secondary',
            bgcolor: on ? 'background.paper' : 'transparent',
            boxShadow: on ? '0 1px 3px rgba(27,33,36,0.12)' : 'none',
          }}
        >
          {o.label}
        </Box>
      );
    })}
  </Box>
);
Segmented.propTypes = {
  value: PropTypes.any,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.array.isRequired,
  label: PropTypes.string.isRequired,
};

const Meter = ({ value, color, height = 8 }) => (
  <Box
    sx={{
      height,
      borderRadius: 999,
      bgcolor: 'background.neutralDeep',
      overflow: 'hidden',
    }}
  >
    <Box
      sx={{
        width: `${Math.max(0, Math.min(100, value))}%`,
        height: '100%',
        borderRadius: 999,
        bgcolor: color,
        transition: 'width .4s',
      }}
    />
  </Box>
);
Meter.propTypes = {
  value: PropTypes.number.isRequired,
  color: PropTypes.string.isRequired,
  height: PropTypes.number,
};

// ---------- sections ----------

const shortDate = (iso, withMonth) =>
  new Intl.DateTimeFormat('en-US', {
    ...(withMonth ? { month: 'short' } : {}),
    day: 'numeric',
  }).format(new Date(`${iso}T00:00:00`));

/** Chart label for a bucket: "Mar 4"/"5" for days and weeks, "Oct" for months. */
const bucketLabel = (iso, i, unit) =>
  unit === 'month'
    ? new Intl.DateTimeFormat('en-US', { month: 'short' }).format(
        new Date(`${iso}T00:00:00`)
      )
    : shortDate(iso, unit === 'week' || i === 0 || iso.endsWith('-01'));

const THIS_YEAR = new Date().getFullYear();

const SalesPerformance = ({ data }) => {
  const theme = useTheme();
  const [metric, setMetric] = useState('revenue');
  const revenue = metric === 'revenue';
  const series = data.series;
  const total = revenue ? data.kpis.revenue.value : data.kpis.orders.value;
  // Compared with the same dates last year, like the chart.
  const change = revenue
    ? data.last_year.revenue_change
    : data.last_year.orders_change;
  const thisLabel = `This year (${THIS_YEAR})`;
  const lastLabel = `Last year (${THIS_YEAR - 1})`;
  const main = theme.palette.primary.main;

  const chart = useMemo(
    () => ({
      labels: series.map((d, i) => bucketLabel(d.date, i, data.series_unit)),
      datasets: [
        {
          label: thisLabel,
          data: series.map((d) => (revenue ? d.revenue : d.orders)),
          borderColor: main,
          borderWidth: 3,
          tension: 0.45,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBorderWidth: 3,
          pointHoverBackgroundColor: '#fff',
          fill: true,
          backgroundColor: (ctx) => {
            const { chartArea, ctx: c } = ctx.chart;
            if (!chartArea) return alpha(main, 0.15);
            const g = c.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom
            );
            g.addColorStop(0, alpha(main, 0.22));
            g.addColorStop(1, alpha(main, 0));
            return g;
          },
        },
        {
          label: lastLabel,
          data: series.map((d) =>
            revenue ? d.last_year_revenue : d.last_year_orders
          ),
          borderColor: theme.palette.text.disabled,
          borderDash: [6, 6],
          borderWidth: 2,
          tension: 0.45,
          pointRadius: 0,
          fill: false,
        },
      ],
    }),
    [series, revenue, main, theme, thisLabel, lastLabel, data.series_unit]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) =>
              `${c.dataset.label}: ${
                revenue ? formatMoney(c.parsed.y) : c.parsed.y
              }`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: theme.palette.text.secondary,
            maxTicksLimit: 8,
            maxRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: theme.palette.divider },
          ticks: {
            color: theme.palette.text.secondary,
            maxTicksLimit: 5,
            precision: 0,
            callback: (v) =>
              revenue
                ? new Intl.NumberFormat('en-US', {
                    notation: 'compact',
                  }).format(v)
                : v,
          },
        },
      },
    }),
    [revenue, theme]
  );

  return (
    <Card sx={{ height: '100%' }}>
      <CardTitle
        title="Sales performance"
        subtitle={`${{ day: 'Daily', week: 'Weekly', month: 'Monthly' }[data.series_unit] || 'Daily'} performance, compared with the same dates last year`}
        action={
          <Segmented
            label="Chart"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'revenue', label: 'Revenue' },
              { value: 'orders', label: 'Orders' },
            ]}
          />
        }
      />
      <Stack
        direction="row"
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Typography
          sx={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.03em' }}
        >
          {revenue ? formatMoneyCompact(total) : total.toLocaleString()}
        </Typography>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: '0.85rem',
            color: change >= 0 ? 'success.main' : 'error.main',
          }}
        >
          {change >= 0 ? '+' : ''}
          {Number(change.toFixed(1))}%
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={2.5} aria-hidden>
          {[
            [thisLabel, main, 'solid'],
            [lastLabel, theme.palette.text.disabled, 'dashed'],
          ].map(([l, c, style]) => (
            <Stack key={l} direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 22, borderTop: `3px ${style} ${c}` }} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {l}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>
      <Box sx={{ height: { xs: 240, md: 300 } }}>
        <Line data={chart} options={options} />
      </Box>
    </Card>
  );
};
SalesPerformance.propTypes = { data: PropTypes.object.isRequired };

const useCategoryColors = () => {
  const theme = useTheme();
  return [
    theme.palette.primary.main,
    theme.palette.warning.main,
    theme.palette.highlight.main,
    theme.palette.success.main,
    '#9B87F5',
  ];
};

const TopCategories = ({ data }) => {
  const colors = useCategoryColors();
  const rows = data.categories.slice(0, 5);
  return (
    <Card sx={{ height: '100%' }}>
      <CardTitle
        title="Top product categories"
        subtitle={`Share of net sales in ${data.days} days`}
      />
      {rows.length ? (
        <Stack spacing={2.75}>
          {rows.map((c, i) => (
            <Box key={c.name}>
              <Stack
                direction="row"
                alignItems="baseline"
                spacing={2}
                sx={{ mb: 1 }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                  {c.name}
                </Typography>
                <Typography variant="caption">
                  {formatMoneyCompact(c.sales)}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 700, minWidth: 40, textAlign: 'right' }}
                >
                  {c.share}%
                </Typography>
              </Stack>
              <Meter value={c.share} color={colors[i % colors.length]} />
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography color="text.secondary">No sales in this period.</Typography>
      )}
    </Card>
  );
};
TopCategories.propTypes = { data: PropTypes.object.isRequired };

const Fulfilment = ({ data }) => {
  const theme = useTheme();
  const f = data.fulfilment;
  const parts = [
    ['Packing', f.packing, theme.palette.primary.main],
    ['In transit', f.in_transit, theme.palette.highlight.main],
    ['Delayed', f.delayed, theme.palette.warning.main],
  ];
  return (
    <Card sx={{ height: '100%' }} data-testid="overview-fulfilment">
      <CardTitle
        title="Order fulfillment"
        subtitle="Current order pipeline"
        action={
          <Typography sx={{ fontWeight: 800, fontSize: '1.35rem' }}>
            {f.total}
          </Typography>
        }
      />
      <Box
        sx={{
          display: 'flex',
          height: 8,
          borderRadius: 999,
          overflow: 'hidden',
          bgcolor: 'background.neutralDeep',
          mb: 2.5,
        }}
      >
        {parts.map(([l, n, c]) =>
          n ? (
            <Box
              key={l}
              sx={{ width: `${(n / f.total) * 100}%`, bgcolor: c }}
            />
          ) : null
        )}
      </Box>
      <Stack direction="row" spacing={2}>
        {parts.map(([l, n]) => (
          <Box key={l} sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
              {n}
            </Typography>
            <Typography variant="caption">{l}</Typography>
          </Box>
        ))}
      </Stack>
    </Card>
  );
};
Fulfilment.propTypes = { data: PropTypes.object.isRequired };

const AverageOrder = ({ data }) => {
  const theme = useTheme();
  // Daily average order value, grouped into at most 12 bars.
  const bars = useMemo(() => {
    const s = data.series;
    const size = Math.max(1, Math.ceil(s.length / 12));
    const out = [];
    for (let i = 0; i < s.length; i += size) {
      const chunk = s.slice(i, i + size);
      const rev = chunk.reduce((a, d) => a + d.revenue, 0);
      const n = chunk.reduce((a, d) => a + d.orders, 0);
      out.push(n ? rev / n : 0);
    }
    return out;
  }, [data.series]);
  const max = Math.max(1, ...bars);
  const k = data.kpis.average_order;
  return (
    <Card sx={{ height: '100%' }}>
      <CardTitle
        title="Average order value"
        subtitle="Revenue per order"
        action={<ChangeChip value={k.change} tone="success" />}
      />
      <Typography
        sx={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.03em' }}
      >
        {formatMoney(k.value)}
      </Typography>
      <Stack
        direction="row"
        alignItems="flex-end"
        spacing={0.75}
        sx={{ height: 52, mt: 2 }}
        aria-hidden
      >
        {bars.map((v, i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: `${Math.max(12, (v / max) * 100)}%`,
              borderRadius: '4px',
              bgcolor: alpha(theme.palette.primary.main, 0.16),
            }}
          />
        ))}
      </Stack>
    </Card>
  );
};
AverageOrder.propTypes = { data: PropTypes.object.isRequired };

const Inventory = ({ data }) => {
  const theme = useTheme();
  const inv = data.inventory;
  const rows = [
    ['Healthy stock', inv.healthy, theme.palette.success.main],
    ['Low stock', inv.low, theme.palette.highlight.main],
    ['Out of stock', inv.out, theme.palette.warning.main],
  ];
  return (
    <Card sx={{ height: '100%' }}>
      <CardTitle
        title="Inventory health"
        subtitle={`Across ${inv.total.toLocaleString()} products`}
        action={
          <Typography
            sx={{ fontWeight: 800, fontSize: '1.35rem', color: 'success.main' }}
          >
            {inv.healthy_share}%
          </Typography>
        }
      />
      <Stack spacing={1.5}>
        {rows.map(([l, n, c]) => (
          <Box key={l}>
            <Stack
              direction="row"
              justifyContent="space-between"
              sx={{ mb: 0.5 }}
            >
              <Typography variant="caption">{l}</Typography>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: 'text.primary' }}
              >
                {n.toLocaleString()}
              </Typography>
            </Stack>
            <Meter
              value={inv.total ? (n / inv.total) * 100 : 0}
              color={c}
              height={6}
            />
          </Box>
        ))}
      </Stack>
    </Card>
  );
};
Inventory.propTypes = { data: PropTypes.object.isRequired };

const Locations = ({ data }) => {
  const total = data.locations.reduce((s, l) => s + l.orders, 0);
  const top = data.locations.slice(0, 4);
  const other = data.locations.slice(4).reduce((s, l) => s + l.orders, 0);
  const rows = [...top, ...(other ? [{ city: 'Other', orders: other }] : [])];
  return (
    <Card sx={{ height: '100%' }}>
      <CardTitle
        title="Customer locations"
        subtitle={`Orders by town in ${data.days} days`}
      />
      {rows.length ? (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={3}
          alignItems="center"
        >
          <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
            <KenyaMap places={top} />
          </Box>
          <Stack
            spacing={2}
            sx={{ width: { xs: '100%', sm: 150 }, flexShrink: 0 }}
          >
            {rows.map((l) => (
              <Box key={l.city}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {l.city}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {Math.round((l.orders / total) * 100)}%
                  </Typography>
                </Stack>
                <Typography variant="caption">
                  {l.orders.toLocaleString()} order{l.orders === 1 ? '' : 's'}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
      ) : (
        <Typography color="text.secondary">
          No deliveries in this period.
        </Typography>
      )}
    </Card>
  );
};
Locations.propTypes = { data: PropTypes.object.isRequired };

const headSx = {
  bgcolor: 'background.neutral',
  '& th': {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'text.secondary',
    borderBottom: 0,
    py: 1.75,
  },
};

const selectSx = {
  height: 44,
  minWidth: 140,
  fontSize: '0.85rem',
  fontWeight: 600,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
};

const TopProducts = ({ data }) => {
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('sales');
  const cats = data.categories.filter((c) => c.category_id);
  const rows = data.top_products
    .filter((p) => !category || p.category_id === category)
    .sort((a, b) => b[sort] - a[sort])
    .slice(0, 5);
  return (
    <Card sx={{ height: '100%', p: 0 }}>
      <Box sx={{ p: { xs: 2.5, md: 3 }, pb: { xs: 1, md: 1 } }}>
        <CardTitle
          title="Top products"
          subtitle="Best performers by sales and units sold"
          action={
            <Stack direction="row" spacing={1}>
              <Select
                size="small"
                value={category}
                displayEmpty
                onChange={(e) => setCategory(e.target.value)}
                IconComponent={FiChevronDown}
                inputProps={{ 'aria-label': 'Category' }}
                sx={selectSx}
              >
                <MenuItem value="">All categories</MenuItem>
                {cats.map((c) => (
                  <MenuItem key={c.category_id} value={c.category_id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
              <Select
                size="small"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                IconComponent={FiChevronDown}
                inputProps={{ 'aria-label': 'Rank by' }}
                sx={{ ...selectSx, minWidth: 110 }}
              >
                <MenuItem value="sales">Sales</MenuItem>
                <MenuItem value="units">Units</MenuItem>
              </Select>
            </Stack>
          }
        />
      </Box>
      <TableContainer>
        <Table>
          <TableHead sx={headSx}>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell>Category</TableCell>
              <TableCell align="right">Items sold</TableCell>
              <TableCell align="right">Net sales</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((p, i) => (
              <TableRow key={`${p.product_id}-${p.name}`} hover>
                <TableCell>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '8px',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        color: 'primary.main',
                        bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                      }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      {p.product_id ? (
                        <Link
                          component={RouterLink}
                          to={`/admin/products/${p.product_id}`}
                          underline="hover"
                          color="text.primary"
                          sx={{ fontWeight: 700, fontSize: '0.9rem' }}
                        >
                          {p.name}
                        </Link>
                      ) : (
                        <Typography
                          sx={{ fontWeight: 700, fontSize: '0.9rem' }}
                        >
                          {p.name}
                        </Typography>
                      )}
                      <Typography variant="caption" component="div">
                        {p.sku}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>
                  {p.category}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {p.units.toLocaleString()}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {formatMoneyCompact(p.sales)}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={4} sx={{ color: 'text.secondary' }}>
                  No sales in this period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
};
TopProducts.propTypes = { data: PropTypes.object.isRequired };

/** One label per order for the recent-orders table. */
export const orderState = (o) => {
  if (o.status === 'refunded') return ['Refunded', 'error'];
  if (o.status === 'cancelled') return ['Cancelled', 'default'];
  if (o.status === 'processing') return ['Processing', 'info'];
  if (o.status === 'shipped') return ['Shipped', 'info'];
  if (o.status === 'delivered') return ['Delivered', 'success'];
  if (o.paymentStatus === 'paid') return ['Paid', 'success'];
  return ['Pending', 'warning'];
};

// Each tab is an order-list filter, so paging covers every order.
const RECENT_TABS = [
  { value: 'all', label: 'All', filter: {} },
  { value: 'paid', label: 'Paid', filter: { paymentStatus: 'paid' } },
  {
    value: 'processing',
    label: 'Processing',
    filter: { status: 'processing' },
  },
  {
    value: 'pending',
    label: 'Pending',
    filter: { status: 'pending,awaiting_payment' },
  },
  { value: 'refunded', label: 'Refunded', filter: { status: 'refunded' } },
];

const when = (iso) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - day) / 86400000);
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })}, ${time}`;
};

const RecentOrders = () => {
  const notify = useNotify();
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    setResult(null);
    adminOrders
      .list({
        page: page + 1,
        limit: PAGE_SIZE,
        ...RECENT_TABS.find((t) => t.value === tab).filter,
      })
      .then((r) => active && setResult(r))
      .catch((e) => {
        if (active) setResult({ orders: [], total: 0 });
        notify.error(e, 'We couldn’t load recent orders.');
      });
    return () => {
      active = false;
    };
  }, [tab, page, notify]);

  return (
    <Card sx={{ p: 0, overflow: 'hidden' }} data-testid="recent-orders">
      <Box sx={{ p: { xs: 2.5, md: 3 }, pb: { xs: 1, md: 1 } }}>
        <CardTitle
          title="Recent orders"
          subtitle="Track payment and fulfillment status"
          action={
            <Segmented
              label="Order status"
              value={tab}
              onChange={(v) => {
                setTab(v);
                setPage(0);
              }}
              options={RECENT_TABS}
            />
          }
        />
      </Box>
      <TableContainer>
        <Table>
          <TableHead sx={headSx}>
            <TableRow>
              <TableCell>Order</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Product</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!result ? (
              <LoadingRows cols={6} rows={PAGE_SIZE} />
            ) : (
              result.orders.map((o) => {
                const [label, tone] = orderState(o);
                const first = o.preview[0]?.name || '';
                const more = Math.max(0, o.preview.length - 1);
                return (
                  <TableRow
                    key={o.id}
                    hover
                    data-testid={`recent-order-${o.id}`}
                  >
                    <TableCell>
                      <Link
                        component={RouterLink}
                        to={`/admin/orders/${o.id}`}
                        underline="hover"
                        sx={{ fontWeight: 700 }}
                      >
                        {o.number}
                      </Link>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {o.customer?.name || o.email}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {first}
                      {more ? ` +${more} more` : ''}
                    </TableCell>
                    <TableCell
                      sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}
                    >
                      {when(o.placedAt)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {formatMoney(o.total)}
                    </TableCell>
                    <TableCell>
                      <Pill label={label} tone={tone} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
            {result && !result.orders.length && (
              <TableRow>
                <TableCell colSpan={6} sx={{ color: 'text.secondary' }}>
                  No orders here yet.
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
          label="orders"
        />
      )}
    </Card>
  );
};

const OverviewSkeleton = () => (
  <Stack spacing={3} data-testid="overview-loading" sx={{ mt: 4 }}>
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: {
          xs: '1fr',
          sm: '1fr 1fr',
          lg: 'repeat(4, minmax(0, 1fr))',
        },
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} variant="rounded" height={170} />
      ))}
    </Box>
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { xs: '1fr', lg: '2.2fr 1fr' },
      }}
    >
      <Skeleton variant="rounded" height={440} />
      <Skeleton variant="rounded" height={440} />
    </Box>
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
      }}
    >
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} variant="rounded" height={230} />
      ))}
    </Box>
  </Stack>
);

// ---------- page ----------

const csvOf = (data) => {
  const lines = [
    [
      'Period starting',
      'Revenue',
      'Orders',
      'Revenue last year',
      'Orders last year',
    ],
    ...data.series.map((d) => [
      d.date,
      d.revenue,
      d.orders,
      d.last_year_revenue,
      d.last_year_orders,
    ]),
  ];
  return lines.map((l) => l.join(',')).join('\n');
};

const AdminDashboardPage = () => {
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    setData(null);
    adminOrders
      .dashboard(days)
      .then((d) => active && setData(d))
      .catch((e) => notify.error(e, 'We couldn’t load the store overview.'));
    return () => {
      active = false;
    };
  }, [days, notify]);

  const exportReport = () => {
    const blob = new Blob([csvOf(data)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `store-overview-${days}-days.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const k = data?.kpis;
  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'flex-end' }}
        spacing={2}
      >
        <Box sx={{ flex: 1 }}>
          <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1.5rem', md: '1.625rem' },
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
              my: 0.5,
            }}
          >
            Store overview
          </Typography>
          <Typography color="text.secondary">
            Monitor performance, customers and fulfilment from one place.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            IconComponent={FiChevronDown}
            inputProps={{ 'aria-label': 'Period' }}
            renderValue={(v) => (
              <>
                <Box
                  component="span"
                  sx={{ color: 'text.secondary', mr: 1.5, fontWeight: 500 }}
                >
                  Period
                </Box>
                {PERIODS.find((p) => p.value === v)?.label}
              </>
            )}
            sx={{
              ...selectSx,
              height: 48,
              bgcolor: 'background.paper',
              minWidth: 170,
            }}
          >
            {PERIODS.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </Select>
          <Button
            variant="outlined"
            onClick={exportReport}
            disabled={!data}
            startIcon={<FiDownload />}
            sx={{
              height: 48,
              bgcolor: 'background.paper',
              color: 'text.primary',
              borderColor: 'divider',
              fontWeight: 700,
            }}
          >
            Export report
          </Button>
          {hasPermission(user, 'catalog.products.create') && (
            <Button
              variant="contained"
              component={RouterLink}
              to="/admin/products/new"
              startIcon={<FiPlus />}
              sx={{ height: 48, fontWeight: 700 }}
            >
              Add product
            </Button>
          )}
        </Stack>
      </Stack>

      {!data ? (
        <OverviewSkeleton />
      ) : (
        <Stack spacing={3} sx={{ mt: 4 }}>
          <Box
            sx={{
              display: 'grid',
              gap: { xs: 2, md: 2.5 },
              gridTemplateColumns: {
                xs: '1fr',
                sm: '1fr 1fr',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
            }}
          >
            <Kpi
              testId="kpi-revenue"
              label="Net revenue"
              value={formatMoneyCompact(k.revenue.value)}
              caption="After refunds and cancellations"
              change={k.revenue.change}
              tone="primary"
            />
            <Kpi
              testId="kpi-orders"
              label="Total orders"
              value={k.orders.value.toLocaleString()}
              caption={`${k.orders.awaiting} awaiting fulfillment`}
              change={k.orders.change}
              tone="warning"
            />
            <Kpi
              testId="kpi-customers"
              label="New customers"
              value={k.new_customers.value.toLocaleString()}
              caption={`${k.new_customers.first_time_share}% of buyers were first-timers`}
              change={k.new_customers.change}
              tone="success"
            />
            <Kpi
              testId="kpi-conversion"
              label="Conversion rate"
              value={`${k.conversion.value}%`}
              caption={`Orders per product view, from ${new Intl.NumberFormat('en-US', { notation: 'compact' }).format(k.conversion.views)} views`}
              change={k.conversion.change}
              suffix=" pts"
              tone="highlight"
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: {
                xs: '1fr',
                lg: 'minmax(0, 2.2fr) minmax(0, 1fr)',
              },
            }}
          >
            <SalesPerformance data={data} />
            <TopCategories data={data} />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            <Fulfilment data={data} />
            <AverageOrder data={data} />
            <Inventory data={data} />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: {
                xs: '1fr',
                lg: 'minmax(0, 1fr) minmax(0, 1.3fr)',
              },
            }}
          >
            <Locations data={data} />
            <TopProducts data={data} />
          </Box>

          <RecentOrders />
        </Stack>
      )}
    </Box>
  );
};

export default AdminDashboardPage;
