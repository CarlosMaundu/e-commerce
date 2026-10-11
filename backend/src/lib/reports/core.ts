// src/lib/reports/core.ts — Sales, Products and Inventory reports.
// Sales counts placed orders that weren't cancelled (refunded orders count as
// sales; their refunds are taken off for net sales), in the shop's time zone.
import { query } from '../../db';
import {
  bucketOf,
  buckets,
  Card,
  change,
  fill,
  inRange,
  num,
  pct,
  Period,
  Report,
  round2,
} from './common';

const VALID = `o.placed_at IS NOT NULL AND o.status <> 'cancelled'`;
// "By delivery option" → "Delivery option" for the first column's heading.
const heading = (title: string) => {
  const t = title.replace(/^By /, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const PAYMENT_NAMES: Record<string, string> = {
  stripe: 'Card',
  cod: 'Cash on delivery',
  cash: 'Cash',
  mpesa: 'M-Pesa',
  bank: 'Bank transfer',
};
const card = (key: string, label: string, value: number, format: Card['format'], prev?: number | null, extra: Partial<Card> = {}): Card => ({
  key,
  label,
  value: round2(value),
  format,
  change: format === 'percent' ? (prev === null || prev === undefined ? null : round2(value - prev)) : change(value, prev),
  compare: prev === undefined ? null : prev === null ? null : round2(prev),
  ...extra,
});

// ---------- Sales ----------

const salesTotals = async (from: string, to: string) => {
  const o = (await query(
    `SELECT count(*)::int AS orders, COALESCE(sum(o.total), 0) AS sales, COALESCE(sum(o.subtotal), 0) AS goods,
       COALESCE(sum(o.discount), 0) AS discounts, COALESCE(sum(o.shipping_total), 0) AS delivery,
       COALESCE(sum(o.tax_total), 0) AS tax,
       (SELECT COALESCE(sum(oi.quantity), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE ${VALID} AND ${inRange('o.placed_at', '$1', '$2')})::int AS items
     FROM orders o WHERE ${VALID} AND ${inRange('o.placed_at', '$1', '$2')}`,
    [from, to]
  )).rows[0];
  const refunds = num((await query(
    `SELECT COALESCE(sum(amount), 0) AS n FROM refunds WHERE status = 'processed' AND ${inRange('processed_at', '$1', '$2')}`,
    [from, to]
  )).rows[0].n);
  // Profit only where a cost price is known.
  const cost = (await query(
    `SELECT COALESCE(sum(oi.total) FILTER (WHERE oi.unit_cost IS NOT NULL), 0) AS costed_revenue,
       COALESCE(sum(oi.unit_cost * oi.quantity), 0) AS cogs, COALESCE(sum(oi.total), 0) AS revenue
     FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE ${VALID} AND ${inRange('o.placed_at', '$1', '$2')}`,
    [from, to]
  )).rows[0];
  const sales = num(o.sales);
  return {
    orders: o.orders,
    items: o.items,
    sales,
    discounts: num(o.discounts),
    delivery: num(o.delivery),
    tax: num(o.tax),
    refunds,
    net: round2(sales - refunds),
    aov: o.orders ? round2(sales / o.orders) : 0,
    ipo: o.orders ? round2(o.items / o.orders) : 0,
    profit: round2(num(cost.costed_revenue) - num(cost.cogs)),
    margin: pct(num(cost.costed_revenue) - num(cost.cogs), num(cost.costed_revenue)),
    costCoverage: pct(num(cost.costed_revenue), num(cost.revenue)),
  };
};

const salesSeries = async (from: string, to: string, group: string) =>
  (await query(
    `SELECT ${bucketOf('o.placed_at', group)} AS bucket, count(*)::int AS orders, COALESCE(sum(o.total), 0) AS sales,
       COALESCE(sum(o.discount), 0) AS discounts, COALESCE(sum(o.tax_total), 0) AS tax,
       COALESCE(sum((SELECT sum(quantity) FROM order_items WHERE order_id = o.id)), 0)::int AS items
     FROM orders o WHERE ${VALID} AND ${inRange('o.placed_at', '$1', '$2')} GROUP BY 1`,
    [from, to]
  )).rows;
const refundSeries = async (from: string, to: string, group: string) =>
  (await query(
    `SELECT ${bucketOf('processed_at', group)} AS bucket, COALESCE(sum(amount), 0) AS refunds
     FROM refunds WHERE status = 'processed' AND ${inRange('processed_at', '$1', '$2')} GROUP BY 1`,
    [from, to]
  )).rows;

const breakdown = async (from: string, to: string, by: string, label: string, name: (v: string) => string) => {
  const rows = (await query(
    `SELECT ${by} AS key, count(*)::int AS orders, COALESCE(sum(o.total), 0) AS sales
     FROM orders o WHERE ${VALID} AND ${inRange('o.placed_at', '$1', '$2')} GROUP BY 1 ORDER BY 3 DESC`,
    [from, to]
  )).rows;
  const total = rows.reduce((s, r) => s + num(r.sales), 0);
  return {
    title: label,
    columns: [
      { key: 'name', label: heading(label) },
      { key: 'orders', label: 'Orders', format: 'number' as const, align: 'right' as const },
      { key: 'sales', label: 'Sales', format: 'money' as const, align: 'right' as const },
      { key: 'share', label: 'Share', format: 'percent' as const, align: 'right' as const },
    ],
    rows: rows.map((r) => ({ name: name(r.key || ''), orders: r.orders, sales: round2(num(r.sales)), share: pct(num(r.sales), total) })),
  };
};

export const salesReport = async (p: Period): Promise<Report> => {
  const cur = await salesTotals(p.from, p.to);
  const prev = p.compare ? await salesTotals(p.compare.from, p.compare.to) : null;
  const labels = buckets(p, p.group);
  const [rows, refunds] = [await salesSeries(p.from, p.to, p.group), await refundSeries(p.from, p.to, p.group)];
  const cmpLabels = p.compare ? buckets(p.compare, p.group) : [];
  const cmpRows = p.compare ? await salesSeries(p.compare.from, p.compare.to, p.group) : [];
  const cmpRefunds = p.compare ? await refundSeries(p.compare.from, p.compare.to, p.group) : [];
  const net = (ls: string[], rs: any[], fs: any[]) => {
    const s = fill(ls, rs, 'sales');
    const r = fill(ls, fs, 'refunds');
    return s.map((v, i) => round2(v - r[i]));
  };
  const cards = [
    card('sales', 'Sales', cur.sales, 'money', prev?.sales, { hint: 'Order totals, including delivery and tax' }),
    card('net', 'Net sales', cur.net, 'money', prev?.net, { hint: 'Sales less refunds paid in the period' }),
    card('orders', 'Orders', cur.orders, 'number', prev?.orders),
    card('aov', 'Average order', cur.aov, 'money', prev?.aov),
    card('ipo', 'Items per order', cur.ipo, 'number', prev?.ipo),
    card('discounts', 'Discounts', cur.discounts, 'money', prev?.discounts, { inverse: true }),
    card('refunds', 'Refunds', cur.refunds, 'money', prev?.refunds, { inverse: true }),
    card('tax', 'Tax collected', cur.tax, 'money', prev?.tax),
  ];
  if (cur.costCoverage > 0) {
    cards.push(
      card('profit', 'Gross profit', cur.profit, 'money', prev && prev.costCoverage > 0 ? prev.profit : null, {
        hint: `${cur.margin}% margin, on the ${cur.costCoverage}% of sales with a cost price`,
      })
    );
  }
  const r = fill(labels, refunds, 'refunds');
  return {
    period: p.out,
    cards,
    series: {
      labels,
      datasets: [
        { key: 'net', label: 'Net sales', format: 'money', values: net(labels, rows, refunds), compare: p.compare ? net(cmpLabels, cmpRows, cmpRefunds) : undefined },
        { key: 'orders', label: 'Orders', format: 'number', values: fill(labels, rows, 'orders'), compare: p.compare ? fill(cmpLabels, cmpRows, 'orders') : undefined },
      ],
    },
    table: {
      title: 'By period',
      columns: [
        { key: 'bucket', label: p.group === 'day' ? 'Day' : p.group === 'week' ? 'Week of' : 'Month', format: 'date' },
        { key: 'orders', label: 'Orders', format: 'number', align: 'right' },
        { key: 'items', label: 'Items', format: 'number', align: 'right' },
        { key: 'sales', label: 'Sales', format: 'money', align: 'right' },
        { key: 'discounts', label: 'Discounts', format: 'money', align: 'right' },
        { key: 'refunds', label: 'Refunds', format: 'money', align: 'right' },
        { key: 'net', label: 'Net sales', format: 'money', align: 'right' },
        { key: 'tax', label: 'Tax', format: 'money', align: 'right' },
      ],
      rows: labels
        .map((l, i) => {
          const row = rows.find((x) => String(x.bucket instanceof Date ? x.bucket.toISOString() : x.bucket).slice(0, 10) === l);
          const sales = num(row?.sales);
          return {
            bucket: l,
            orders: row?.orders || 0,
            items: row?.items || 0,
            sales: round2(sales),
            discounts: round2(num(row?.discounts)),
            refunds: r[i],
            net: round2(sales - r[i]),
            tax: round2(num(row?.tax)),
          };
        })
        .reverse(),
    },
    breakdowns: [
      await breakdown(p.from, p.to, `CASE WHEN o.number LIKE 'STF-%' THEN 'staff' ELSE 'web' END`, 'By channel', (v) =>
        v === 'staff' ? 'Staff orders (phone, walk-in)' : 'Website'
      ),
      await breakdown(p.from, p.to, 'o.payment_method', 'By payment method', (v) => PAYMENT_NAMES[v] || v),
      await breakdown(p.from, p.to, 'o.shipping_method', 'By delivery option', (v) => v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ')),
      await breakdown(p.from, p.to, `initcap(trim(o.shipping_address->>'city'))`, 'By town', (v) => v || 'Unknown'),
    ],
  };
};

// ---------- Products ----------

export const productsReport = async (p: Period, f: { category?: number; brand?: number }): Promise<Report> => {
  const params: unknown[] = [p.from, p.to];
  const filters: string[] = [];
  if (f.category) {
    params.push(f.category);
    filters.push(`(pr.category_id = $${params.length} OR pr.category_id IN (SELECT id FROM categories WHERE parent_id = $${params.length}))`);
  }
  if (f.brand) {
    params.push(f.brand);
    filters.push(`pr.brand_id = $${params.length}`);
  }
  const where = filters.length ? `AND ${filters.join(' AND ')}` : '';
  const rows = (await query(
    `WITH sold AS (
       SELECT oi.product_id, sum(oi.quantity)::int AS units, count(DISTINCT oi.order_id)::int AS orders,
         sum(oi.total) AS revenue,
         sum(oi.total) FILTER (WHERE oi.unit_cost IS NOT NULL) AS costed, sum(oi.unit_cost * oi.quantity) AS cogs
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE ${VALID} AND ${inRange('o.placed_at', '$1', '$2')} GROUP BY 1),
     seen AS (SELECT product_id, sum(views)::int AS views FROM product_views WHERE day BETWEEN $1::date AND $2::date GROUP BY 1),
     back AS (
       SELECT oi.product_id, sum(r.quantity)::int AS returned FROM returns r JOIN order_items oi ON oi.id = r.order_item_id
       WHERE r.status <> 'rejected' AND ${inRange('r.created_at', '$1', '$2')} GROUP BY 1)
     SELECT pr.id, pr.name, pr.status, pr.quantity AS stock, pr.track_inventory, c.name AS category, b.name AS brand,
       COALESCE(sold.units, 0) AS units, COALESCE(sold.orders, 0) AS orders, COALESCE(sold.revenue, 0) AS revenue,
       sold.costed, sold.cogs, COALESCE(seen.views, 0) AS views, COALESCE(back.returned, 0) AS returned
     FROM products pr
     LEFT JOIN sold ON sold.product_id = pr.id LEFT JOIN seen ON seen.product_id = pr.id
     LEFT JOIN back ON back.product_id = pr.id
     LEFT JOIN categories c ON c.id = pr.category_id LEFT JOIN brands b ON b.id = pr.brand_id
     WHERE (sold.units IS NOT NULL OR pr.status = 'published') ${where}
     ORDER BY COALESCE(sold.revenue, 0) DESC, COALESCE(seen.views, 0) DESC`,
    params
  )).rows.map((r) => ({
    product_id: r.id,
    name: r.name,
    category: r.category || '—',
    brand: r.brand || '—',
    units: r.units,
    orders: r.orders,
    revenue: round2(num(r.revenue)),
    views: r.views,
    conversion: pct(r.orders, r.views),
    returned: r.returned,
    return_rate: pct(r.returned, r.units),
    margin: r.costed ? pct(num(r.costed) - num(r.cogs), num(r.costed)) : null,
    stock: r.track_inventory ? r.stock : null,
    link: `/admin/products/${r.id}/edit`,
  }));
  const sold = rows.filter((r) => r.units > 0);
  const units = sold.reduce((s, r) => s + r.units, 0);
  const revenue = sold.reduce((s, r) => s + r.revenue, 0);
  const views = rows.reduce((s, r) => s + r.views, 0);
  const orders = sold.reduce((s, r) => s + r.orders, 0);
  const prevUnits = p.compare
    ? num((await query(
        `SELECT COALESCE(sum(oi.quantity), 0) AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id
         JOIN products pr ON pr.id = oi.product_id WHERE ${VALID} AND ${inRange('o.placed_at', '$1', '$2')} ${where}`,
        [p.compare.from, p.compare.to, ...params.slice(2)]
      )).rows[0].n)
    : null;
  const group = async (by: string, label: string) => {
    const g = new Map<string, { units: number; revenue: number }>();
    for (const r of sold) {
      const k = (r as any)[by];
      const v = g.get(k) || { units: 0, revenue: 0 };
      g.set(k, { units: v.units + r.units, revenue: round2(v.revenue + r.revenue) });
    }
    return {
      title: label,
      columns: [
        { key: 'name', label: heading(label) },
        { key: 'units', label: 'Units', format: 'number' as const, align: 'right' as const },
        { key: 'revenue', label: 'Revenue', format: 'money' as const, align: 'right' as const },
        { key: 'share', label: 'Share', format: 'percent' as const, align: 'right' as const },
      ],
      rows: [...g.entries()]
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .map(([name, v]) => ({ name, ...v, share: pct(v.revenue, revenue) })),
    };
  };
  const variants = (await query(
    `SELECT pr.name, oi.options, sum(oi.quantity)::int AS units, sum(oi.total) AS revenue
     FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products pr ON pr.id = oi.product_id
     WHERE ${VALID} AND ${inRange('o.placed_at', '$1', '$2')} AND oi.options <> '{}'::jsonb ${where}
     GROUP BY 1, 2 ORDER BY 3 DESC`,
    params
  )).rows;
  const productColumns = [
    { key: 'name', label: 'Product' },
    { key: 'views', label: 'Views', format: 'number' as const, align: 'right' as const },
    { key: 'orders', label: 'Orders', format: 'number' as const, align: 'right' as const },
    { key: 'conversion', label: 'Views → orders', format: 'percent' as const, align: 'right' as const },
  ];
  return {
    period: p.out,
    cards: [
      card('units', 'Units sold', units, 'number', prevUnits),
      card('revenue', 'Product revenue', revenue, 'money', undefined, { hint: 'Item totals, after sale prices' }),
      card('products', 'Products sold', sold.length, 'number', undefined, { hint: `of ${rows.length} in the list` }),
      card('conversion', 'Views → orders', pct(orders, views), 'percent', undefined, { hint: `${views.toLocaleString()} product views` }),
      card('not_selling', 'No sales', rows.length - sold.length, 'number', undefined, { hint: 'Published products with no sales in the period', inverse: true }),
    ],
    table: {
      title: 'Products',
      columns: [
        { key: 'name', label: 'Product' },
        { key: 'category', label: 'Category' },
        { key: 'units', label: 'Units', format: 'number', align: 'right' },
        { key: 'revenue', label: 'Revenue', format: 'money', align: 'right' },
        { key: 'views', label: 'Views', format: 'number', align: 'right' },
        { key: 'conversion', label: 'Views → orders', format: 'percent', align: 'right' },
        { key: 'return_rate', label: 'Returned', format: 'percent', align: 'right' },
        { key: 'margin', label: 'Margin', format: 'percent', align: 'right' },
        { key: 'stock', label: 'In stock', format: 'number', align: 'right' },
      ],
      rows,
      empty: 'No products match.',
    },
    breakdowns: [
      await group('category', 'By category'),
      await group('brand', 'By brand'),
      {
        title: 'Top variants',
        columns: [
          { key: 'name', label: 'Variant' },
          { key: 'units', label: 'Units', format: 'number', align: 'right' },
          { key: 'revenue', label: 'Revenue', format: 'money', align: 'right' },
        ],
        rows: variants.map((v) => ({
          name: `${v.name} · ${Object.values(v.options as Record<string, string>).join(' / ')}`,
          units: v.units,
          revenue: round2(num(v.revenue)),
        })),
        empty: 'No variants sold.',
      },
      {
        title: 'Viewed but rarely bought',
        columns: productColumns,
        rows: rows
          .filter((r) => r.views >= 10 && r.conversion < 2)
          .sort((a, b) => b.views - a.views),
        empty: 'Nothing stands out.',
      },
      {
        title: 'No sales in this period',
        columns: [
          { key: 'name', label: 'Product' },
          { key: 'views', label: 'Views', format: 'number', align: 'right' },
          { key: 'stock', label: 'In stock', format: 'number', align: 'right' },
        ],
        rows: rows.filter((r) => r.units === 0).sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0)),
        empty: 'Every product sold.',
      },
    ],
  };
};

// ---------- Inventory ----------

const REASONS: Record<string, string> = {
  initial: 'Opening stock',
  sale: 'Sold',
  cancelled: 'Order cancelled',
  returned: 'Returned',
  order_edit: 'Order changed',
  adjustment: 'Adjusted by staff',
};

export const inventoryReport = async (p: Period, f: { product?: number }): Promise<Report> => {
  // One row per stocked thing: a variant, or a product without variants.
  const rows = (await query(
    `WITH items AS (
       SELECT pr.id AS product_id, v.id AS variant_id, pr.name, v.options, v.quantity AS stock,
         COALESCE(v.special, v.price, pr.special, pr.price) AS unit_price, COALESCE(v.cost_price, pr.cost_price) AS unit_cost,
         pr.low_stock_threshold AS threshold
       FROM product_variants v JOIN products pr ON pr.id = v.product_id WHERE pr.track_inventory
       UNION ALL
       SELECT pr.id, NULL, pr.name, '{}'::jsonb, pr.quantity, COALESCE(pr.special, pr.price), pr.cost_price, pr.low_stock_threshold
       FROM products pr WHERE pr.track_inventory AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = pr.id)),
     sold AS (
       SELECT oi.product_id, oi.variant_id, sum(oi.quantity)::int AS units, max(o.placed_at) AS last_sale
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE ${VALID} AND ${inRange('o.placed_at', '$1', '$2')} GROUP BY 1, 2),
     last AS (
       SELECT oi.product_id, oi.variant_id, max(o.placed_at) AS last_sale
       FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE ${VALID} GROUP BY 1, 2)
     SELECT i.*, COALESCE(s.units, 0) AS units, l.last_sale
     FROM items i
     LEFT JOIN sold s ON s.product_id = i.product_id AND s.variant_id IS NOT DISTINCT FROM i.variant_id
     LEFT JOIN last l ON l.product_id = i.product_id AND l.variant_id IS NOT DISTINCT FROM i.variant_id
     ${f.product ? 'WHERE i.product_id = $3' : ''}`,
    f.product ? [p.from, p.to, f.product] : [p.from, p.to]
  )).rows.map((r) => {
    const perDay = r.units / p.out.days;
    const daysLeft = r.stock <= 0 ? 0 : perDay > 0 ? Math.round(r.stock / perDay) : null;
    const status = r.stock <= 0 ? 'Out of stock' : r.stock <= r.threshold ? 'Low' : r.units === 0 ? 'Not selling' : 'OK';
    return {
      product_id: r.product_id,
      name: `${r.name}${Object.keys(r.options || {}).length ? ` · ${Object.values(r.options).join(' / ')}` : ''}`,
      stock: r.stock,
      units: r.units,
      per_week: round2(perDay * 7),
      days_left: daysLeft,
      value: round2(Math.max(r.stock, 0) * num(r.unit_price)),
      cost_value: r.unit_cost === null ? null : round2(Math.max(r.stock, 0) * num(r.unit_cost)),
      status,
      last_sale: r.last_sale,
      link: `/admin/reports/inventory?product=${r.product_id}`,
    };
  });
  // Most urgent first: out of stock, then fewest days left.
  const rank = (r: any) => (r.stock <= 0 ? -1 : r.days_left ?? 1e9);
  rows.sort((a, b) => rank(a) - rank(b) || b.units - a.units);
  const moves = (await query(
    `SELECT reason, sum(change) FILTER (WHERE change > 0)::int AS units_in, -sum(change) FILTER (WHERE change < 0)::int AS units_out
     FROM stock_movements WHERE ${inRange('created_at', '$1', '$2')} ${f.product ? 'AND product_id = $3' : ''} GROUP BY 1`,
    f.product ? [p.from, p.to, f.product] : [p.from, p.to]
  )).rows;
  const history = (await query(
    `SELECT m.created_at, pr.name, v.options, m.reason, m.change, m.quantity_after, o.number AS order_number, m.order_id,
       NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), '') AS by
     FROM stock_movements m JOIN products pr ON pr.id = m.product_id
     LEFT JOIN product_variants v ON v.id = m.variant_id LEFT JOIN orders o ON o.id = m.order_id
     LEFT JOIN users u ON u.id = m.user_id
     WHERE ${inRange('m.created_at', '$1', '$2')} ${f.product ? 'AND m.product_id = $3' : ''}
     ORDER BY m.id DESC LIMIT 1000`,
    f.product ? [p.from, p.to, f.product] : [p.from, p.to]
  )).rows;
  const tracked = rows.length;
  const out = rows.filter((r) => r.stock <= 0).length;
  const low = rows.filter((r) => r.status === 'Low').length;
  const slow = rows.filter((r) => r.stock > 0 && r.units === 0).length;
  const value = rows.reduce((s, r) => s + r.value, 0);
  const costKnown = rows.filter((r) => r.cost_value !== null);
  const cards: Card[] = [
    card('value', 'Stock value', value, 'money', undefined, { hint: 'At today’s selling prices' }),
    card('units', 'Units in stock', rows.reduce((s, r) => s + Math.max(r.stock, 0), 0), 'number'),
    card('out', 'Out of stock', out, 'number', undefined, { hint: `of ${tracked} items`, inverse: true }),
    card('low', 'Low stock', low, 'number', undefined, { hint: 'At or below the alert level', inverse: true }),
    card('slow', 'Not selling', slow, 'number', undefined, { hint: 'In stock, no sales in the period', inverse: true }),
  ];
  if (costKnown.length) {
    cards.splice(1, 0, card('cost_value', 'Stock at cost', costKnown.reduce((s, r) => s + (r.cost_value || 0), 0), 'money', undefined, {
      hint: `${costKnown.length} of ${tracked} items have a cost price`,
    }));
  }
  return {
    period: p.out,
    cards,
    table: {
      title: f.product ? 'Stock' : 'Stock by item (most urgent first)',
      columns: [
        { key: 'name', label: 'Item' },
        { key: 'status', label: 'Status' },
        { key: 'stock', label: 'In stock', format: 'number', align: 'right' },
        { key: 'per_week', label: 'Sold / week', format: 'number', align: 'right' },
        { key: 'days_left', label: 'Days left', format: 'number', align: 'right' },
        { key: 'value', label: 'Value', format: 'money', align: 'right' },
        { key: 'last_sale', label: 'Last sale', format: 'date' },
      ],
      rows,
      empty: 'No products track stock.',
    },
    breakdowns: [
      {
        title: 'Stock movements in the period',
        columns: [
          { key: 'name', label: 'Reason' },
          { key: 'units_in', label: 'Units in', format: 'number', align: 'right' },
          { key: 'units_out', label: 'Units out', format: 'number', align: 'right' },
        ],
        rows: moves.map((m) => ({ name: REASONS[m.reason] || m.reason, units_in: m.units_in || 0, units_out: m.units_out || 0 })),
        empty: 'No stock moved.',
      },
      {
        title: f.product ? 'Stock history' : 'Stock movements',
        columns: [
          { key: 'date', label: 'When', format: 'date' },
          { key: 'name', label: 'Item' },
          { key: 'reason', label: 'Why' },
          { key: 'change', label: 'Change', format: 'number', align: 'right' },
          { key: 'after', label: 'Then in stock', format: 'number', align: 'right' },
          { key: 'by', label: 'Order / by' },
        ],
        rows: history.map((h) => ({
          date: h.created_at,
          name: `${h.name}${h.options && Object.keys(h.options).length ? ` · ${Object.values(h.options).join(' / ')}` : ''}`,
          reason: REASONS[h.reason] || h.reason,
          change: h.change,
          after: h.quantity_after,
          by: [h.order_number, h.by].filter(Boolean).join(' · ') || '—',
          link: h.order_id ? `/admin/orders/${h.order_id}` : undefined,
        })),
        empty: 'No stock moved.',
      },
    ],
  };
};
