// src/lib/customerNotifications.ts — the shopper's bell: what happened to
// their orders, returns, refunds and support requests over the last 90 days.
// Like the back-office bell it is worked out from those records (nothing is
// stored per event); opening it marks everything read, and items can be
// dismissed or cleared (the same per-person state tables as staff use).
import { query } from '../db';

export interface CustomerNotification {
  key: string;
  kind: 'order' | 'return' | 'refund' | 'support';
  title: string;
  body: string;
  link: string;
  at: string;
}

const money = (n: unknown, currency: string) =>
  `${currency} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ORDER_TITLES: Record<string, (n: string) => string> = {
  pending: (n) => `Order ${n} placed`,
  processing: (n) => `Order ${n} is being prepared`,
  shipped: (n) => `Order ${n} is on its way`,
  delivered: (n) => `Order ${n} was delivered`,
  cancelled: (n) => `Order ${n} was cancelled`,
  refunded: (n) => `Order ${n} was refunded`,
};

const RETURN_TITLES: Record<string, string> = {
  requested: 'Return requested',
  approved: 'Return approved',
  received: 'We received your return',
  refund_pending: 'Your refund is being prepared',
  rejected: 'Return declined',
  refunded: 'Return refunded',
};

export const customerNotifications = async (userId: number, limit = 20) => {
  const state =
    (await query('SELECT read_at, cleared_at FROM staff_notification_state WHERE user_id = $1', [userId])).rows[0] || {};
  const dismissed = new Set(
    (await query('SELECT key FROM staff_notification_dismissals WHERE user_id = $1', [userId])).rows.map((r) => r.key)
  );
  const items: CustomerNotification[] = [];

  const orders = (
    await query(
      `SELECT h.id, h.status, h.created_at, o.id AS order_id, o.number, o.total, o.currency
       FROM order_history h JOIN orders o ON o.id = h.order_id
       WHERE o.user_id = $1 AND o.placed_at IS NOT NULL AND h.status <> 'awaiting_payment'
         AND h.created_at > now() - interval '90 days'
       ORDER BY h.created_at DESC LIMIT 60`,
      [userId]
    )
  ).rows;
  for (const h of orders) {
    const title = ORDER_TITLES[h.status];
    if (!title) continue;
    items.push({
      key: `order:${h.id}`,
      kind: 'order',
      title: title(h.number),
      body: h.status === 'pending' ? `Total ${money(h.total, h.currency)}.` : 'Tap to see your order.',
      link: `/account/orders/${h.order_id}`,
      at: h.created_at,
    });
  }

  const returns = (
    await query(
      `SELECT e.id, e.status, e.note, e.created_at, r.id AS return_id, oi.name
       FROM return_events e JOIN returns r ON r.id = e.return_id
       JOIN order_items oi ON oi.id = r.order_item_id
       WHERE r.user_id = $1 AND NOT e.internal AND e.created_at > now() - interval '90 days'
       ORDER BY e.created_at DESC LIMIT 40`,
      [userId]
    )
  ).rows;
  for (const e of returns) {
    const title = RETURN_TITLES[e.status];
    if (!title) continue;
    items.push({
      key: `return:${e.id}`,
      kind: 'return',
      title,
      body: e.note ? `${e.name}: ${e.note}` : e.name,
      link: `/account/returns/${e.return_id}`,
      at: e.created_at,
    });
  }

  const refunds = (
    await query(
      `SELECT f.id, f.amount, f.processed_at, o.number, o.currency
       FROM refunds f JOIN orders o ON o.id = f.order_id
       WHERE o.user_id = $1 AND f.status = 'processed' AND f.processed_at > now() - interval '90 days'
       ORDER BY f.processed_at DESC LIMIT 20`,
      [userId]
    )
  ).rows;
  for (const f of refunds) {
    items.push({
      key: `refund:${f.id}`,
      kind: 'refund',
      title: `Refund of ${money(f.amount, f.currency)} sent`,
      body: `For order ${f.number}.`,
      link: '/account/refunds',
      at: f.processed_at,
    });
  }

  const replies = (
    await query(
      `SELECT m.id, m.created_at, t.number, t.subject
       FROM support_messages m JOIN support_tickets t ON t.id = m.ticket_id
       WHERE t.user_id = $1 AND m.author = 'staff' AND m.created_at > now() - interval '90 days'
       ORDER BY m.created_at DESC LIMIT 20`,
      [userId]
    )
  ).rows;
  for (const m of replies) {
    items.push({
      key: `support:${m.id}`,
      kind: 'support',
      title: `New reply on ${m.number}`,
      body: m.subject,
      link: `/account/support/${m.number}`,
      at: m.created_at,
    });
  }

  const cleared = state.cleared_at ? new Date(state.cleared_at).getTime() : 0;
  const read = state.read_at ? new Date(state.read_at).getTime() : 0;
  const all = items
    .filter((i) => !dismissed.has(i.key) && new Date(i.at).getTime() > cleared)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .map((i) => ({ ...i, unread: new Date(i.at).getTime() > read }));
  return { items: all.slice(0, limit), total: all.length, unread: all.filter((i) => i.unread).length };
};
