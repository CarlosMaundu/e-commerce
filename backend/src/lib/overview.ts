// src/lib/overview.ts — figures for the back-office "Store overview", all
// computed from real orders, products and product views. Every figure covers
// the chosen period (7, 30 or 90 days) and is compared with the period before.
import { query } from '../db';
import { round2 } from './pricing';

export const OVERVIEW_PERIODS = [7, 30, 90, 180, 365] as const;

// Orders that count as sales: placed, and neither cancelled nor refunded.
const VALID = `placed_at IS NOT NULL AND status NOT IN ('cancelled', 'refunded')`;
const CUR = `placed_at >= now() - make_interval(days => $1)`;
const PREV = `placed_at >= now() - make_interval(days => $1 * 2) AND placed_at < now() - make_interval(days => $1)`;

const change = (cur: number, prev: number) => (prev ? round2(((cur - prev) / prev) * 100) : cur ? 100 : 0);

export const storeOverview = async (days: number) => {
  const p = [days];

  const totals = (
    await query(
      `SELECT
         COALESCE(sum(total) FILTER (WHERE ${VALID} AND ${CUR}), 0) AS revenue,
         COALESCE(sum(total) FILTER (WHERE ${VALID} AND ${PREV}), 0) AS prev_revenue,
         count(*) FILTER (WHERE placed_at IS NOT NULL AND ${CUR})::int AS orders,
         count(*) FILTER (WHERE placed_at IS NOT NULL AND ${PREV})::int AS prev_orders,
         count(*) FILTER (WHERE ${VALID} AND ${CUR})::int AS valid_orders,
         count(*) FILTER (WHERE ${VALID} AND ${PREV})::int AS prev_valid_orders,
         count(*) FILTER (WHERE placed_at IS NOT NULL AND status IN ('pending', 'processing'))::int AS awaiting
       FROM orders`,
      p
    )
  ).rows[0];
  const revenue = round2(Number(totals.revenue));
  const prevRevenue = round2(Number(totals.prev_revenue));

  const customers = (
    await query(
      `SELECT
         count(*) FILTER (WHERE u.created_at >= now() - make_interval(days => $1))::int AS cur,
         count(*) FILTER (WHERE u.created_at >= now() - make_interval(days => $1 * 2)
                            AND u.created_at < now() - make_interval(days => $1))::int AS prev
       FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'customer'`,
      p
    )
  ).rows[0];
  const buyers = (
    await query(
      `SELECT count(*)::int AS buyers,
         count(*) FILTER (WHERE first_order >= now() - make_interval(days => $1))::int AS first_time
       FROM (SELECT user_id, min(placed_at) AS first_order, max(placed_at) AS last_order
             FROM orders WHERE placed_at IS NOT NULL GROUP BY user_id) b
       WHERE last_order >= now() - make_interval(days => $1)`,
      p
    )
  ).rows[0];

  const views = (
    await query(
      `SELECT
         COALESCE(sum(views) FILTER (WHERE day > current_date - $1::int), 0)::int AS cur,
         COALESCE(sum(views) FILTER (WHERE day > current_date - $1::int * 2 AND day <= current_date - $1::int), 0)::int AS prev
       FROM product_views`,
      p
    )
  ).rows[0];
  const conversion = views.cur ? round2((totals.orders / views.cur) * 100) : 0;
  const prevConversion = views.prev ? round2((totals.prev_orders / views.prev) * 100) : 0;

  // Chart buckets: days up to 90 days, weeks for 6 months, months for a year.
  // Each bucket is compared with the same dates a year earlier.
  const unit = days <= 90 ? 'day' : days <= 180 ? 'week' : 'month';
  const buckets = unit === 'day' ? days : unit === 'week' ? 26 : 12;
  const step = `interval '1 ${unit}'`;
  const series = (
    await query(
      `WITH buckets AS (
         SELECT generate_series(date_trunc('${unit}', now()) - ${step} * ($1 - 1), date_trunc('${unit}', now()), ${step}) AS d)
       SELECT to_char(d, 'YYYY-MM-DD') AS date,
         COALESCE((SELECT sum(total) FROM orders WHERE ${VALID} AND placed_at >= d AND placed_at < d + ${step}), 0) AS revenue,
         (SELECT count(*) FROM orders WHERE ${VALID} AND placed_at >= d AND placed_at < d + ${step})::int AS orders,
         COALESCE((SELECT sum(total) FROM orders WHERE ${VALID}
           AND placed_at >= d - interval '1 year' AND placed_at < d - interval '1 year' + ${step}), 0) AS last_year_revenue,
         (SELECT count(*) FROM orders WHERE ${VALID}
           AND placed_at >= d - interval '1 year' AND placed_at < d - interval '1 year' + ${step})::int AS last_year_orders
       FROM buckets ORDER BY d`,
      [buckets]
    )
  ).rows.map((r) => ({
    date: r.date,
    revenue: round2(Number(r.revenue)),
    orders: r.orders,
    last_year_revenue: round2(Number(r.last_year_revenue)),
    last_year_orders: r.last_year_orders,
  }));
  const lastYear = (
    await query(
      `SELECT COALESCE(sum(total), 0) AS revenue, count(*)::int AS orders FROM orders
       WHERE ${VALID} AND placed_at >= now() - make_interval(days => $1) - interval '1 year'
         AND placed_at < now() - interval '1 year'`,
      p
    )
  ).rows[0];

  // Top-level category of each sold item (subcategories roll up).
  const ROOT = `LEFT JOIN categories c ON c.id = pr.category_id
                LEFT JOIN categories root ON root.id = COALESCE(c.parent_id, c.id)`;
  const categories = (
    await query(
      `SELECT root.id, COALESCE(root.name, 'Uncategorised') AS name, sum(oi.total) AS sales
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products pr ON pr.id = oi.product_id ${ROOT}
       WHERE o.placed_at IS NOT NULL AND o.status NOT IN ('cancelled', 'refunded') AND o.${CUR}
       GROUP BY root.id, root.name ORDER BY sales DESC`,
      p
    )
  ).rows;
  const itemSales = categories.reduce((s, c) => s + Number(c.sales), 0);

  const fulfilment = (
    await query(
      `SELECT
         count(*) FILTER (WHERE status IN ('pending', 'processing') AND placed_at > now() - interval '3 days')::int AS packing,
         count(*) FILTER (WHERE status = 'shipped')::int AS in_transit,
         count(*) FILTER (WHERE status IN ('pending', 'processing') AND placed_at <= now() - interval '3 days')::int AS delayed
       FROM orders WHERE placed_at IS NOT NULL`
    )
  ).rows[0];

  const inventory = (
    await query(
      `SELECT count(*)::int AS total,
         count(*) FILTER (WHERE quantity > low_stock_threshold)::int AS healthy,
         count(*) FILTER (WHERE quantity > 0 AND quantity <= low_stock_threshold)::int AS low,
         count(*) FILTER (WHERE quantity <= 0)::int AS out
       FROM products WHERE track_inventory AND status <> 'archived'`
    )
  ).rows[0];

  const locations = (
    await query(
      `SELECT initcap(trim(shipping_address->>'city')) AS city, count(*)::int AS orders
       FROM orders WHERE ${VALID} AND ${CUR} AND COALESCE(trim(shipping_address->>'city'), '') <> ''
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
       WHERE o.placed_at IS NOT NULL AND o.status NOT IN ('cancelled', 'refunded') AND o.${CUR}
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

  const aov = totals.valid_orders ? round2(revenue / totals.valid_orders) : 0;
  const prevAov = totals.prev_valid_orders ? round2(prevRevenue / totals.prev_valid_orders) : 0;

  return {
    days,
    kpis: {
      revenue: { value: revenue, change: change(revenue, prevRevenue) },
      orders: { value: totals.orders, change: change(totals.orders, totals.prev_orders), awaiting: totals.awaiting },
      new_customers: {
        value: customers.cur,
        change: change(customers.cur, customers.prev),
        first_time_share: buyers.buyers ? Math.round((buyers.first_time / buyers.buyers) * 100) : 0,
      },
      conversion: { value: conversion, change: round2(conversion - prevConversion), views: views.cur },
      average_order: { value: aov, change: change(aov, prevAov) },
    },
    series,
    series_unit: unit,
    // The same dates a year earlier, for the sales chart.
    last_year: {
      revenue: round2(Number(lastYear.revenue)),
      orders: lastYear.orders,
      revenue_change: change(revenue, round2(Number(lastYear.revenue))),
      orders_change: change(totals.valid_orders, lastYear.orders),
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
export const attentionCounts = async () =>
  (
    await query(
      `SELECT
         (SELECT count(*)::int FROM orders WHERE placed_at IS NOT NULL AND status IN ('pending', 'processing')) AS to_fulfil,
         (SELECT count(*)::int FROM orders WHERE placed_at IS NOT NULL AND status IN ('pending', 'processing')
            AND placed_at <= now() - interval '3 days') AS delayed,
         (SELECT count(*)::int FROM returns WHERE status = 'requested') AS open_returns,
         (SELECT count(*)::int FROM products WHERE track_inventory AND status = 'published'
            AND quantity > 0 AND quantity <= low_stock_threshold) AS low_stock,
         (SELECT count(*)::int FROM products WHERE track_inventory AND status = 'published' AND quantity <= 0) AS out_of_stock`
    )
  ).rows[0];
