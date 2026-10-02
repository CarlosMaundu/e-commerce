// src/pages/admin/AdminDashboardPage.js — back office home, computed from
// real orders (GET /admin/dashboard). Layout inspired by Aurora's e-commerce
// dashboard; charts with chart.js.
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Grid,
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
import {
  FiAlertTriangle,
  FiDollarSign,
  FiShoppingCart,
  FiUserPlus,
} from 'react-icons/fi';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { AuthContext } from '../../context/AuthContext';
import { adminOrders } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { SectionCard, StatusChip } from '../../components/ui';
import { formatDate, formatMoney, percentChange } from '../../utils/format';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

const Change = ({ value }) => {
  const up = value >= 0;
  return (
    <Box
      component="span"
      sx={{
        px: 0.75,
        py: 0.25,
        borderRadius: 1,
        fontSize: '0.75rem',
        fontWeight: 600,
        bgcolor: up ? 'success.light' : 'warning.light',
        color: up ? 'success.main' : 'warning.main',
      }}
    >
      {up ? '+' : ''}
      {value}%
    </Box>
  );
};

const Metric = ({ icon, value, label }) => (
  <Stack direction="row" spacing={2} alignItems="center">
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'primary.light',
        color: 'primary.main',
      }}
    >
      {icon}
    </Box>
    <Typography variant="h3" component="p">
      {value}{' '}
      <Typography component="span" variant="subtitle1" color="text.secondary">
        {label}
      </Typography>
    </Typography>
  </Stack>
);

const AdminDashboardPage = () => {
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const theme = useTheme();
  const [data, setData] = useState(null);

  useEffect(() => {
    adminOrders
      .dashboard()
      .then(setData)
      .catch((error) => notify.error(error, 'We couldn’t load the dashboard.'));
  }, [notify]);

  const series = useMemo(() => data?.revenue_series || [], [data]);
  const revenueChart = useMemo(
    () => ({
      labels: series.map((d) => formatDate(d.date, { year: undefined })),
      datasets: [
        {
          label: 'This period',
          data: series.map((d) => d.revenue),
          borderColor: theme.palette.primary.main,
          backgroundColor: alpha(theme.palette.primary.main, 0.08),
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
        {
          label: 'Previous 30 days',
          data: series.map((d) => d.previous),
          borderColor: theme.palette.text.disabled,
          borderDash: [4, 4],
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 1.5,
        },
      ],
    }),
    [series, theme]
  );

  const chartOptions = {
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: { boxWidth: 10, usePointStyle: true },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 8, color: theme.palette.text.secondary },
      },
      y: {
        grid: { color: theme.palette.divider },
        ticks: {
          callback: (v) => formatMoney(v),
          color: theme.palette.text.secondary,
        },
      },
    },
  };

  const spark = {
    labels: series.map((d) => d.date),
    datasets: [
      {
        data: series.map((d) => d.revenue),
        borderColor: theme.palette.primary.main,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };
  const sparkOptions = {
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false } },
  };

  const monthChange = data
    ? percentChange(data.month.revenue, data.last_month_to_date.revenue)
    : 0;

  return (
    <Stack spacing={3}>
      <Grid container spacing={3}>
        <Grid item xs={12} lg={4}>
          <SectionCard tinted sx={{ height: '100%' }}>
            <Typography variant="body2" color="text.secondary">
              {new Intl.DateTimeFormat('en-US', {
                weekday: 'long',
                month: 'short',
                day: '2-digit',
                year: 'numeric',
              }).format(new Date())}
            </Typography>
            <Typography variant="h4" component="h1" sx={{ mt: 0.5, mb: 3 }}>
              {greeting()}, {user?.name?.split(' ')[0]}!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Updates from yesterday
            </Typography>
            {data ? (
              <Stack spacing={2}>
                <Metric
                  icon={<FiDollarSign />}
                  value={formatMoney(data.yesterday.revenue)}
                  label="Revenue"
                />
                <Metric
                  icon={<FiShoppingCart />}
                  value={data.yesterday.orders}
                  label="Orders"
                />
                <Metric
                  icon={<FiUserPlus />}
                  value={data.yesterday.new_customers}
                  label="New customers"
                />
              </Stack>
            ) : (
              <Skeleton variant="rounded" height={150} />
            )}
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 4, mb: 1.5 }}
            >
              {data
                ? `You have ${data.today.orders} order${data.today.orders === 1 ? '' : 's'} today.`
                : ' '}
            </Typography>
            <Stack spacing={1}>
              {(data?.recent_orders || []).map((o) => (
                <Stack
                  key={o.order_id}
                  component={RouterLink}
                  to={`/admin/orders/${o.order_id}`}
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    p: 1.5,
                    textDecoration: 'none',
                    color: 'text.primary',
                    '&:hover': { outline: 1, outlineColor: 'divider' },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap>
                      #{o.order_id} · {o.customer?.name || o.email}
                    </Typography>
                    <Typography variant="caption">
                      {formatMoney(o.total)} · {o.item_count} item
                      {o.item_count === 1 ? '' : 's'}
                    </Typography>
                  </Box>
                  <StatusChip status={o.status} label={o.status_name} />
                </Stack>
              ))}
            </Stack>
            <Button component={RouterLink} to="/admin/orders" sx={{ mt: 1.5 }}>
              All orders ›
            </Button>
          </SectionCard>
        </Grid>
        <Grid item xs={12} lg={8}>
          <Stack spacing={3} sx={{ height: '100%' }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <SectionCard
                  title="Monthly earnings"
                  subtitle="Revenue this month"
                  sx={{ height: '100%' }}
                >
                  {data ? (
                    <Stack direction="row" alignItems="flex-end" spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h2" component="p">
                          {formatMoney(data.month.revenue)}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 1 }}
                        >
                          <Change value={monthChange} /> vs last month so far
                        </Typography>
                      </Box>
                      <Box sx={{ width: 140, height: 70 }}>
                        <Line data={spark} options={sparkOptions} />
                      </Box>
                    </Stack>
                  ) : (
                    <Skeleton height={80} />
                  )}
                </SectionCard>
              </Grid>
              <Grid item xs={12} md={6}>
                <SectionCard
                  title="Needs attention"
                  subtitle="Right now"
                  sx={{ height: '100%' }}
                >
                  {data ? (
                    <Stack spacing={1.25}>
                      {[
                        [
                          'Orders to fulfil',
                          data.counts.to_fulfil,
                          '/admin/orders?status=pending,processing',
                        ],
                        [
                          'Return requests',
                          data.counts.open_returns,
                          '/admin/returns',
                        ],
                        [
                          'Products low on stock',
                          data.counts.low_stock,
                          '/admin/products',
                        ],
                      ].map(([label, n, to]) => (
                        <Stack
                          key={label}
                          component={RouterLink}
                          to={to}
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={{
                            textDecoration: 'none',
                            color: 'text.primary',
                            p: 1,
                            borderRadius: 1,
                            '&:hover': { bgcolor: 'background.neutral' },
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            {n > 0 && (
                              <FiAlertTriangle
                                color={theme.palette.warning.main}
                              />
                            )}
                            <Typography>{label}</Typography>
                          </Stack>
                          <Typography variant="h6">{n}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  ) : (
                    <Skeleton height={100} />
                  )}
                </SectionCard>
              </Grid>
            </Grid>
            <SectionCard
              title="Revenue"
              subtitle="Last 30 days compared with the 30 days before"
              sx={{ flex: 1 }}
            >
              <Box sx={{ height: 300 }}>
                {data ? (
                  <Line data={revenueChart} options={chartOptions} />
                ) : (
                  <Skeleton variant="rounded" height={300} />
                )}
              </Box>
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>

      <SectionCard
        title="Top products"
        subtitle="Best sellers across all orders"
      >
        <TableContainer>
          <Table aria-label="Top products">
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell align="right">Sold</TableCell>
                <TableCell align="right">Revenue</TableCell>
                <TableCell align="right">Stock</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.top_products || []).map((p) => (
                <TableRow key={p.product_id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        component="img"
                        src={p.image}
                        alt=""
                        sx={{
                          width: 36,
                          height: 36,
                          objectFit: 'contain',
                          borderRadius: 1,
                          bgcolor: 'background.neutral',
                        }}
                      />
                      <Typography variant="body2" fontWeight={600}>
                        {p.name}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{p.sold}</TableCell>
                  <TableCell align="right">{formatMoney(p.revenue)}</TableCell>
                  <TableCell align="right">
                    <StatusChip
                      status={
                        p.stock > 5
                          ? 'delivered'
                          : p.stock > 0
                            ? 'pending'
                            : 'failed'
                      }
                      label={
                        p.stock > 5
                          ? 'In stock'
                          : p.stock > 0
                            ? `Low (${p.stock})`
                            : 'Out of stock'
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
              {data && !data.top_products.length && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    align="center"
                    sx={{ py: 4, color: 'text.secondary' }}
                  >
                    No sales yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>
    </Stack>
  );
};

export default AdminDashboardPage;
