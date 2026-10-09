// src/lib/notifications.ts — the back-office bell. Each person sees events
// for the areas they're allowed into: new orders, orders waiting too long,
// gifts to prepare, return requests, refunds to approve, overdue invoices and
// stock running out. Opening the bell marks everything read; people can
// dismiss one item or clear the lot (newer events still appear).
import { query } from '../db';
import { hasPermission } from './users';

export interface StaffNotification {
  key: string;
  kind: 'order' | 'delayed' | 'gift' | 'return' | 'refund' | 'invoice' | 'stock' | 'support';
  title: string;
  body: string;
  link: string;
  at: string;
}

const money = (n: unknown, currency: string) =>
  `${currency} ${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const name = (r: any) => `${r.firstname || ''} ${r.lastname || ''}`.trim() || r.email || 'A customer';

export const staffNotifications = async (userId: number, permissions: string[], limit = 10) => {
  const can = (p: string) => hasPermission(permissions, p);
  const state = (await query('SELECT read_at, cleared_at FROM staff_notification_state WHERE user_id = $1', [userId])).rows[0] || {};
  const dismissed = new Set(
    (await query('SELECT key FROM staff_notification_dismissals WHERE user_id = $1', [userId])).rows.map((r) => r.key)
  );
  const items: StaffNotification[] = [];

  if (can('orders.orders.view')) {
    const orders = (
      await query(
        `SELECT o.id, o.number, o.total, o.currency, o.status, o.placed_at, o.email, u.firstname, u.lastname
         FROM orders o LEFT JOIN users u ON u.id = o.user_id
         WHERE o.placed_at IS NOT NULL AND o.status IN ('pending', 'processing') AND o.placed_at > now() - interval '30 days'
         ORDER BY o.placed_at DESC LIMIT 40`
      )
    ).rows;
    for (const o of orders) {
      const late = Date.now() - new Date(o.placed_at).getTime() > 3 * 86400000;
      items.push(
        late
          ? { key: `delayed:${o.id}`, kind: 'delayed', title: `Order ${o.number} is waiting`,
              body: `Placed more than 3 days ago by ${name(o)} and not shipped yet.`, link: `/admin/orders/${o.id}`,
              at: new Date(new Date(o.placed_at).getTime() + 3 * 86400000).toISOString() }
          : { key: `order:${o.id}`, kind: 'order', title: `New order ${o.number}`,
              body: `${name(o)} · ${money(o.total, o.currency)}`, link: `/admin/orders/${o.id}`, at: o.placed_at }
      );
    }
    const gifts = (
      await query(
        `SELECT o.id, o.number, max(o.placed_at) AS placed_at, count(*)::int AS n
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE oi.gift IS NOT NULL AND COALESCE((oi.gift->>'done')::boolean, false) = false
           AND o.status IN ('pending', 'processing')
         GROUP BY o.id, o.number ORDER BY max(o.placed_at) DESC LIMIT 20`
      )
    ).rows;
    for (const g of gifts) {
      items.push({ key: `gift:${g.id}`, kind: 'gift', title: `Gift to prepare: ${g.number}`,
        body: `${g.n} item${g.n === 1 ? '' : 's'} to wrap before dispatch.`, link: `/admin/orders/${g.id}`, at: g.placed_at });
    }
  }

  if (can('orders.returns.view')) {
    const returns = (
      await query(
        `SELECT r.id, r.created_at, oi.name, o.number, u.firstname, u.lastname, u.email
         FROM returns r JOIN order_items oi ON oi.id = r.order_item_id JOIN orders o ON o.id = r.order_id
         LEFT JOIN users u ON u.id = r.user_id
         WHERE r.status IN ('requested', 'received') ORDER BY r.created_at DESC LIMIT 20`
      )
    ).rows;
    for (const r of returns) {
      items.push({ key: `return:${r.id}`, kind: 'return', title: `Return request #${r.id}`,
        body: `${name(r)} wants to return ${r.name} (${r.number}).`, link: `/admin/returns?search=${r.id}`, at: r.created_at });
    }
  }

  if (can('admin.refunds.approve')) {
    const refunds = (
      await query(
        `SELECT r.id, r.amount, r.created_at, o.number, o.currency FROM refunds r JOIN orders o ON o.id = r.order_id
         WHERE r.status = 'pending_approval' ORDER BY r.created_at DESC LIMIT 20`
      )
    ).rows;
    for (const r of refunds) {
      items.push({ key: `refund:${r.id}`, kind: 'refund', title: `Refund to approve`,
        body: `${money(r.amount, r.currency)} on order ${r.number}.`, link: '/admin/refunds?tab=pending', at: r.created_at });
    }
  }

  if (can('orders.invoices.view')) {
    const overdue = (
      await query(
        `SELECT id, number, total - amount_paid AS due, currency, due_at FROM invoices
         WHERE status IN ('issued', 'partially_paid') AND due_at IS NOT NULL AND due_at < now()
         ORDER BY due_at DESC LIMIT 20`
      )
    ).rows;
    for (const i of overdue) {
      items.push({ key: `invoice:${i.id}`, kind: 'invoice', title: `Invoice ${i.number} is overdue`,
        body: `${money(i.due, i.currency)} still to pay.`, link: `/admin/invoices/${i.id}`, at: i.due_at });
    }
  }

  if (can('support.tickets.view')) {
    const tickets = (
      await query(
        `SELECT id, number, subject, name, last_message_at FROM support_tickets
         WHERE status = 'open' AND last_from = 'customer' ORDER BY last_message_at DESC LIMIT 20`
      )
    ).rows;
    for (const t of tickets) {
      items.push({ key: `support:${t.id}:${new Date(t.last_message_at).getTime()}`, kind: 'support',
        title: `Support request ${t.number}`, body: `${t.name}: ${t.subject}`, link: `/admin/support/${t.id}`,
        at: t.last_message_at });
    }
  }

  if (can('catalog.products.view')) {
    const stock = (
      await query(
        `SELECT id, name, quantity, low_stock_threshold, updated_at FROM products
         WHERE track_inventory AND status = 'published' AND quantity <= low_stock_threshold
         ORDER BY quantity, updated_at DESC LIMIT 20`
      )
    ).rows;
    for (const p of stock) {
      const out = p.quantity <= 0;
      items.push({ key: `stock:${p.id}:${out ? 'out' : 'low'}`, kind: 'stock',
        title: out ? `${p.name} is out of stock` : `${p.name} is running low`,
        body: out ? 'Shoppers can’t buy it until you restock.' : `${p.quantity} left.`,
        link: `/admin/products/${p.id}`, at: p.updated_at });
    }
  }

  const cleared = state.cleared_at ? new Date(state.cleared_at).getTime() : 0;
  const read = state.read_at ? new Date(state.read_at).getTime() : 0;
  const all = items
    .filter((i) => !dismissed.has(i.key) && new Date(i.at).getTime() > cleared)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .map((i) => ({ ...i, unread: new Date(i.at).getTime() > read }));
  // The bell shows the newest few; the Notifications page shows them all.
  return { items: all.slice(0, limit), total: all.length, unread: all.filter((i) => i.unread).length };
};

const touch = (userId: number, column: 'read_at' | 'cleared_at') =>
  query(
    `INSERT INTO staff_notification_state (user_id, ${column}) VALUES ($1, now())
     ON CONFLICT (user_id) DO UPDATE SET ${column} = now()`,
    [userId]
  );

export const markNotificationsRead = (userId: number) => touch(userId, 'read_at');
export const clearNotifications = async (userId: number) => {
  await touch(userId, 'cleared_at');
  await touch(userId, 'read_at');
  // Dismissals before the clear are no longer needed.
  await query('DELETE FROM staff_notification_dismissals WHERE user_id = $1', [userId]);
};
export const dismissNotification = (userId: number, key: string) =>
  query(
    `INSERT INTO staff_notification_dismissals (user_id, key) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, key.slice(0, 80)]
  );
