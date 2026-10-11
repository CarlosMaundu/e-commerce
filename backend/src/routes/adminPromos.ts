// src/routes/adminPromos.ts — Back office → Promo codes: create and change
// codes, switch them off, and see how each is used (how often, by whom, on
// which order and invoice, and how much discount it gave).
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, HttpError, ok, parse } from '../lib/http';
import { authenticate, requirePermission } from '../middleware/auth';

// Orders that count as a use: placed and not cancelled.
const USED = `o.placed_at IS NOT NULL AND o.status <> 'cancelled'`;

const STATE_SQL = `CASE
  WHEN NOT c.active THEN 'inactive'
  WHEN c.ends_at IS NOT NULL AND c.ends_at < now() THEN 'expired'
  WHEN c.uses_limit IS NOT NULL AND COALESCE(s.uses, 0) >= c.uses_limit THEN 'used_up'
  WHEN c.starts_at IS NOT NULL AND c.starts_at > now() THEN 'scheduled'
  ELSE 'active' END`;

const SELECT = `
  SELECT c.*, ${STATE_SQL} AS state, COALESCE(s.uses, 0) AS uses, COALESCE(s.customers, 0) AS customers,
    COALESCE(s.discount, 0) AS discount_total, COALESCE(s.sales, 0) AS sales_total, s.last_used_at,
    NULLIF(TRIM(COALESCE(cb.firstname, '') || ' ' || COALESCE(cb.lastname, '')), '') AS created_by_name
  FROM coupons c
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS uses, count(DISTINCT o.user_id)::int AS customers, sum(o.discount) AS discount,
      sum(o.total) AS sales, max(o.placed_at) AS last_used_at
    FROM orders o WHERE o.coupon_code = c.code AND ${USED}
  ) s ON true
  LEFT JOIN users cb ON cb.id = c.created_by`;

const toContract = (c: any) => ({
  code: c.code,
  description: c.description,
  type: c.type,
  value: Number(c.value),
  min_total: Number(c.min_total),
  starts_at: c.starts_at,
  ends_at: c.ends_at,
  uses_limit: c.uses_limit,
  per_customer_limit: c.per_customer_limit,
  audience: c.audience,
  new_customer_days: c.new_customer_days,
  max_discount: c.max_discount === null ? null : Number(c.max_discount),
  exclude_sale_items: c.exclude_sale_items,
  send_on_signup: c.send_on_signup,
  active: c.active,
  state: c.state,
  uses: c.uses,
  customers: c.customers,
  discount_total: Number(c.discount_total),
  sales_total: Number(c.sales_total),
  last_used_at: c.last_used_at,
  created_by: c.created_by_name ?? null,
  date_added: c.created_at,
  date_modified: c.updated_at,
});

const optionalDate = z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.date().nullable());
const optionalCount = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.coerce.number().int().min(1, 'Use at least 1, or leave it empty for no limit.').nullable()
);

const promoSchema = z
  .object({
    description: z.string().trim().max(255).default(''),
    type: z.enum(['percent', 'fixed'], { errorMap: () => ({ message: 'Choose a percentage or a fixed amount.' }) }),
    value: z.coerce.number({ invalid_type_error: 'Please enter the discount.' }).positive('The discount must be more than zero.'),
    min_total: z.coerce.number().min(0, 'Use 0 for no minimum.').default(0),
    starts_at: optionalDate.default(null),
    ends_at: optionalDate.default(null),
    uses_limit: optionalCount.default(null),
    per_customer_limit: optionalCount.default(null),
    // Who may use it: everyone, a first order, customers who joined in the
    // last N days, or customers with an earlier order.
    audience: z.enum(['everyone', 'first_order', 'new_customers', 'returning']).default('everyone'),
    new_customer_days: optionalCount.default(null),
    max_discount: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z.coerce.number().positive('The cap must be more than zero.').nullable()
    ).default(null),
    exclude_sale_items: z.coerce.boolean().default(false),
    send_on_signup: z.coerce.boolean().default(false),
    active: z.coerce.boolean().default(true),
  })
  .superRefine((p, ctx) => {
    if (p.type === 'percent' && p.value > 100) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'A percentage can be at most 100.' });
    }
    if (p.audience === 'new_customers' && !p.new_customer_days) {
      ctx.addIssue({ code: 'custom', path: ['new_customer_days'], message: 'How many days after signing up does it work?' });
    }
    if (p.send_on_signup && !['everyone', 'first_order', 'new_customers'].includes(p.audience)) {
      ctx.addIssue({ code: 'custom', path: ['send_on_signup'], message: 'New customers can’t use a code for returning customers.' });
    }
    if (p.starts_at && p.ends_at && p.ends_at <= p.starts_at) {
      ctx.addIssue({ code: 'custom', path: ['ends_at'], message: 'The end must be after the start.' });
    }
  });

const codeSchema = z
  .string()
  .trim()
  .min(3, 'Use at least 3 characters.')
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, - and _ only.')
  .transform((v) => v.toUpperCase());

export const adminPromoRoutes = () => {
  const router = Router();
  router.use('/promos', authenticate);

  router.get('/promos', requirePermission('marketing.promos.view'), handler(async (req, res) => {
    const q = parse(
      z.object({
        status: z.enum(['active', 'scheduled', 'expired', 'used_up', 'inactive', 'all']).default('all'),
        search: z.string().trim().max(60).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(10),
      }),
      req.query
    );
    const params: unknown[] = [];
    let searchSql = '';
    if (q.search) {
      params.push(`%${q.search}%`);
      searchSql = `WHERE c.code ILIKE $1 OR c.description ILIKE $1`;
    }
    const rows = (await query(`SELECT * FROM (${SELECT} ${searchSql}) p ORDER BY p.created_at DESC`, params)).rows;
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.state] = (counts[r.state] || 0) + 1;
    const shown = q.status === 'all' ? rows : rows.filter((r) => r.state === q.status);
    ok(res, {
      promos: shown.slice((q.page - 1) * q.limit, q.page * q.limit).map(toContract),
      total: shown.length,
      counts,
    });
  }));

  const load = async (code: string) => {
    const row = (await query(`${SELECT} WHERE c.code = upper($1)`, [code])).rows[0];
    if (!row) fail(404, 'Promo code not found.');
    return row;
  };

  router.get('/promos/:code', requirePermission('marketing.promos.view'), handler(async (req, res) => {
    ok(res, toContract(await load(req.params.code)));
  }));

  // Every order that used the code: who, which order and invoice, how much.
  router.get('/promos/:code/uses', requirePermission('marketing.promos.view'), handler(async (req, res) => {
    const q = parse(
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(10),
      }),
      req.query
    );
    const promo = await load(req.params.code);
    const total = (await query(`SELECT count(*)::int AS n FROM orders o WHERE o.coupon_code = $1 AND ${USED}`, [promo.code]))
      .rows[0].n;
    const rows = (await query(
      `SELECT o.id, o.number, o.placed_at, o.discount, o.total, o.subtotal, o.currency, o.status, o.email, o.user_id,
         TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')) AS customer_name,
         i.id AS invoice_id, i.number AS invoice_number, i.status AS invoice_status
       FROM orders o LEFT JOIN users u ON u.id = o.user_id LEFT JOIN invoices i ON i.order_id = o.id
       WHERE o.coupon_code = $1 AND ${USED}
       ORDER BY o.placed_at DESC LIMIT $2 OFFSET $3`,
      [promo.code, q.limit, (q.page - 1) * q.limit]
    )).rows;
    ok(res, {
      total,
      uses: rows.map((r) => ({
        order_id: r.id,
        order_number: r.number,
        date_added: r.placed_at,
        discount: Number(r.discount),
        subtotal: Number(r.subtotal),
        total: Number(r.total),
        currency: r.currency,
        order_status: r.status,
        customer: { customer_id: r.user_id, name: r.customer_name || r.email, email: r.email },
        invoice: r.invoice_id ? { invoice_id: r.invoice_id, number: r.invoice_number, status: r.invoice_status } : null,
      })),
    });
  }));

  router.post('/promos', requirePermission('marketing.promos.manage'), handler(async (req, res) => {
    // Checked together so every field's problem shows at once.
    const p = parse(z.intersection(z.object({ code: codeSchema }), promoSchema), req.body);
    const code = p.code;
    const taken = (await query('SELECT 1 FROM coupons WHERE code = $1', [code])).rows[0];
    if (taken) throw new HttpError(400, ['That code already exists.'], { code: 'That code already exists.' });
    await query(
      `INSERT INTO coupons (code, description, type, value, min_total, starts_at, ends_at, uses_limit, per_customer_limit,
         active, created_by, updated_by, audience, new_customer_days, max_discount, exclude_sale_items, send_on_signup)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13, $14, $15, $16)`,
      [code, p.description, p.type, p.value, p.min_total, p.starts_at, p.ends_at, p.uses_limit, p.per_customer_limit,
        p.active, req.auth!.userId, p.audience, p.audience === 'new_customers' ? p.new_customer_days : null,
        p.type === 'percent' ? p.max_discount : null, p.exclude_sale_items, p.send_on_signup]
    );
    audit(req, 'promo.created', `promo:${code}`, { type: p.type, value: p.value });
    ok(res, toContract(await load(code)), 201);
  }));

  router.put('/promos/:code', requirePermission('marketing.promos.manage'), handler(async (req, res) => {
    const promo = await load(req.params.code);
    const p = parse(promoSchema, req.body);
    await query(
      `UPDATE coupons SET description = $2, type = $3, value = $4, min_total = $5, starts_at = $6, ends_at = $7,
         uses_limit = $8, per_customer_limit = $9, active = $10, updated_by = $11, updated_at = now(),
         audience = $12, new_customer_days = $13, max_discount = $14, exclude_sale_items = $15, send_on_signup = $16
       WHERE code = $1`,
      [promo.code, p.description, p.type, p.value, p.min_total, p.starts_at, p.ends_at, p.uses_limit, p.per_customer_limit,
        p.active, req.auth!.userId, p.audience, p.audience === 'new_customers' ? p.new_customer_days : null,
        p.type === 'percent' ? p.max_discount : null, p.exclude_sale_items, p.send_on_signup]
    );
    audit(req, 'promo.updated', `promo:${promo.code}`, { active: p.active });
    ok(res, toContract(await load(promo.code)));
  }));

  router.delete('/promos/:code', requirePermission('marketing.promos.manage'), handler(async (req, res) => {
    const promo = await load(req.params.code);
    // Used codes stay, so orders and reports keep their history.
    if (promo.uses > 0) fail(400, 'This code has been used, so it can’t be deleted. Switch it off instead.');
    await query('DELETE FROM coupons WHERE code = $1', [promo.code]);
    audit(req, 'promo.deleted', `promo:${promo.code}`, {});
    ok(res, { deleted: true });
  }));

  return router;
};
