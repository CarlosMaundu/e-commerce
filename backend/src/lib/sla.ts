// src/lib/sla.ts — fulfilment service levels. An order moves through stages
// (placed → processing → shipped → delivered); each stage has a target time,
// and the whole journey a target per delivery option. From the order's
// history we work out how long each stage took, who moved it on, and whether
// it met its target, is on track, at risk or breached.
import { z } from 'zod';
import { query } from '../db';

export const STAGE_STATUSES = ['placed', 'processing', 'shipped', 'delivered'] as const;
type StageStatus = (typeof STAGE_STATUSES)[number];

const hours = z.coerce
  .number({ invalid_type_error: 'Please enter a number of hours.' })
  .positive('Use more than 0 hours.')
  .max(24 * 60, 'Use 1,440 hours (60 days) or fewer.');
const days = z.coerce
  .number({ invalid_type_error: 'Please enter a number of days.' })
  .positive('Use more than 0 days.')
  .max(60, 'Use 60 days or fewer.');

export const slaSchema = z.object({
  enabled: z.boolean(),
  // A stage counts from reaching `from` until reaching `to`.
  stages: z
    .array(
      z.object({
        key: z.enum(['confirm', 'pack', 'deliver']),
        name: z.string().trim().min(1, 'Please name the stage.').max(60),
        from: z.enum(STAGE_STATUSES),
        to: z.enum(STAGE_STATUSES),
        target_hours: hours,
        tracked: z.boolean(),
      })
    )
    .length(3),
  // Placement to delivery, per delivery option.
  total_days: z.object({ standard: days, express: days, pickup: days }),
  // "At risk" once this share of the target has passed without finishing.
  at_risk_percent: z.coerce.number().int().min(50, 'Use 50% or more.').max(95, 'Use 95% or less.'),
});
export type SlaSettings = z.output<typeof slaSchema>;

export const defaultSla = (): SlaSettings => ({
  enabled: true,
  stages: [
    { key: 'confirm', name: 'Confirm order', from: 'placed', to: 'processing', target_hours: 24, tracked: true },
    { key: 'pack', name: 'Pack and dispatch', from: 'processing', to: 'shipped', target_hours: 48, tracked: true },
    { key: 'deliver', name: 'Deliver', from: 'shipped', to: 'delivered', target_hours: 72, tracked: true },
  ],
  total_days: { standard: 5, express: 2, pickup: 2 },
  at_risk_percent: 80,
});

let current: SlaSettings = defaultSla();
export const sla = () => current;

const merge = (saved: any) => {
  const base = defaultSla();
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    stages: base.stages.map((s) => ({ ...s, ...(saved.stages || []).find((x: any) => x.key === s.key) })),
    total_days: { ...base.total_days, ...(saved.total_days || {}) },
  };
};
export const mergeSla = (saved: any) => merge({ ...current, ...saved, stages: saved?.stages || current.stages });

export const loadSla = async () => {
  const row = (await query('SELECT settings FROM sla_settings WHERE id = 1')).rows[0];
  const parsed = slaSchema.safeParse(merge(row?.settings));
  current = parsed.success ? parsed.data : defaultSla();
  return current;
};

export const saveSla = async (settings: SlaSettings, userId: number) => {
  await query(
    `INSERT INTO sla_settings (id, settings, updated_by, updated_at) VALUES (1, $1, $2, now())
     ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(settings), userId]
  );
  current = settings;
};

// ---------- working it out ----------

export type SlaState = 'met' | 'breached' | 'on_track' | 'at_risk' | 'not_tracked';
const HOUR = 3600000;
const round1 = (n: number) => Math.round(n * 10) / 10;

const judge = (tookMs: number, targetMs: number, done: boolean, s: SlaSettings): SlaState => {
  if (done) return tookMs <= targetMs ? 'met' : 'breached';
  if (tookMs > targetMs) return 'breached';
  return tookMs >= (targetMs * s.at_risk_percent) / 100 ? 'at_risk' : 'on_track';
};

interface HistoryRow {
  status: string;
  created_at: Date | string;
  user_id: number | null;
  user_name?: string | null;
}

/** When the order first reached each stage, and who moved it there. */
const reached = (order: any, history: HistoryRow[]) => {
  const at: Partial<Record<StageStatus, { at: number; by: string }>> = {
    placed: { at: new Date(order.placed_at).getTime(), by: order.created_by ? 'Staff (phone order)' : 'Customer (checkout)' },
  };
  const sorted = [...history].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  for (const h of sorted) {
    const st = h.status as StageStatus;
    if (!STAGE_STATUSES.includes(st) || st === 'placed' || at[st]) continue;
    // The customer's own change is checkout (a card order starts as processing).
    const by = !h.user_id
      ? 'System'
      : h.user_id === order.user_id
        ? 'Customer checkout (paid)'
        : h.user_name || `Staff #${h.user_id}`;
    at[st] = { at: new Date(h.created_at).getTime(), by };
  }
  return at;
};

/** The SLA picture for one order (history optional for the overall figure). */
export const orderSla = (order: any, history: HistoryRow[] = [], now = Date.now(), s: SlaSettings = current) => {
  const at = reached(order, history);
  const placed = at.placed!.at;
  const deliveredAt = at.delivered?.at ?? (order.delivered_at ? new Date(order.delivered_at).getTime() : null);
  const ended = ['cancelled', 'refunded'].includes(order.status) && !deliveredAt;
  const targetDays = s.total_days[order.shipping_method as keyof SlaSettings['total_days']] ?? s.total_days.standard;
  const tookMs = (deliveredAt ?? now) - placed;
  const overall: SlaState = !s.enabled || ended ? 'not_tracked' : judge(tookMs, targetDays * 24 * HOUR, Boolean(deliveredAt), s);

  const stages = s.stages.map((st) => {
    const start = at[st.from];
    const end = at[st.to];
    const target = st.target_hours * HOUR;
    if (!start) {
      return { key: st.key, name: st.name, from: st.from, to: st.to, target_hours: st.target_hours,
        started_at: null, finished_at: null, hours: null, state: 'not_tracked' as SlaState, by: null };
    }
    const took = (end?.at ?? (ended ? start.at : now)) - start.at;
    const state: SlaState = !st.tracked || !s.enabled || (ended && !end) ? 'not_tracked' : judge(took, target, Boolean(end), s);
    return {
      key: st.key, name: st.name, from: st.from, to: st.to, target_hours: st.target_hours,
      started_at: new Date(start.at).toISOString(),
      finished_at: end ? new Date(end.at).toISOString() : null,
      hours: ended && !end ? null : Math.round((took / HOUR) * 100) / 100,
      state,
      by: end?.by ?? null,
    };
  });

  return {
    state: overall,
    done: Boolean(deliveredAt),
    days: round1(tookMs / (24 * HOUR)),
    target_days: targetDays,
    placed_at: new Date(placed).toISOString(),
    delivered_at: deliveredAt ? new Date(deliveredAt).toISOString() : null,
    stages,
  };
};

/** For lists: the overall figure only, from placed_at and delivered_at. */
export const orderSlaSummary = (order: any, now = Date.now()) => {
  const r = orderSla(order, [], now);
  return { state: r.state, done: r.done, days: r.days, target_days: r.target_days };
};

/** SQL for an order's first delivery time (lists use it with orderSlaSummary). */
export const DELIVERED_AT_SQL = `(SELECT min(created_at) FROM order_history h WHERE h.order_id = o.id AND h.status = 'delivered')`;
