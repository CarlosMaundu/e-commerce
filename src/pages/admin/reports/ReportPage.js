// src/pages/admin/reports/ReportPage.js — one page for every report
// (/admin/reports/:name): a period (presets or custom dates), grouping and a
// comparison period in the URL; stat cards with the change against the
// comparison; a chart; the main table (rows open what's behind them) with CSV
// export; and breakdown tables.
import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Link as RouterLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Link,
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
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip as ChartTooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { FiDownload } from 'react-icons/fi';
import { adminReports, catalog } from '../../../api';
import ReportStatCard, {
  formatValue,
} from '../../../components/admin/ReportStatCard';
import { useNotify } from '../../../notification/NotificationProvider';
import { SectionCard } from '../../../components/ui';
import {
  EmptyRow,
  PAGE_SIZE,
  PageHeader,
  StandardPagination,
  TablePanel,
} from '../../../components/admin/DataTable';
import {
  CardSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from '../../../components/skeletons';
import {
  downloadCsv,
  formatDate,
  formatMoneyCompact,
} from '../../../utils/format';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Legend,
  ChartTooltip
);

export const REPORTS = {
  sales: {
    title: 'Sales',
    subtitle:
      'Revenue, orders and average order over time, and where sales come from.',
  },
  products: {
    title: 'Products',
    subtitle:
      'What sells and what doesn’t: units, revenue, views, returns and margins.',
    filters: ['category', 'brand'],
  },
  inventory: {
    title: 'Inventory',
    subtitle:
      'What to reorder: stock levels, how fast it sells, and every stock movement.',
    noCompare: true,
    filters: ['product'],
  },
  customers: {
    title: 'Customers',
    subtitle: 'Who buys, who comes back, and where they are.',
  },
  promotions: {
    title: 'Promotions',
    subtitle:
      'Whether promo codes pay off: uses, discount given, sales and repeat orders.',
  },
  service: {
    title: 'Returns & service',
    subtitle:
      'What returns cost, why items come back, and how fast support replies.',
  },
  search: {
    title: 'Searches',
    subtitle: 'What shoppers look for, and what they can’t find.',
  },
  finance: {
    title: 'Finance',
    subtitle:
      'Money owed, cash on delivery to collect, payments for reconciling, and VAT.',
    noCompare: true,
  },
};

const ymd = (d) => d.toISOString().slice(0, 10);
const today = () => new Date(Date.now() + 3 * 3600 * 1000);
const daysAgo = (n) => {
  const d = today();
  d.setUTCDate(d.getUTCDate() - n);
  return ymd(d);
};
const PRESETS = [
  ['7', 'Last 7 days', () => [daysAgo(6), ymd(today())]],
  ['30', 'Last 30 days', () => [daysAgo(29), ymd(today())]],
  ['90', 'Last 90 days', () => [daysAgo(89), ymd(today())]],
  [
    'month',
    'This month',
    () => {
      const t = today();
      return [
        ymd(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1))),
        ymd(t),
      ];
    },
  ],
  [
    'last_month',
    'Last month',
    () => {
      const t = today();
      return [
        ymd(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1))),
        ymd(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0))),
      ];
    },
  ],
  [
    'year',
    'This year',
    () => {
      const t = today();
      return [ymd(new Date(Date.UTC(t.getUTCFullYear(), 0, 1))), ymd(t)];
    },
  ],
  ['custom', 'Custom dates', null],
];

const SeriesChart = ({ series, group }) => {
  const theme = useTheme();
  const colors = [theme.palette.primary.main, theme.palette.warning.main];
  const formats = series.datasets.map((d) => d.format);
  const twoAxes = new Set(formats).size > 1;
  const label = (l) =>
    group === 'month'
      ? new Date(`${l}T00:00:00Z`).toLocaleDateString(undefined, {
          month: 'short',
          year: '2-digit',
          timeZone: 'UTC',
        })
      : new Date(`${l}T00:00:00Z`).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        });
  const data = {
    labels: series.labels.map(label),
    datasets: series.datasets.flatMap((d, i) => [
      {
        label: d.label,
        data: d.values,
        borderColor: colors[i % 2],
        backgroundColor: alpha(colors[i % 2], 0.08),
        fill: i === 0,
        tension: 0.3,
        pointRadius: series.labels.length > 40 ? 0 : 2,
        yAxisID: twoAxes && i > 0 ? 'y1' : 'y',
        format: d.format,
      },
      ...(d.compare
        ? [
            {
              label: `${d.label} (comparison)`,
              data: d.compare,
              borderColor: alpha(colors[i % 2], 0.45),
              borderDash: [6, 4],
              pointRadius: 0,
              tension: 0.3,
              yAxisID: twoAxes && i > 0 ? 'y1' : 'y',
              format: d.format,
            },
          ]
        : []),
    ]),
  };
  const tick = (format) => (v) =>
    format === 'money' ? formatMoneyCompact(v) : Number(v).toLocaleString();
  return (
    <Box sx={{ height: 300 }} data-testid="report-chart">
      <Line
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 12, usePointStyle: true },
            },
            tooltip: {
              callbacks: {
                label: (ctx) =>
                  `${ctx.dataset.label}: ${formatValue(ctx.parsed.y, ctx.dataset.format)}`,
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
            y: { beginAtZero: true, ticks: { callback: tick(formats[0]) } },
            ...(twoAxes
              ? {
                  y1: {
                    beginAtZero: true,
                    position: 'right',
                    grid: { display: false },
                    ticks: { callback: tick(formats[1]) },
                  },
                }
              : {}),
          },
        }}
      />
    </Box>
  );
};
SeriesChart.propTypes = {
  series: PropTypes.object.isRequired,
  group: PropTypes.string,
};

/** A report table; rows with a link open what's behind them. */
const ReportTable = ({ table, pageSize = PAGE_SIZE, testId }) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [table]);
  const rows = table.rows.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <>
      <TableContainer>
        <Table
          size={pageSize === PAGE_SIZE ? 'medium' : 'small'}
          aria-label={table.title}
          data-testid={testId}
        >
          <TableHead sx={{ bgcolor: 'background.neutral' }}>
            <TableRow>
              {table.columns.map((c) => (
                <TableCell
                  key={c.key}
                  align={c.align}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  {c.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow
                key={i}
                hover={Boolean(r.link)}
                onClick={r.link ? () => navigate(r.link) : undefined}
                sx={r.link ? { cursor: 'pointer' } : undefined}
              >
                {table.columns.map((c, j) => (
                  <TableCell
                    key={c.key}
                    align={c.align}
                    sx={{
                      whiteSpace: j === 0 ? 'normal' : 'nowrap',
                      fontWeight: j === 0 ? 600 : undefined,
                    }}
                  >
                    {j === 0 && r.link ? (
                      <Link
                        component={RouterLink}
                        to={r.link}
                        underline="hover"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {formatValue(r[c.key], c.format)}
                      </Link>
                    ) : (
                      formatValue(r[c.key], c.format)
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {!rows.length && (
              <EmptyRow cols={table.columns.length}>
                {table.empty || 'Nothing here.'}
              </EmptyRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {table.rows.length > 0 && (
        <StandardPagination
          count={table.rows.length}
          page={page}
          rowsPerPage={pageSize}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={() => {}}
          maxShowAll={0}
          label="rows"
        />
      )}
    </>
  );
};
ReportTable.propTypes = {
  table: PropTypes.object.isRequired,
  pageSize: PropTypes.number,
  testId: PropTypes.string,
};

const ReportSkeleton = () => (
  <Stack spacing={3} data-testid="report-loading" aria-busy="true">
    <StatCardsSkeleton count={4} columns={{ xs: 2, lg: 4 }} />
    <CardSkeleton>
      <Box sx={{ height: 300 }} />
    </CardSkeleton>
    <TableSkeleton columns={6} rows={8} toolbar={false} />
  </Stack>
);

const ReportPage = () => {
  const { name } = useParams();
  const meta = REPORTS[name];
  const notify = useNotify();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [lists, setLists] = useState({ categories: [], brands: [] });
  const get = (k) => params.get(k) || '';
  const preset = get('range') || (get('from') ? 'custom' : '30');
  const set = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) =>
      v ? next.set(k, v) : next.delete(k)
    );
    setParams(next, { replace: true });
  };
  const [from, to] = useMemo(() => {
    const p = PRESETS.find(([k]) => k === preset);
    return p && p[2]
      ? p[2]()
      : [get('from') || daysAgo(29), get('to') || ymd(today())];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, params]);

  useEffect(() => {
    if (!meta) return undefined;
    let active = true;
    setData(null);
    adminReports
      .run(name, {
        from,
        to,
        group: get('group') || undefined,
        compare: meta.noCompare ? 'none' : get('compare') || 'previous',
        category: get('category') || undefined,
        brand: get('brand') || undefined,
        product: get('product') || undefined,
      })
      .then((d) => active && setData(d))
      .catch((error) => {
        notify.error(error, 'We couldn’t load this report.');
        if (active) setData({ cards: [], period: { from, to } });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, from, to, params, notify]);

  useEffect(() => {
    if (!meta?.filters?.includes('category')) return;
    Promise.all([
      catalog.getCategories().catch(() => []),
      catalog.brands().catch(() => []),
    ]).then(([categories, brands]) => setLists({ categories, brands }));
  }, [meta]);

  if (!meta) {
    return (
      <SectionCard>
        <Typography>That report doesn’t exist.</Typography>
      </SectionCard>
    );
  }

  const exportCsv = () => {
    const t = data?.table;
    if (!t) return;
    downloadCsv(
      `${name}-report-${from}-to-${to}.csv`,
      t.columns.map((c) => c.label),
      t.rows.map((r) =>
        t.columns.map((c) =>
          c.format === 'date' && r[c.key]
            ? formatDate(r[c.key])
            : (r[c.key] ?? '')
        )
      )
    );
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Reports', to: '/admin/reports/sales' },
          { label: meta.title, to: `/admin/reports/${name}` },
        ]}
        title={meta.title}
        subtitle={meta.subtitle}
        actions={
          <Button
            variant="outlined"
            startIcon={<FiDownload />}
            onClick={exportCsv}
            disabled={!data?.table}
            sx={{ bgcolor: 'background.paper' }}
          >
            Export CSV
          </Button>
        }
      />

      {/* Period, grouping, comparison and report filters. */}
      <Stack
        direction="row"
        spacing={1.5}
        flexWrap="wrap"
        useFlexGap
        alignItems="center"
      >
        <TextField
          select
          size="small"
          label="Period"
          value={preset}
          onChange={(e) =>
            e.target.value === 'custom'
              ? set({ range: 'custom', from, to })
              : set({ range: e.target.value, from: '', to: '' })
          }
          sx={{ minWidth: 170 }}
        >
          {PRESETS.map(([k, l]) => (
            <MenuItem key={k} value={k}>
              {l}
            </MenuItem>
          ))}
        </TextField>
        {preset === 'custom' && (
          <>
            <TextField
              size="small"
              type="date"
              label="From"
              value={from}
              onChange={(e) => set({ from: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              type="date"
              label="To"
              value={to}
              onChange={(e) => set({ to: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </>
        )}
        {name !== 'inventory' && name !== 'finance' && (
          <TextField
            select
            size="small"
            label="Group by"
            value={get('group')}
            onChange={(e) => set({ group: e.target.value })}
            SelectProps={{ displayEmpty: true }}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="">Automatic</MenuItem>
            <MenuItem value="day">Day</MenuItem>
            <MenuItem value="week">Week</MenuItem>
            <MenuItem value="month">Month</MenuItem>
          </TextField>
        )}
        {!meta.noCompare && (
          <TextField
            select
            size="small"
            label="Compare with"
            value={get('compare') || 'previous'}
            onChange={(e) =>
              set({
                compare: e.target.value === 'previous' ? '' : e.target.value,
              })
            }
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="previous">The period before</MenuItem>
            <MenuItem value="last_year">Same time last year</MenuItem>
            <MenuItem value="none">No comparison</MenuItem>
          </TextField>
        )}
        {meta.filters?.includes('category') && (
          <>
            <TextField
              select
              size="small"
              label="Category"
              value={get('category')}
              onChange={(e) => set({ category: e.target.value })}
              SelectProps={{ displayEmpty: true }}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">All categories</MenuItem>
              {lists.categories
                .filter((c) => !c.parentId)
                .map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Brand"
              value={get('brand')}
              onChange={(e) => set({ brand: e.target.value })}
              SelectProps={{ displayEmpty: true }}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">All brands</MenuItem>
              {lists.brands.map((b) => (
                <MenuItem key={b.id} value={String(b.id)}>
                  {b.name}
                </MenuItem>
              ))}
            </TextField>
          </>
        )}
        {get('product') && (
          <Chip
            label="One product"
            onDelete={() => set({ product: '' })}
            color="primary"
            variant="outlined"
          />
        )}
        {data?.period?.compare && (
          <Typography variant="caption" color="text.secondary">
            Compared with {formatDate(data.period.compare.from)} –{' '}
            {formatDate(data.period.compare.to)}
          </Typography>
        )}
      </Stack>

      {!data ? (
        <ReportSkeleton />
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
                lg: `repeat(${Math.min(4, data.cards.length || 1)}, minmax(0, 1fr))`,
              },
            }}
          >
            {data.cards.map((c) => (
              <ReportStatCard key={c.key} card={c} />
            ))}
          </Box>

          {(data.notes || []).map((n) => (
            <Alert key={n} severity="info" icon={false}>
              {n}
            </Alert>
          ))}

          {data.series && (
            <SectionCard title="Over time">
              <SeriesChart series={data.series} group={data.period.group} />
            </SectionCard>
          )}

          {data.table && (
            <TablePanel>
              <Box sx={{ px: 2.5, py: 2 }}>
                <Typography variant="h6">{data.table.title}</Typography>
              </Box>
              <ReportTable table={data.table} testId="report-table" />
            </TablePanel>
          )}

          {data.breakdowns?.length > 0 && (
            <Grid container spacing={3}>
              {data.breakdowns.map((b) => (
                <Grid
                  item
                  xs={12}
                  lg={b.columns.length > 4 ? 12 : 6}
                  key={b.title}
                >
                  <SectionCard
                    title={b.title}
                    sx={{
                      height: '100%',
                      p: 0,
                      '& > :first-of-type': { px: 3, pt: 3 },
                    }}
                  >
                    <Box
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        mx: 3,
                        mb: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <ReportTable table={b} pageSize={5} />
                    </Box>
                  </SectionCard>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}
    </Stack>
  );
};

export default ReportPage;
