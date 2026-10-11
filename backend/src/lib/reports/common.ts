// src/lib/reports/common.ts — what every report shares: the period (from, to,
// grouped by day, week or month, in the shop's time zone), the period it's
// compared with, and the shape a report answers with (cards, a series, a
// table and breakdowns), so one page in the back office shows them all.
import { z } from 'zod';
import { round2 } from '../pricing';

export const REPORT_TZ = process.env.REPORT_TZ || 'Africa/Nairobi';

export type Format = 'money' | 'number' | 'percent' | 'days' | 'hours' | 'text' | 'date';

export interface Card {
  key: string;
  label: string;
  value: number | string | null;
  format: Format;
  // Change against the comparison period, in % (or points for percentages).
  change?: number | null;
  compare?: number | null;
  hint?: string;
  // Lower is better (refunds, return rate…): the page colours changes the other way.
  inverse?: boolean;
}
export interface Column {
  key: string;
  label: string;
  format?: Format;
  align?: 'left' | 'right';
}
export interface Table {
  title?: string;
  columns: Column[];
  rows: Record<string, unknown>[];
  // Links per row: { key: column, to: path }.
  empty?: string;
}
export interface Report {
  period: Period['out'];
  cards: Card[];
  series?: {
    labels: string[];
    datasets: { key: string; label: string; format: Format; values: number[]; compare?: number[] }[];
  };
  table?: Table;
  breakdowns?: Table[];
  notes?: string[];
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-01.');

export const periodQuery = z.object({
  from: ymd.optional(),
  to: ymd.optional(),
  group: z.enum(['day', 'week', 'month']).optional(),
  compare: z.enum(['previous', 'last_year', 'none']).default('previous'),
});

const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const days = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000) + 1;
const today = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10); // Nairobi date

export interface Period {
  from: string;
  to: string;
  group: 'day' | 'week' | 'month';
  compare: { from: string; to: string } | null;
  out: { from: string; to: string; group: string; compare: { from: string; to: string } | null; days: number };
}

/** from/to (inclusive dates), default the last 30 days; the comparison period. */
export const parsePeriod = (q: z.infer<typeof periodQuery>): Period => {
  const to = q.to || today();
  const from = q.from || addDays(to, -29);
  if (from > to) throw Object.assign(new Error('bad'), { status: 400 });
  const n = days(from, to);
  const group = q.group || (n <= 31 ? 'day' : n <= 182 ? 'week' : 'month');
  const compare =
    q.compare === 'none'
      ? null
      : q.compare === 'last_year'
        ? { from: addDays(from, -364), to: addDays(to, -364) }
        : { from: addDays(from, -n), to: addDays(from, -1) };
  return { from, to, group, compare, out: { from, to, group, compare, days: n } };
};

/** SQL: a timestamp column's local date is inside $from..$to (inclusive). */
export const inRange = (col: string, fromParam: string, toParam: string) =>
  `(${col} AT TIME ZONE '${REPORT_TZ}')::date BETWEEN ${fromParam}::date AND ${toParam}::date`;

/** SQL: the bucket (start date) a timestamp falls in. */
export const bucketOf = (col: string, group: string) =>
  `date_trunc('${group}', ${col} AT TIME ZONE '${REPORT_TZ}')::date`;

/** Bucket start dates covering the period, as YYYY-MM-DD. */
export const buckets = (p: { from: string; to: string }, group: string) => {
  const out: string[] = [];
  const start = new Date(`${p.from}T00:00:00Z`);
  if (group === 'week') start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7)); // Monday
  if (group === 'month') start.setUTCDate(1);
  const end = new Date(`${p.to}T00:00:00Z`);
  for (const d = start; d <= end; ) {
    out.push(d.toISOString().slice(0, 10));
    if (group === 'day') d.setUTCDate(d.getUTCDate() + 1);
    else if (group === 'week') d.setUTCDate(d.getUTCDate() + 7);
    else d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
};

/** Values per bucket from rows of { bucket, ...values }; 0 where none. */
export const fill = (labels: string[], rows: any[], key: string) => {
  const map = new Map(rows.map((r) => [String(r.bucket instanceof Date ? r.bucket.toISOString().slice(0, 10) : r.bucket).slice(0, 10), Number(r[key]) || 0]));
  return labels.map((l) => round2(map.get(l) ?? 0));
};

/** % change, or null when there's nothing to compare with. */
export const change = (cur: number, prev: number | null | undefined) =>
  prev === null || prev === undefined ? null : prev ? round2(((cur - prev) / Math.abs(prev)) * 100) : cur ? 100 : 0;

export const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
export const pct = (part: number, whole: number) => (whole ? round2((part / whole) * 100) : 0);
export { round2 };
