// src/lib/orders.ts — order statuses, loading and contract shapes.
import { orderSla } from './sla';
import { config } from '../config';
import { query } from '../db';
import { returnStock } from './products';

export const ORDER_STATUSES = [
  { code: 'awaiting_payment', name: 'Awaiting payment' },
  { code: 'pending', name: 'Pending' },
  { code: 'processing', name: 'Processing' },
  { code: 'shipped', name: 'Shipped' },
  { code: 'delivered', name: 'Delivered' },
  { code: 'cancelled', name: 'Cancelled' },
  { code: 'refunded', name: 'Refunded' },
] as const;

export const statusName = (code: string) =>
  ORDER_STATUSES.find((s) => s.code === code)?.name || code;

/** Which status an admin may move an order to from its current status. */
export const NEXT_STATUSES: Record<string, string[]> = {
  awaiting_payment: ['cancelled'],
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export const RETURN_REASONS = [
  { code: 'damaged', name: 'Arrived damaged' },
  { code: 'wrong_item', name: 'Wrong item sent' },
  { code: 'not_as_described', name: 'Not as described' },
  { code: 'no_longer_needed', name: 'No longer needed' },
  { code: 'other', name: 'Other' },
];

export const orderLink = (id: number) => `${config.frontendUrl.replace(/\/$/, '')}/account/orders/${id}`;

type Db = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

export const addHistory = (
  db: Db,
  orderId: number,
  status: string,
  comment = '',
  { notified = false, userId = null as number | null } = {}
) =>
  db.query(
    'INSERT INTO order_history (order_id, status, comment, notified, user_id) VALUES ($1, $2, $3, $4, $5)',
    [orderId, status, comment, notified, userId]
  );

const n = (v: unknown) => Number(v);

/** A URL’s order: its number (WEB-1FT3K9X7Q) or, for older links, its id. */
export const orderRef = (raw: string): number | string => (/^\d+$/.test(raw) ? Number(raw) : raw.trim().toUpperCase());

export const toContractOrder = (o: any, items: any[] = [], history: any[] = [], { admin = false } = {}) => ({
  order_id: o.id,
  order_number: o.number || String(o.id),
  invoice_number: o.invoice_number ?? undefined,
  status: o.status,
  status_name: statusName(o.status),
  email: o.email,
  ...(admin ? { customer: { customer_id: o.user_id, name: o.customer_name || '' } } : {}),
  payment_method: o.payment_method,
  payment_status: o.payment_status,
  shipping_method: o.shipping_method,
  shipping_address: o.shipping_address,
  payment_address: o.payment_address,
  coupon: o.coupon_code,
  totals: {
    subtotal: n(o.subtotal),
    discount: n(o.discount),
    shipping: n(o.shipping_total),
    gift: n(o.gift_total || 0),
    tax: n(o.tax_total),
    total: n(o.total),
  },
  total: n(o.total),
  currency: o.currency,
  comment: o.comment,
  item_count: items.length ? items.reduce((s, i) => s + i.quantity, 0) : o.item_count ?? undefined,
  products: items.map((i) => ({
    order_product_id: i.id,
    product_id: i.product_id,
    variant_id: i.variant_id ?? null,
    name: i.name,
    image: i.image,
    options: i.options,
    sku: i.sku || null,
    quantity: i.quantity,
    price: n(i.unit_price),
    total: n(i.total),
    // Sent as a gift: staff also see whether it's been prepared for dispatch.
    gift: i.gift
      ? {
          to: i.gift.to,
          from: i.gift.from,
          message: i.gift.message || '',
          // Older orders stored only "gift_box: true".
          box: i.gift.box || (i.gift.gift_box ? { id: 'box', name: 'Gift box', price: null, image: '' } : null),
          ...(admin ? { done: !!i.gift.done, done_at: i.gift.done_at || null, done_by: i.gift.done_by || null } : {}),
        }
      : null,
  })),
  ...(admin ? { next_statuses: NEXT_STATUSES[o.status] || [] } : {}),
  history: history
    // Customers see status changes, and only comments that were sent to them.
    .map((h) => ({
      status: h.status,
      status_name: statusName(h.status),
      comment: admin || h.notified ? h.comment : '',
      date_added: h.created_at,
      ...(admin ? { notified: h.notified } : {}),
    })),
  date_added: o.placed_at || o.created_at,
  date_modified: o.updated_at,
});

const REFUND_HOW: Record<string, [string, string]> = {
  stripe: ['to the card', 'to your card'],
  mpesa: ['by M-Pesa', 'by M-Pesa'],
  bank: ['by bank transfer', 'by bank transfer'],
  cash: ['in cash', 'in cash'],
  cod: ['in cash', 'in cash'],
};

/** Timeline entries for one refund; customers see only what reaches them. */
export const refundEvents = (r: any, currency: string, admin: boolean) => {
  const money = `${currency} ${Number(r.amount).toFixed(2)}`;
  const how = (REFUND_HOW[r.method] || ['', ''])[admin ? 0 : 1];
  const ref = r.reference ? ` · Ref ${r.reference}` : '';
  const event = (status: string, name: string, comment: string, date: Date) => ({
    status, status_name: name, comment, date_added: date, kind: 'refund',
  });
  if (!admin) {
    if (r.status === 'rejected') return [];
    const out = [event('refund_started', 'Refund started', `We’re refunding ${money}${how ? ` ${how}` : ''}.`, r.created_at)];
    if (r.status === 'processed' && r.processed_at) {
      out.push(event('refund_paid', 'Refunded', `${money} paid back${how ? ` ${how}` : ''}${ref}.`, r.processed_at));
    }
    return out;
  }
  const by = (name: string | null) => (name ? ` by ${name}` : '');
  const reason = r.reason ? ` Reason: ${r.reason}` : '';
  const out = [
    r.needs_approval
      ? event('refund_requested', 'Approval requested', `Refund of ${money} raised${by(r.requested_by_name)}, waiting for approval.${reason}`, r.created_at)
      : event('refund_raised', 'Refund raised', `Refund of ${money}${by(r.requested_by_name)}.${reason}`, r.created_at),
  ];
  if (r.needs_approval && r.decided_at) {
    out.push(r.status === 'rejected'
      ? event('refund_rejected', 'Refund rejected', `Refund of ${money} not approved${by(r.approved_by_name)}.`, r.decided_at)
      : event('refund_approved', 'Refund approved', `Refund of ${money} approved${by(r.approved_by_name)}.`, r.decided_at));
  }
  if (r.status === 'processed' && r.processed_at) {
    out.push(event('refund_paid', 'Refund paid', `${money} paid back${how ? ` ${how}` : ''}${ref}.`, r.processed_at));
  }
  if (r.status === 'failed') {
    out.push(event('refund_failed', 'Refund failed', `Paying back ${money}${how ? ` ${how}` : ''} didn’t go through.`, r.decided_at || r.created_at));
  }
  return out;
};

export const loadOrder = async (
  id: number | string,
  { userId, admin = false }: { userId?: number; admin?: boolean } = {}
) => {
  const params: unknown[] = [id];
  let filter = typeof id === 'number' ? 'o.id = $1' : 'o.number = $1';
  if (userId !== undefined) {
    params.push(userId);
    filter += ' AND o.user_id = $2 AND o.placed_at IS NOT NULL';
  }
  const order = (
    await query(
      `SELECT o.*, TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')) AS customer_name,
         (SELECT number FROM invoices WHERE order_id = o.id) AS invoice_number
       FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE ${filter}`,
      params
    )
  ).rows[0];
  if (!order) return null;
  // With the SKU of what was bought (the variant's, else the product's).
  const items = (
    await query(
      `SELECT oi.*, COALESCE(v.sku, p.sku) AS sku FROM order_items oi
       LEFT JOIN product_variants v ON v.id = oi.variant_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1 ORDER BY oi.id`,
      [order.id]
    )
  ).rows;
  const history = (
    await query(
      `SELECT h.*, NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), '') AS user_name
       FROM order_history h LEFT JOIN users u ON u.id = h.user_id
       WHERE h.order_id = $1 ORDER BY h.created_at, h.id`,
      [order.id]
    )
  ).rows;
  const contract = toContractOrder(order, items, history, { admin });
  // Refunds join the timeline: raised, approval asked for, approved or rejected, paid.
  const refunds = (
    await query(
      `SELECT r.*, NULLIF(TRIM(COALESCE(q.firstname, '') || ' ' || COALESCE(q.lastname, '')), '') AS requested_by_name,
         NULLIF(TRIM(COALESCE(a.firstname, '') || ' ' || COALESCE(a.lastname, '')), '') AS approved_by_name
       FROM refunds r LEFT JOIN users q ON q.id = r.requested_by LEFT JOIN users a ON a.id = r.approved_by
       WHERE r.order_id = $1`,
      [order.id]
    )
  ).rows;
  contract.history = [...contract.history, ...refunds.flatMap((r) => refundEvents(r, order.currency, admin))].sort(
    (a, b) => new Date(a.date_added).getTime() - new Date(b.date_added).getTime()
  );
  // Staff see how the order is doing against the fulfilment targets.
  return { order, items, history, contract: admin ? { ...contract, sla: orderSla(order, history) } : contract };
};

/** Puts stock back for every line of an order (cancellations). */
export const restock = returnStock;
