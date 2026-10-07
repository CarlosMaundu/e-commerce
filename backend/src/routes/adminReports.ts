// src/routes/adminReports.ts — the fulfilment SLA report and its settings.
//   GET /admin/reports/sla       orders in a period with their SLA, summary
//   GET /admin/reports/sla/:id   one order: each stage, its time, who moved it
//   GET/PUT /admin/sla-settings  stage targets (Store settings → Fulfilment SLA)
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { loadOrder, orderRef, statusName } from '../lib/orders';
import { DELIVERED_AT_SQL, mergeSla, orderSla, saveSla, sla, slaSchema, SlaState } from '../lib/sla';
import { authenticate, requireAnyPermission, requirePermission } from '../middleware/auth';

const listQuery = z.object({
  days: z.coerce.number().int().min(1).max(3660).optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  state: z.enum(['met', 'breached', 'on_track', 'at_risk', 'pending']).optional(),
  shipping_method: z.string().optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  page: z.coerce.number().int().min(1).default(1),
});

const average = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export const adminReportRoutes = () => {
  const router = Router();
  router.use(['/reports', '/sla-settings'], authenticate);

  router.get('/sla-settings', requireAnyPermission('admin.settings.manage', 'orders.orders.view'), handler(async (_req, res) => {
    const row = (await query(
      `SELECT s.updated_at, u.firstname, u.lastname FROM sla_settings s LEFT JOIN users u ON u.id = s.updated_by WHERE s.id = 1`
    )).rows[0];
    ok(res, {
      settings: sla(),
      updated_at: row?.updated_at ?? null,
      updated_by: row?.firstname ? `${row.firstname} ${row.lastname}`.trim() : null,
    });
  }));

  router.put('/sla-settings', requirePermission('admin.settings.manage'), handler(async (req, res) => {
    const merged = parse(slaSchema, mergeSla(req.body || {}));
    await saveSla(merged, req.auth!.userId);
    audit(req, 'admin.sla_settings_updated', 'sla_settings', {});
    ok(res, { settings: merged });
  }));

  router.get('/reports/sla', requirePermission('orders.orders.view'), handler(async (req, res) => {
    const q = parse(listQuery, req.query);
    const params: unknown[] = [];
    const where = ['o.placed_at IS NOT NULL'];
    if (q.days) {
      params.push(q.days);
      where.push(`o.placed_at >= now() - make_interval(days => $${params.length})`);
    }
    if (q.date_from) {
      params.push(q.date_from);
      where.push(`o.placed_at >= ($${params.length}::date)::timestamp AT TIME ZONE 'Africa/Nairobi'`);
    }
    if (q.date_to) {
      params.push(q.date_to);
      where.push(`o.placed_at < ($${params.length}::date + 1)::timestamp AT TIME ZONE 'Africa/Nairobi'`);
    }
    if (q.shipping_method) {
      params.push(q.shipping_method.split(','));
      where.push(`o.shipping_method = ANY($${params.length}::text[])`);
    }
    if (q.search) {
      params.push(`%${q.search.replace(/^#/, '')}%`);
      where.push(`(o.number ILIKE $${params.length} OR o.email ILIKE $${params.length}
        OR (u.firstname || ' ' || u.lastname) ILIKE $${params.length})`);
    }
    const orders = (await query(
      `SELECT o.id, o.user_id, o.number, o.status, o.shipping_method, o.placed_at, o.created_by, o.email, o.total, o.currency,
         TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')) AS customer_name, u.id AS customer_id,
         ${DELIVERED_AT_SQL} AS delivered_at
       FROM orders o LEFT JOIN users u ON u.id = o.user_id
       WHERE ${where.join(' AND ')} ORDER BY o.placed_at DESC`,
      params
    )).rows;
    const history = orders.length
      ? (await query(
          `SELECT h.order_id, h.status, h.created_at, h.user_id,
             NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), '') AS user_name
           FROM order_history h LEFT JOIN users u ON u.id = h.user_id WHERE h.order_id = ANY($1::int[])`,
          [orders.map((o) => o.id)]
        )).rows
      : [];
    const byOrder = new Map<number, any[]>();
    for (const h of history) byOrder.set(h.order_id, [...(byOrder.get(h.order_id) || []), h]);
    const now = Date.now();
    const all = orders.map((o) => {
      const r = orderSla(o, byOrder.get(o.id) || [], now);
      const current = r.stages.find((s) => s.started_at && !s.finished_at && s.state !== 'not_tracked');
      return {
        order_id: o.id,
        order_number: o.number,
        status: o.status,
        status_name: statusName(o.status),
        customer: o.customer_id ? { customer_id: o.customer_id, name: o.customer_name || o.email } : null,
        shipping_method: o.shipping_method,
        placed_at: o.placed_at,
        delivered_at: r.delivered_at,
        days: r.days,
        target_days: r.target_days,
        state: r.state,
        done: r.done,
        current_stage: current ? current.name : null,
        breached_stages: r.stages.filter((s) => s.state === 'breached').map((s) => s.name),
        stages: r.stages.map((s) => ({ key: s.key, hours: s.hours, state: s.state })),
      };
    });
    const tracked = all.filter((o) => o.state !== 'not_tracked');
    const count = (s: SlaState) => tracked.filter((o) => o.state === s).length;
    const finished = tracked.filter((o) => o.done);
    const summary = {
      total: tracked.length,
      met: count('met'),
      breached: count('breached'),
      on_track: count('on_track'),
      at_risk: count('at_risk'),
      pending: count('on_track') + count('at_risk'),
      met_rate: finished.length ? Math.round((count('met') / finished.length) * 1000) / 10 : null,
      average_days: average(finished.map((o) => o.days)),
      // Average hours per stage, over orders that finished it.
      stages: sla().stages.map((st) => {
        const done = all.map((o) => o.stages.find((s) => s.key === st.key)!).filter((s) => s.hours !== null && s.state !== 'not_tracked' && s.state !== 'on_track' && s.state !== 'at_risk');
        return {
          key: st.key, name: st.name, target_hours: st.target_hours,
          average_hours: average(done.map((s) => s.hours as number)),
          breached: done.filter((s) => s.state === 'breached').length,
        };
      }),
    };
    const filtered = q.state
      ? all.filter((o) => (q.state === 'pending' ? ['on_track', 'at_risk'].includes(o.state) : o.state === q.state))
      : all;
    const start = (q.page - 1) * q.limit;
    res.set('X-Total-Count', String(filtered.length));
    ok(res, { summary, total: filtered.length, orders: filtered.slice(start, start + q.limit), settings: sla() });
  }));

  router.get('/reports/sla/:id', requirePermission('orders.orders.view'), handler(async (req, res) => {
    const loaded = await loadOrder(orderRef(req.params.id), { admin: true });
    if (!loaded || !loaded.order.placed_at) fail(404, 'Order not found.');
    const { order, history } = loaded!;
    ok(res, {
      order: loaded!.contract,
      sla: orderSla(order, history),
      history: history.map((h: any) => ({
        status: h.status,
        status_name: statusName(h.status),
        at: h.created_at,
        by: !h.user_id ? 'System' : h.user_id === order.user_id ? 'Customer' : h.user_name || `Staff #${h.user_id}`,
        comment: h.comment,
      })),
    });
  }));

  return router;
};
