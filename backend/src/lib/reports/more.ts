// src/lib/reports/more.ts — Customers, Promotions, Returns & service,
// Finance and Search reports.
import { query } from '../../db';
import { finance } from '../finance';
import { RETURN_REASONS } from '../orders';
import { SUPPORT_CATEGORIES } from '../../routes/support';
import { bucketOf, buckets, Card, change, fill, inRange, num, pct, Period, Report, round2 } from './common';

const VALID = `o.placed_at IS NOT NULL AND o.status <> 'cancelled'`;
const card = (key: string, label: string, value: number, format: Card['format'], prev?: number | null, extra: Partial<Card> = {}): Card => ({
  key,
  label,
  value: round2(value),
  format,
  change: format === 'percent' ? (prev === null || prev === undefined ? null : round2(value - prev)) : change(value, prev),
  compare: prev === undefined || prev === null ? null : round2(prev),
  ...extra,
});
const hoursBetween = (a: string, b: string) => `extract(epoch FROM (${b} - ${a})) / 3600`;

// ---------- Customers ----------

const customerTotals = async (from: string, to: string) => {
  const r = (await query(
    `WITH buyers AS (
       SELECT o.user_id, count(*)::int AS orders, sum(o.total) AS spent,
         (SELECT min(placed_at) FROM orders f WHERE f.user_id = o.user_id AND f.placed_at IS NOT NULL AND f.status <> 'cancelled') AS first_order
       FROM orders o WHERE ${VALID} AND o.user_id IS NOT NULL AND ${inRange('o.placed_at', '$1', '$2')} GROUP BY 1)
     SELECT count(*)::int AS buyers,
       count(*) FILTER (WHERE ${inRange('first_order', '$1', '$2')})::int AS first_time,
       count(*) FILTER (WHERE orders > 1)::int AS ordered_twice,
       COALESCE(sum(spent), 0) AS spent,
       (SELECT count(*)::int FROM users u JOIN roles ro ON ro.id = u.role_id
         WHERE ro.code = 'customer' AND ${inRange('u.created_at', '$1', '$2')}) AS signups,
       (SELECT count(*)::int FROM users u JOIN roles ro ON ro.id = u.role_id
         WHERE ro.code = 'customer' AND ${inRange('u.created_at', '$1', '$2')}
           AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.placed_at IS NOT NULL)) AS never_ordered
     FROM buyers`,
    [from, to]
  )).rows[0];
  return {
    buyers: r.buyers,
    firstTime: r.first_time,
    returning: r.buyers - r.first_time,
    spent: num(r.spent),
    perCustomer: r.buyers ? round2(num(r.spent) / r.buyers) : 0,
    signups: r.signups,
    neverOrdered: r.never_ordered,
    returningShare: pct(r.buyers - r.first_time, r.buyers),
  };
};

export const customersReport = async (p: Period): Promise<Report> => {
  const cur = await customerTotals(p.from, p.to);
  const prev = p.compare ? await customerTotals(p.compare.from, p.compare.to) : null;
  // All-time repeat rate: customers with two or more orders.
  const repeat = (await query(
    `SELECT count(*)::int AS buyers, count(*) FILTER (WHERE n > 1)::int AS repeat
     FROM (SELECT user_id, count(*) AS n FROM orders o WHERE ${VALID} AND user_id IS NOT NULL GROUP BY 1) s`
  )).rows[0];
  const labels = buckets(p, p.group);
  const series = (await query(
    `SELECT ${bucketOf('o.placed_at', p.group)} AS bucket,
       count(DISTINCT o.user_id) FILTER (WHERE o.placed_at = (SELECT min(placed_at) FROM orders f
         WHERE f.user_id = o.user_id AND f.placed_at IS NOT NULL AND f.status <> 'cancelled'))::int AS first_time,
       count(DISTINCT o.user_id)::int AS buyers
     FROM orders o WHERE ${VALID} AND o.user_id IS NOT NULL AND ${inRange('o.placed_at', '$1', '$2')} GROUP BY 1`,
    [p.from, p.to]
  )).rows;
  const top = (await query(
    `SELECT u.id, TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')) AS name, u.email,
       count(*)::int AS orders, sum(o.total) AS spent, max(o.placed_at) AS last_order,
       (SELECT count(*)::int FROM orders a WHERE a.user_id = u.id AND a.placed_at IS NOT NULL AND a.status <> 'cancelled') AS lifetime
     FROM orders o JOIN users u ON u.id = o.user_id
     WHERE ${VALID} AND ${inRange('o.placed_at', '$1', '$2')} GROUP BY u.id ORDER BY spent DESC`,
    [p.from, p.to]
  )).rows;
  const places = (await query(
    `SELECT initcap(trim(o.shipping_address->>'city')) AS city, count(DISTINCT o.user_id)::int AS customers,
       count(*)::int AS orders, sum(o.total) AS sales
     FROM orders o WHERE ${VALID} AND ${inRange('o.placed_at', '$1', '$2')}
     GROUP BY 1 ORDER BY sales DESC`,
    [p.from, p.to]
  )).rows;
  const fresh = fill(labels, series, 'first_time');
  const all = fill(labels, series, 'buyers');
  return {
    period: p.out,
    cards: [
      card('buyers', 'Customers who ordered', cur.buyers, 'number', prev?.buyers),
      card('first_time', 'First-time buyers', cur.firstTime, 'number', prev?.firstTime),
      card('returning', 'Returning buyers', cur.returning, 'number', prev?.returning, { hint: `${cur.returningShare}% of buyers` }),
      card('per_customer', 'Spend per customer', cur.perCustomer, 'money', prev?.perCustomer),
      card('signups', 'New sign-ups', cur.signups, 'number', prev?.signups),
      card('never', 'Signed up, no order yet', cur.neverOrdered, 'number', prev?.neverOrdered, { inverse: true, hint: 'Of the sign-ups in the period' }),
      card('repeat', 'Repeat customers (all time)', pct(repeat.repeat, repeat.buyers), 'percent', undefined, {
        hint: `${repeat.repeat} of ${repeat.buyers} buyers ordered more than once`,
      }),
    ],
    series: {
      labels,
      datasets: [
        { key: 'first_time', label: 'First-time buyers', format: 'number', values: fresh },
        { key: 'returning', label: 'Returning buyers', format: 'number', values: all.map((v, i) => v - fresh[i]) },
      ],
    },
    table: {
      title: 'Top customers',
      columns: [
        { key: 'name', label: 'Customer' },
        { key: 'orders', label: 'Orders', format: 'number', align: 'right' },
        { key: 'spent', label: 'Spent', format: 'money', align: 'right' },
        { key: 'lifetime', label: 'Orders ever', format: 'number', align: 'right' },
        { key: 'last_order', label: 'Last order', format: 'date' },
      ],
      rows: top.map((t) => ({ name: t.name || t.email, orders: t.orders, spent: round2(num(t.spent)), lifetime: t.lifetime, last_order: t.last_order, link: `/admin/users/${t.id}` })),
      empty: 'No customer orders in this period.',
    },
    breakdowns: [
      {
        title: 'By town',
        columns: [
          { key: 'name', label: 'Town' },
          { key: 'customers', label: 'Customers', format: 'number', align: 'right' },
          { key: 'orders', label: 'Orders', format: 'number', align: 'right' },
          { key: 'sales', label: 'Sales', format: 'money', align: 'right' },
        ],
        rows: places.map((r) => ({ name: r.city || 'Unknown', customers: r.customers, orders: r.orders, sales: round2(num(r.sales)) })),
        empty: 'No orders in this period.',
      },
    ],
  };
};

// ---------- Promotions ----------

export const promotionsReport = async (p: Period): Promise<Report> => {
  const totals = async (from: string, to: string) =>
    (await query(
      `SELECT count(*)::int AS orders, count(*) FILTER (WHERE o.coupon_code IS NOT NULL)::int AS with_code,
         COALESCE(sum(o.discount), 0) AS discount, COALESCE(sum(o.total) FILTER (WHERE o.coupon_code IS NOT NULL), 0) AS code_sales,
         COALESCE(avg(o.total) FILTER (WHERE o.coupon_code IS NOT NULL), 0) AS aov_code,
         COALESCE(avg(o.total) FILTER (WHERE o.coupon_code IS NULL), 0) AS aov_plain
       FROM orders o WHERE ${VALID} AND ${inRange('o.placed_at', '$1', '$2')}`,
      [from, to]
    )).rows[0];
  const cur = await totals(p.from, p.to);
  const prev = p.compare ? await totals(p.compare.from, p.compare.to) : null;
  const codes = (await query(
    `SELECT o.coupon_code AS code, c.audience, count(*)::int AS uses, count(DISTINCT o.user_id)::int AS customers,
       sum(o.discount) AS discount, sum(o.total) AS sales, avg(o.total) AS aov
     FROM orders o LEFT JOIN coupons c ON c.code = o.coupon_code
     WHERE ${VALID} AND o.coupon_code IS NOT NULL AND ${inRange('o.placed_at', '$1', '$2')}
     GROUP BY 1, 2 ORDER BY sales DESC`,
    [p.from, p.to]
  )).rows;
  // Customers whose first order used a code: did they order again?
  const followUp = (await query(
    `WITH firsts AS (
       SELECT DISTINCT ON (o.user_id) o.user_id, o.coupon_code, o.placed_at
       FROM orders o WHERE ${VALID} AND o.user_id IS NOT NULL ORDER BY o.user_id, o.placed_at)
     SELECT f.coupon_code AS code, count(*)::int AS first_orders,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM orders o2 WHERE o2.user_id = f.user_id
         AND o2.placed_at > f.placed_at AND o2.status <> 'cancelled'))::int AS came_back
     FROM firsts f WHERE f.coupon_code IS NOT NULL AND ${inRange('f.placed_at', '$1', '$2')} GROUP BY 1 ORDER BY 2 DESC`,
    [p.from, p.to]
  )).rows;
  const labels = buckets(p, p.group);
  const series = (await query(
    `SELECT ${bucketOf('o.placed_at', p.group)} AS bucket, count(*) FILTER (WHERE o.coupon_code IS NOT NULL)::int AS uses,
       COALESCE(sum(o.discount), 0) AS discount
     FROM orders o WHERE ${VALID} AND ${inRange('o.placed_at', '$1', '$2')} GROUP BY 1`,
    [p.from, p.to]
  )).rows;
  const share = pct(cur.with_code, cur.orders);
  // Deals (top strip and home banner): views, clicks, and what their codes sold.
  const dealTotals = async (from: string, to: string) =>
    (await query(
      `SELECT count(*) FILTER (WHERE kind = 'view')::int AS views, count(*) FILTER (WHERE kind = 'click')::int AS clicks
       FROM promotion_events WHERE day BETWEEN $1::date AND $2::date`,
      [from, to]
    )).rows[0];
  const dealsNow = await dealTotals(p.from, p.to);
  const dealsBefore = p.compare ? await dealTotals(p.compare.from, p.compare.to) : null;
  const deals = (await query(
    `SELECT pr.id, pr.title, pr.placement, pr.code,
       count(e.*) FILTER (WHERE e.kind = 'view')::int AS views,
       count(e.*) FILTER (WHERE e.kind = 'click')::int AS clicks,
       count(e.*) FILTER (WHERE e.kind = 'click' AND e.placement = 'strip')::int AS strip_clicks,
       count(e.*) FILTER (WHERE e.kind = 'click' AND e.placement = 'banner')::int AS banner_clicks,
       (SELECT count(*)::int FROM orders o WHERE pr.code IS NOT NULL AND o.coupon_code = pr.code
          AND ${VALID} AND ${inRange('o.placed_at', '$1', '$2')}) AS code_orders,
       (SELECT COALESCE(sum(o.total), 0) FROM orders o WHERE pr.code IS NOT NULL AND o.coupon_code = pr.code
          AND ${VALID} AND ${inRange('o.placed_at', '$1', '$2')}) AS code_sales
     FROM promotions pr
     LEFT JOIN promotion_events e ON e.promotion_id = pr.id AND e.day BETWEEN $1::date AND $2::date
     GROUP BY pr.id ORDER BY count(e.*) FILTER (WHERE e.kind = 'click') DESC, pr.position`,
    [p.from, p.to]
  )).rows;
  const PLACES: Record<string, string> = { strip: 'Top strip', banner: 'Home banner', both: 'Strip and banner' };
  return {
    period: p.out,
    cards: [
      card('with_code', 'Orders with a code', cur.with_code, 'number', prev?.with_code, { hint: `${share}% of orders` }),
      card('discount', 'Discount given', num(cur.discount), 'money', prev ? num(prev.discount) : null, { inverse: true }),
      card('code_sales', 'Sales with a code', num(cur.code_sales), 'money', prev ? num(prev.code_sales) : null),
      card('aov_code', 'Average order with a code', num(cur.aov_code), 'money', undefined, {
        hint: `Without a code: ${round2(num(cur.aov_plain)).toFixed(2)}`,
      }),
      card('deal_views', 'Deal views', dealsNow.views, 'number', dealsBefore?.views, {
        hint: 'Top strip and home banner, once per visitor a day',
      }),
      card('deal_clicks', 'Deal clicks', dealsNow.clicks, 'number', dealsBefore?.clicks, {
        hint: `${pct(dealsNow.clicks, dealsNow.views)}% of views`,
      }),
      card('return_rate', 'First-order code → came back', pct(
        followUp.reduce((s, r) => s + r.came_back, 0),
        followUp.reduce((s, r) => s + r.first_orders, 0)
      ), 'percent', undefined, { hint: 'Customers whose first order used a code and who ordered again' }),
    ],
    series: {
      labels,
      datasets: [
        { key: 'uses', label: 'Orders with a code', format: 'number', values: fill(labels, series, 'uses') },
        { key: 'discount', label: 'Discount given', format: 'money', values: fill(labels, series, 'discount') },
      ],
    },
    table: {
      title: 'By code',
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'uses', label: 'Uses', format: 'number', align: 'right' },
        { key: 'customers', label: 'Customers', format: 'number', align: 'right' },
        { key: 'discount', label: 'Discount', format: 'money', align: 'right' },
        { key: 'sales', label: 'Sales', format: 'money', align: 'right' },
        { key: 'aov', label: 'Average order', format: 'money', align: 'right' },
        { key: 'cost_share', label: 'Discount / sales', format: 'percent', align: 'right' },
      ],
      rows: codes.map((c) => ({
        code: c.code,
        uses: c.uses,
        customers: c.customers,
        discount: round2(num(c.discount)),
        sales: round2(num(c.sales)),
        aov: round2(num(c.aov)),
        cost_share: pct(num(c.discount), num(c.sales)),
        link: `/admin/promos/${encodeURIComponent(c.code)}`,
      })),
      empty: 'No promo codes were used in this period.',
    },
    breakdowns: [
      {
        title: 'Deals: views and clicks',
        columns: [
          { key: 'title', label: 'Deal' },
          { key: 'place', label: 'Shows in' },
          { key: 'views', label: 'Views', format: 'number', align: 'right' },
          { key: 'clicks', label: 'Clicks', format: 'number', align: 'right' },
          { key: 'rate', label: 'Click rate', format: 'percent', align: 'right' },
          { key: 'split', label: 'Clicks: strip / banner' },
          { key: 'code', label: 'Code' },
          { key: 'code_orders', label: 'Code orders', format: 'number', align: 'right' },
          { key: 'code_sales', label: 'Code sales', format: 'money', align: 'right' },
        ],
        rows: deals.map((d) => ({
          title: d.title,
          place: PLACES[d.placement] || d.placement,
          views: d.views,
          clicks: d.clicks,
          rate: pct(d.clicks, d.views),
          split: `${d.strip_clicks} / ${d.banner_clicks}`,
          code: d.code || '—',
          code_orders: d.code_orders,
          code_sales: round2(num(d.code_sales)),
          link: '/admin/settings?tab=home',
        })),
        empty: 'No deals yet. Add them in Store settings → Home page.',
      },
      {
        title: 'First orders with a code: did they come back?',
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'first_orders', label: 'First orders', format: 'number', align: 'right' },
          { key: 'came_back', label: 'Ordered again', format: 'number', align: 'right' },
          { key: 'rate', label: 'Came back', format: 'percent', align: 'right' },
        ],
        rows: followUp.map((r) => ({ ...r, rate: pct(r.came_back, r.first_orders) })),
        empty: 'No first orders used a code in this period.',
      },
    ],
  };
};

// ---------- Returns & service ----------

const REASON_NAMES: Record<string, string> = Object.fromEntries(RETURN_REASONS.map((r) => [r.code, r.name]));

export const serviceReport = async (p: Period): Promise<Report> => {
  const t = async (from: string, to: string) => {
    const r = (await query(
      `SELECT count(*)::int AS returns, COALESCE(sum(quantity), 0)::int AS units,
         count(*) FILTER (WHERE status = 'rejected')::int AS rejected,
         (SELECT COALESCE(sum(oi.quantity), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE ${VALID} AND ${inRange('o.placed_at', '$1', '$2')})::int AS sold
       FROM returns WHERE ${inRange('created_at', '$1', '$2')}`,
      [from, to]
    )).rows[0];
    const f = (await query(
      `SELECT COALESCE(sum(amount), 0) AS refunded, COALESCE(sum(restocking_fee), 0) AS fees, count(*)::int AS refunds
       FROM refunds WHERE status = 'processed' AND ${inRange('processed_at', '$1', '$2')}`,
      [from, to]
    )).rows[0];
    const speed = (await query(
      `SELECT avg(extract(epoch FROM (f.processed_at - r.created_at)) / 86400) AS days
       FROM returns r JOIN refunds f ON f.return_id = r.id AND f.status = 'processed'
       WHERE ${inRange('f.processed_at', '$1', '$2')}`,
      [from, to]
    )).rows[0];
    const s = (await query(
      `SELECT count(*)::int AS tickets,
         avg(${hoursBetween('t.created_at', `(SELECT min(m.created_at) FROM support_messages m WHERE m.ticket_id = t.id AND m.author = 'staff')`)}) AS first_reply,
         avg(${hoursBetween('t.created_at', 't.updated_at')}) FILTER (WHERE t.status IN ('resolved', 'closed')) AS resolution,
         count(*) FILTER (WHERE t.status IN ('open', 'waiting'))::int AS open
       FROM support_tickets t WHERE ${inRange('t.created_at', '$1', '$2')}`,
      [from, to]
    )).rows[0];
    return {
      returns: r.returns,
      units: r.units,
      rate: pct(r.units, r.sold),
      refunded: num(f.refunded),
      fees: num(f.fees),
      days: speed.days === null ? null : round2(num(speed.days)),
      tickets: s.tickets,
      firstReply: s.first_reply === null ? null : round2(num(s.first_reply)),
      resolution: s.resolution === null ? null : round2(num(s.resolution)),
      open: s.open,
    };
  };
  const cur = await t(p.from, p.to);
  const prev = p.compare ? await t(p.compare.from, p.compare.to) : null;
  const reasons = (await query(
    `SELECT reason, count(*)::int AS returns, sum(quantity)::int AS units FROM returns
     WHERE ${inRange('created_at', '$1', '$2')} GROUP BY 1 ORDER BY 2 DESC`,
    [p.from, p.to]
  )).rows;
  const products = (await query(
    `SELECT oi.product_id, pr.name, sum(r.quantity)::int AS returned,
       (SELECT COALESCE(sum(x.quantity), 0) FROM order_items x JOIN orders o ON o.id = x.order_id
         WHERE x.product_id = oi.product_id AND ${VALID} AND ${inRange('o.placed_at', '$1', '$2')})::int AS sold
     FROM returns r JOIN order_items oi ON oi.id = r.order_item_id JOIN products pr ON pr.id = oi.product_id
     WHERE ${inRange('r.created_at', '$1', '$2')} GROUP BY 1, 2 ORDER BY 3 DESC`,
    [p.from, p.to]
  )).rows;
  const topics = (await query(
    `SELECT t.category, count(*)::int AS tickets,
       avg(${hoursBetween('t.created_at', `(SELECT min(m.created_at) FROM support_messages m WHERE m.ticket_id = t.id AND m.author = 'staff')`)}) AS first_reply,
       count(*) FILTER (WHERE t.status IN ('open', 'waiting'))::int AS open
     FROM support_tickets t WHERE ${inRange('t.created_at', '$1', '$2')} GROUP BY 1 ORDER BY 2 DESC`,
    [p.from, p.to]
  )).rows;
  const labels = buckets(p, p.group);
  const series = (await query(
    `SELECT ${bucketOf('created_at', p.group)} AS bucket, count(*)::int AS returns FROM returns
     WHERE ${inRange('created_at', '$1', '$2')} GROUP BY 1`,
    [p.from, p.to]
  )).rows;
  const tickets = (await query(
    `SELECT ${bucketOf('created_at', p.group)} AS bucket, count(*)::int AS tickets FROM support_tickets
     WHERE ${inRange('created_at', '$1', '$2')} GROUP BY 1`,
    [p.from, p.to]
  )).rows;
  return {
    period: p.out,
    cards: [
      card('returns', 'Return requests', cur.returns, 'number', prev?.returns, { inverse: true }),
      card('rate', 'Return rate', cur.rate, 'percent', prev?.rate, { inverse: true, hint: 'Units returned / units sold' }),
      card('refunded', 'Refunded', cur.refunded, 'money', prev?.refunded, { inverse: true }),
      card('fees', 'Restocking fees kept', cur.fees, 'money', prev?.fees),
      card('days', 'Request → refund', cur.days ?? 0, 'days', prev?.days ?? null, { inverse: true, hint: cur.days === null ? 'No refunded returns yet' : 'Average' }),
      card('tickets', 'Support requests', cur.tickets, 'number', prev?.tickets, { hint: `${cur.open} still open` }),
      card('first_reply', 'First reply', cur.firstReply ?? 0, 'hours', prev?.firstReply ?? null, { inverse: true, hint: cur.firstReply === null ? 'No replies yet' : 'Average' }),
      card('resolution', 'Time to resolve', cur.resolution ?? 0, 'hours', prev?.resolution ?? null, { inverse: true, hint: cur.resolution === null ? 'None resolved yet' : 'Average' }),
    ],
    series: {
      labels,
      datasets: [
        { key: 'returns', label: 'Return requests', format: 'number', values: fill(labels, series, 'returns') },
        { key: 'tickets', label: 'Support requests', format: 'number', values: fill(labels, tickets, 'tickets') },
      ],
    },
    table: {
      title: 'Most returned products',
      columns: [
        { key: 'name', label: 'Product' },
        { key: 'returned', label: 'Returned', format: 'number', align: 'right' },
        { key: 'sold', label: 'Sold', format: 'number', align: 'right' },
        { key: 'rate', label: 'Return rate', format: 'percent', align: 'right' },
      ],
      rows: products.map((r) => ({ name: r.name, returned: r.returned, sold: r.sold, rate: pct(r.returned, r.sold), link: `/admin/returns?search=${encodeURIComponent(r.name)}` })),
      empty: 'No returns in this period.',
    },
    breakdowns: [
      {
        title: 'Why items come back',
        columns: [
          { key: 'name', label: 'Reason' },
          { key: 'returns', label: 'Returns', format: 'number', align: 'right' },
          { key: 'units', label: 'Units', format: 'number', align: 'right' },
        ],
        rows: reasons.map((r) => ({ name: REASON_NAMES[r.reason] || r.reason, returns: r.returns, units: r.units })),
        empty: 'No returns in this period.',
      },
      {
        title: 'Support by topic',
        columns: [
          { key: 'name', label: 'Topic' },
          { key: 'tickets', label: 'Requests', format: 'number', align: 'right' },
          { key: 'first_reply', label: 'First reply', format: 'hours', align: 'right' },
          { key: 'open', label: 'Still open', format: 'number', align: 'right' },
        ],
        rows: topics.map((r) => ({
          name: SUPPORT_CATEGORIES[r.category] || r.category,
          tickets: r.tickets,
          first_reply: r.first_reply === null ? null : round2(num(r.first_reply)),
          open: r.open,
        })),
        empty: 'No support requests in this period.',
      },
    ],
  };
};

// ---------- Finance ----------

const METHODS: Record<string, string> = { stripe: 'Card', cod: 'Cash on delivery', cash: 'Cash', mpesa: 'M-Pesa', bank: 'Bank transfer' };

export const financeReport = async (p: Period): Promise<Report> => {
  const aging = (await query(
    `SELECT CASE WHEN age < 31 THEN '0–30 days' WHEN age < 61 THEN '31–60 days' WHEN age < 91 THEN '61–90 days' ELSE 'Over 90 days' END AS bucket,
       count(*)::int AS invoices, sum(owed) AS owed
     FROM (SELECT (current_date - (i.issued_at AT TIME ZONE 'Africa/Nairobi')::date) AS age, i.total - i.amount_paid AS owed
           FROM invoices i WHERE i.status IN ('issued', 'partially_paid')) s
     GROUP BY 1 ORDER BY min(age)`
  )).rows;
  const owed = aging.reduce((s, r) => s + num(r.owed), 0);
  const overdue = num((await query(
    `SELECT COALESCE(sum(total - amount_paid), 0) AS n FROM invoices
     WHERE status IN ('issued', 'partially_paid') AND due_at IS NOT NULL AND due_at < now()`
  )).rows[0].n);
  const cod = (await query(
    `SELECT o.id, o.number, o.status, o.placed_at, i.total - i.amount_paid AS owed,
       TRIM(COALESCE(o.shipping_address->>'firstname', '') || ' ' || COALESCE(o.shipping_address->>'lastname', '')) AS name,
       o.shipping_address->>'city' AS city
     FROM orders o JOIN invoices i ON i.order_id = o.id
     WHERE o.payment_method = 'cod' AND o.status IN ('pending', 'processing', 'shipped')
       AND i.status IN ('issued', 'partially_paid') ORDER BY o.placed_at`
  )).rows;
  const payments = (await query(
    `SELECT (received_at AT TIME ZONE 'Africa/Nairobi')::date AS day, method,
       COALESCE(sum(amount) FILTER (WHERE kind = 'payment'), 0) AS received,
       COALESCE(sum(amount) FILTER (WHERE kind = 'refund'), 0) AS refunded, count(*)::int AS count
     FROM payments WHERE status = 'succeeded' AND ${inRange('received_at', '$1', '$2')}
     GROUP BY 1, 2 ORDER BY 1 DESC, 2`,
    [p.from, p.to]
  )).rows;
  const byMethod = new Map<string, { received: number; refunded: number; count: number }>();
  payments.forEach((r) => {
    const v = byMethod.get(r.method) || { received: 0, refunded: 0, count: 0 };
    byMethod.set(r.method, { received: v.received + num(r.received), refunded: v.refunded + num(r.refunded), count: v.count + r.count });
  });
  // VAT from the ledger: credited on sales, debited when refunded.
  const vat = (await query(
    `SELECT COALESCE(sum(credit), 0) AS output, COALESCE(sum(debit), 0) AS returned
     FROM ledger_entries WHERE account = 'vat_payable' AND ${inRange('occurred_at', '$1', '$2')}`,
    [p.from, p.to]
  )).rows[0];
  const vatNet = round2(num(vat.output) - num(vat.returned));
  const received = [...byMethod.values()].reduce((s, v) => s + v.received, 0);
  const { tax_label: taxLabel } = finance();
  return {
    period: p.out,
    cards: [
      card('owed', 'Owed to us', owed, 'money', undefined, { hint: `${aging.reduce((s, r) => s + r.invoices, 0)} unpaid invoices` }),
      card('overdue', 'Overdue', overdue, 'money', undefined, { inverse: true, hint: 'Past their due date' }),
      card('cod', 'Cash on delivery to collect', cod.reduce((s, r) => s + num(r.owed), 0), 'money', undefined, { hint: `${cod.length} orders on their way` }),
      card('received', 'Received in the period', received, 'money'),
      card('vat', `${taxLabel} due for the period`, vatNet, 'money', undefined, {
        hint: `${round2(num(vat.output)).toFixed(2)} on sales less ${round2(num(vat.returned)).toFixed(2)} on refunds`,
      }),
    ],
    table: {
      title: 'Payments by day and method (for matching statements)',
      columns: [
        { key: 'day', label: 'Day', format: 'date' },
        { key: 'method', label: 'Method' },
        { key: 'count', label: 'Payments', format: 'number', align: 'right' },
        { key: 'received', label: 'Received', format: 'money', align: 'right' },
        { key: 'refunded', label: 'Refunded', format: 'money', align: 'right' },
        { key: 'net', label: 'Net', format: 'money', align: 'right' },
      ],
      rows: payments.map((r) => ({
        day: r.day,
        method: METHODS[r.method] || r.method,
        count: r.count,
        received: round2(num(r.received)),
        refunded: round2(num(r.refunded)),
        net: round2(num(r.received) - num(r.refunded)),
        link: `/admin/payments?method=${r.method}`,
      })),
      empty: 'No payments in this period.',
    },
    breakdowns: [
      {
        title: 'Unpaid invoices by age',
        columns: [
          { key: 'name', label: 'Age' },
          { key: 'invoices', label: 'Invoices', format: 'number', align: 'right' },
          { key: 'owed', label: 'Owed', format: 'money', align: 'right' },
        ],
        rows: aging.map((r) => ({ name: r.bucket, invoices: r.invoices, owed: round2(num(r.owed)), link: '/admin/invoices?status=issued,partially_paid' })),
        empty: 'Nothing is owed.',
      },
      {
        title: 'By payment method',
        columns: [
          { key: 'name', label: 'Method' },
          { key: 'count', label: 'Payments', format: 'number', align: 'right' },
          { key: 'received', label: 'Received', format: 'money', align: 'right' },
          { key: 'refunded', label: 'Refunded', format: 'money', align: 'right' },
        ],
        rows: [...byMethod.entries()].map(([m, v]) => ({ name: METHODS[m] || m, count: v.count, received: round2(v.received), refunded: round2(v.refunded) })),
        empty: 'No payments in this period.',
      },
      {
        title: 'Cash on delivery to collect',
        columns: [
          { key: 'number', label: 'Order' },
          { key: 'name', label: 'Customer' },
          { key: 'city', label: 'Town' },
          { key: 'status', label: 'Status' },
          { key: 'owed', label: 'To collect', format: 'money', align: 'right' },
        ],
        rows: cod.map((r) => ({ number: r.number, name: r.name, city: r.city || '—', status: r.status, owed: round2(num(r.owed)), link: `/admin/orders/${r.id}` })),
        empty: 'Nothing to collect.',
      },
      {
        title: `${taxLabel} summary`,
        columns: [
          { key: 'name', label: '' },
          { key: 'amount', label: 'Amount', format: 'money', align: 'right' },
        ],
        rows: [
          { name: `${taxLabel} on sales`, amount: round2(num(vat.output)) },
          { name: `${taxLabel} on refunds`, amount: -round2(num(vat.returned)) },
          { name: `${taxLabel} due`, amount: vatNet },
        ],
      },
    ],
  };
};

// ---------- Search ----------

export const searchReport = async (p: Period): Promise<Report> => {
  const totals = async (from: string, to: string) =>
    (await query(
      `SELECT count(*)::int AS searches, count(*) FILTER (WHERE results = 0)::int AS empty,
         count(DISTINCT normalized)::int AS terms
       FROM search_queries WHERE ${inRange('created_at', '$1', '$2')}`,
      [from, to]
    )).rows[0];
  const cur = await totals(p.from, p.to);
  const prev = p.compare ? await totals(p.compare.from, p.compare.to) : null;
  const terms = (await query(
    `SELECT normalized AS term, count(*)::int AS searches, round(avg(results))::int AS results,
       count(*) FILTER (WHERE results = 0)::int AS empty, max(created_at) AS last
     FROM search_queries WHERE ${inRange('created_at', '$1', '$2')} GROUP BY 1 ORDER BY 2 DESC LIMIT 1000`,
    [p.from, p.to]
  )).rows;
  const labels = buckets(p, p.group);
  const series = (await query(
    `SELECT ${bucketOf('created_at', p.group)} AS bucket, count(*)::int AS searches, count(*) FILTER (WHERE results = 0)::int AS empty
     FROM search_queries WHERE ${inRange('created_at', '$1', '$2')} GROUP BY 1`,
    [p.from, p.to]
  )).rows;
  return {
    period: p.out,
    cards: [
      card('searches', 'Searches', cur.searches, 'number', prev?.searches),
      card('terms', 'Different searches', cur.terms, 'number', prev?.terms),
      card('empty', 'Found nothing', pct(cur.empty, cur.searches), 'percent', prev ? pct(prev.empty, prev.searches) : null, {
        inverse: true,
        hint: `${cur.empty} searches with no exact match`,
      }),
    ],
    series: {
      labels,
      datasets: [
        { key: 'searches', label: 'Searches', format: 'number', values: fill(labels, series, 'searches') },
        { key: 'empty', label: 'Found nothing', format: 'number', values: fill(labels, series, 'empty') },
      ],
    },
    table: {
      title: 'What shoppers search for',
      columns: [
        { key: 'term', label: 'Search' },
        { key: 'searches', label: 'Searches', format: 'number', align: 'right' },
        { key: 'results', label: 'Results', format: 'number', align: 'right' },
        { key: 'last', label: 'Last searched', format: 'date' },
      ],
      rows: terms.map((t) => ({ ...t, link: `/products?search=${encodeURIComponent(t.term)}` })),
      empty: 'No searches in this period.',
    },
    breakdowns: [
      {
        title: 'Searches that found nothing (stock ideas)',
        columns: [
          { key: 'term', label: 'Search' },
          { key: 'empty', label: 'Times', format: 'number', align: 'right' },
        ],
        rows: terms.filter((t) => t.empty > 0).sort((a, b) => b.empty - a.empty),
        empty: 'Every search found something.',
      },
    ],
  };
};
