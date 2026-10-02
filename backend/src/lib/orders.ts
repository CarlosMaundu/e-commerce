// src/lib/orders.ts — order statuses, loading and contract shapes.
import { config } from '../config';
import { query } from '../db';

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

export const toContractOrder = (o: any, items: any[] = [], history: any[] = [], { admin = false } = {}) => ({
  order_id: o.id,
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
    name: i.name,
    image: i.image,
    options: i.options,
    quantity: i.quantity,
    price: n(i.unit_price),
    total: n(i.total),
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

export const loadOrder = async (id: number, { userId, admin = false }: { userId?: number; admin?: boolean } = {}) => {
  const params: unknown[] = [id];
  let filter = 'o.id = $1';
  if (userId !== undefined) {
    params.push(userId);
    filter += ' AND o.user_id = $2 AND o.placed_at IS NOT NULL';
  }
  const order = (
    await query(
      `SELECT o.*, TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')) AS customer_name
       FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE ${filter}`,
      params
    )
  ).rows[0];
  if (!order) return null;
  const items = (await query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [id])).rows;
  const history = (
    await query('SELECT * FROM order_history WHERE order_id = $1 ORDER BY created_at, id', [id])
  ).rows;
  return { order, items, history, contract: toContractOrder(order, items, history, { admin }) };
};

/** Puts stock back for every line of an order (cancellations). */
export const restock = async (db: Db, orderId: number) => {
  await db.query(
    `UPDATE products p SET quantity = p.quantity + oi.quantity, updated_at = now()
     FROM order_items oi WHERE oi.order_id = $1 AND oi.product_id = p.id`,
    [orderId]
  );
};
