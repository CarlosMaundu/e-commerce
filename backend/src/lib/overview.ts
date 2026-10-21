// src/lib/overview.ts — figures for the back-office "Store overview", all
// computed from real orders, products and product views. Every figure covers
// the chosen period (the last 7, 30 or 90 days, 6 or 12 months, as calendar
// days in the shop's time zone) and is compared with the period before.
//
// The money and order figures are the Sales report's own (reports/core.ts),
// so the overview and the reports always agree: orders are placed and not
// cancelled; net sales are sales less refunds paid in the period.
import { query } from '../db';
import { round2 } from './pricing';
import { buckets as bucketDates, fill, inRange, inShopCurrency, parsePeriod } from './reports/common';
import { refundSeries, salesSeries, salesTotals } from './reports/core';
import { DELIVERED_AT_SQL, orderSlaSummary } from './sla';
import { shopDate } from './time';

export const OVERVIEW_PERIODS = [7, 30, 90, 180, 365] as const;

// Placed, not cancelled, in the shop's currency — as in the reports.
const valid = () => `o.placed_at IS NOT NULL AND o.status <> 'cancelled' AND ${inShopCurrency('o')}`;
const IN = (col: string) => inRange(col, '$1', '$2');

const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

const change = (cur: number, prev: number) => (prev ? round2(((cur - prev) / prev) * 100) : cur ? 100 : 0);

/**
 * Open orders by where they stand: delayed means not shipped yet and over
 * its SLA target (the SLA report's "breached"); otherwise packing or in
 * transit.
 */
const openOrders = async () => {
  const rows = (
    await query(
      `SELECT o.id, o.status, o.placed_at, o.shipping_method, o.user_id, ${DELIVERED_AT_SQL} AS delivered_at
       FROM orders o WHERE o.placed_at IS NOT NULL AND o.status IN ('pending', 'processing', 'shipped')`
    )
  ).rows;
  const now = Date.now();
  let packing = 0;
  let inTransit = 0;
  let delayed = 0;
  for (const o of rows) {
    if (o.status === 'shipped') inTransit += 1;
    else if (orderSlaSummary(o, now).state === 'breached') delayed += 1;
    else packing += 1;
  }
  return { packing, in_transit: inTransit, delayed };
};

export const storeOverview = async (days: number) => {
  // Chart buckets: days up to 90 days, weeks for 6 months, months for a year.
  const unit = days <= 90 ? 'day' : days <= 180 ? 'week' : 'month';
  const to = shopDate();
  const period = parsePeriod({ from: addDays(to, -(days - 1)), to, group: unit, compare: 'previous' });
  const prev = period.compare!;
  // The chart's comparison: the same dates a year earlier (52 weeks, so
  // weekdays line up), as the reports' "Same time last year".
  const lastYearRange = { from: addDays(period.from, -364), to: addDays(period.to, -364) };
  const p = [period.from, period.to];
  const pp = [prev.from, prev.to];

  const [cur, before, lastYearTotals] = await Promise.all([
    salesTotals(period.from, period.to),
    salesTotals(prev.from, prev.to),
    salesTotals(lastYearRange.from, lastYearRange.to),
  ]);
  const awaiting = (
    await query(`SELECT count(*)::int AS n FROM orders WHERE placed_at IS NOT NULL AND status IN ('pending', 'processing')`)
  ).rows[0].n;

  const newCustomers = async (range: string[]) =>
    (
      await query(
        `SELECT count(*)::int AS n FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.code = 'customer' AND ${IN('u.created_at')}`,
        range
      )
    ).rows[0].n;
  const [customersNow, customersBefore] = await Promise.all([newCustomers(p), newCustomers(pp)]);
  const buyers = (
    await query(
      `SELECT count(*)::int AS buyers, count(*) FILTER (WHERE ${inRange('first_order', '$1', '$2')})::int AS first_time
       FROM (SELECT o.user_id, min(o.placed_at) AS first_order, max(o.placed_at) AS last_order
             FROM orders o WHERE ${valid()} GROUP BY o.user_id) b
       WHERE ${inRange('last_order', '$1', '$2')}`,
      p
    )
  ).rows[0];

  const productViews = async (range: string[]) =>
    (await query(`SELECT COALESCE(sum(views), 0)::int AS n FROM product_views WHERE day BETWEEN $1::date AND $2::date`, range))
      .rows[0].n;
  const [viewsNow, viewsBefore] = await Promise.all([productViews(p), productViews(pp)]);
  const conversion = viewsNow ? round2((cur.orders / viewsNow) * 100) : 0;
  const prevConversion = viewsBefore ? round2((before.orders / viewsBefore) * 100) : 0;

  // Net sales and orders per bucket, against the same buckets a year earlier.
  const perBucket = async (range: { from: string; to: string }) => {
    const labels = bucketDates(range, unit);
    const [rows, refunds] = await Promise.all([
      salesSeries(range.from, range.to, unit),
      refundSeries(range.from, range.to, unit),
    ]);
    const sales = fill(labels, rows, 'sales');
    const paidBack = fill(labels, refunds, 'refunds');
    return { labels, net: sales.map((v, i) => round2(v - paidBack[i])), orders: fill(labels, rows, 'orders') };
  };
  const [now, year] = await Promise.all([perBucket(period), perBucket(lastYearRange)]);
  const series = now.labels.map((date, i) => ({
    date,
    revenue: now.net[i],
    orders: now.orders[i],
    last_year_revenue: year.net[i] ?? 0,
    last_year_orders: year.orders[i] ?? 0,
  }));

  // Top-level category of each sold item (subcategories roll up).
  const ROOT = `LEFT JOIN categories c ON c.id = pr.category_id
                LEFT JOIN categories root ON root.id = COALESCE(c.parent_id, c.id)`;
  const categories = (
    await query(
      `SELECT root.id, COALESCE(root.name, 'Uncategorised') AS name, sum(oi.total) AS sales
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products pr ON pr.id = oi.product_id ${ROOT}
       WHERE ${valid()} AND ${IN('o.placed_at')}
       GROUP BY root.id, root.name ORDER BY sales DESC`,
      p
    )
  ).rows;
  const itemSales = categories.reduce((s, c) => s + Number(c.sales), 0);

  const fulfilment = await openOrders();

  // One row per stocked thing (a variant, or a product without variants), as
  // in the Inventory report.
  const inventory = (
    await query(
      `WITH items AS (
         SELECT v.quantity AS stock, pr.low_stock_threshold AS threshold
         FROM product_variants v JOIN products pr ON pr.id = v.product_id WHERE pr.track_inventory
         UNION ALL
         SELECT pr.quantity, pr.low_stock_threshold FROM products pr
         WHERE pr.track_inventory AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = pr.id))
       SELECT count(*)::int AS total,
         count(*) FILTER (WHERE stock > threshold)::int AS healthy,
         count(*) FILTER (WHERE stock > 0 AND stock <= threshold)::int AS low,
         count(*) FILTER (WHERE stock <= 0)::int AS out
       FROM items`
    )
  ).rows[0];

  const locations = (
    await query(
      `SELECT initcap(trim(shipping_address->>'city')) AS city, count(*)::int AS orders
       FROM orders o WHERE ${valid()} AND ${IN('o.placed_at')} AND COALESCE(trim(shipping_address->>'city'), '') <> ''
       GROUP BY 1 ORDER BY orders DESC`,
      p
    )
  ).rows;

  const topProducts = (
    await query(
      `SELECT pr.id, COALESCE(pr.name, oi.name) AS name, pr.sku, root.id AS category_id,
         COALESCE(root.name, 'Uncategorised') AS category, sum(oi.quantity)::int AS units, sum(oi.total) AS sales
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products pr ON pr.id = oi.product_id ${ROOT}
       WHERE ${valid()} AND ${IN('o.placed_at')}
       GROUP BY pr.id, oi.name, root.id, root.name ORDER BY sales DESC LIMIT 50`,
      p
    )
  ).rows.map((r) => ({
    product_id: r.id,
    name: r.name,
    sku: r.sku || '',
    category_id: r.category_id,
    category: r.category,
    units: r.units,
    sales: round2(Number(r.sales)),
  }));

  const recentOrders = (
    await query(
      `SELECT o.id, o.number, o.placed_at, o.total, o.status, o.payment_status, o.user_id,
         TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')) AS customer_name,
         (SELECT name FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS first_item,
         (SELECT count(*) FROM order_items WHERE order_id = o.id)::int AS lines
       FROM orders o LEFT JOIN users u ON u.id = o.user_id
       WHERE o.placed_at IS NOT NULL ORDER BY o.placed_at DESC LIMIT 40`
    )
  ).rows.map((o) => ({
    order_id: o.id,
    order_number: o.number,
    placed_at: o.placed_at,
    total: round2(Number(o.total)),
    status: o.status,
    payment_status: o.payment_status,
    customer_id: o.user_id,
    customer_name: o.customer_name || 'Guest',
    first_item: o.first_item || '',
    other_items: Math.max(0, o.lines - 1),
  }));

  return {
    days,
    period: period.out,
    kpis: {
      // Net sales: sales less refunds paid in the period.
      revenue: { value: cur.net, change: change(cur.net, before.net) },
      orders: { value: cur.orders, change: change(cur.orders, before.orders), awaiting },
      new_customers: {
        value: customersNow,
        change: change(customersNow, customersBefore),
        first_time_share: buyers.buyers ? Math.round((buyers.first_time / buyers.buyers) * 100) : 0,
      },
      conversion: { value: conversion, change: round2(conversion - prevConversion), views: viewsNow },
      // Average order: sales per order, as in the Sales report.
      average_order: { value: cur.aov, change: change(cur.aov, before.aov) },
    },
    series,
    series_unit: unit,
    // The same dates a year earlier, for the sales chart.
    last_year: {
      revenue: lastYearTotals.net,
      orders: lastYearTotals.orders,
      revenue_change: change(cur.net, lastYearTotals.net),
      orders_change: change(cur.orders, lastYearTotals.orders),
    },
    categories: categories.map((c) => ({
      category_id: c.id,
      name: c.name,
      sales: round2(Number(c.sales)),
      share: itemSales ? Math.round((Number(c.sales) / itemSales) * 100) : 0,
    })),
    fulfilment: { ...fulfilment, total: fulfilment.packing + fulfilment.in_transit + fulfilment.delayed },
    inventory: { ...inventory, healthy_share: inventory.total ? Math.round((inventory.healthy / inventory.total) * 100) : 0 },
    locations,
    top_products: topProducts,
    recent_orders: recentOrders,
  };
};

/** Things that need someone's attention, for the back-office bell. */
export const attentionCounts = async () => {
  const counts = (
    await query(
      `SELECT
         (SELECT count(*)::int FROM orders WHERE placed_at IS NOT NULL AND status IN ('pending', 'processing')) AS to_fulfil,
         (SELECT count(*)::int FROM returns WHERE status = 'requested') AS open_returns,
         (SELECT count(*)::int FROM products WHERE track_inventory AND status = 'published'
            AND quantity > 0 AND quantity <= low_stock_threshold) AS low_stock,
         (SELECT count(*)::int FROM products WHERE track_inventory AND status = 'published' AND quantity <= 0) AS out_of_stock`
    )
  ).rows[0];
  // Delayed: open orders over their SLA target, as in the SLA report.
  return { ...counts, delayed: (await openOrders()).delayed };
};
