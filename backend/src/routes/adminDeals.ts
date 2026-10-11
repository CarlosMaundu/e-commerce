// src/routes/adminDeals.ts — Store settings → Home page → Deals: the offers
// in the animated strip under the header and the photo banner on the home
// page. Each has a title, text, link, optional promo code and photo, and runs
// as a daily deal (resets at midnight) or until a set end.
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { image, target } from '../lib/store';
import { authenticate, requirePermission } from '../middleware/auth';

const optionalDate = z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.date().nullable());

const dealSchema = z
  .object({
    title: z.string().trim().min(1, 'Please enter a title.').max(120),
    subtitle: z.string().trim().max(200).default(''),
    link: target.refine((v) => v !== '', { message: 'Please enter where “View deal” goes.' }),
    code: z.preprocess((v) => (v === '' ? null : v), z.string().trim().toUpperCase().max(40).nullable()).default(null),
    image: image.default(''),
    placement: z.enum(['strip', 'banner', 'both'], { errorMap: () => ({ message: 'Choose where it shows.' }) }),
    starts_at: optionalDate.default(null),
    // Empty = a daily deal that counts down to midnight and starts again.
    ends_at: optionalDate.default(null),
    active: z.coerce.boolean().default(true),
  })
  .superRefine((d, ctx) => {
    if (d.starts_at && d.ends_at && d.ends_at <= d.starts_at) {
      ctx.addIssue({ code: 'custom', path: ['ends_at'], message: 'The end must be after the start.' });
    }
  });

const toContract = (p: any) => ({
  promotion_id: p.id,
  title: p.title,
  subtitle: p.subtitle,
  link: p.link,
  code: p.code,
  image: p.image,
  placement: p.placement,
  starts_at: p.starts_at,
  ends_at: p.ends_at,
  daily: !p.ends_at,
  active: p.active,
  position: p.position,
  // What shoppers see right now.
  live: p.active && (!p.starts_at || p.starts_at <= new Date()) && (!p.ends_at || p.ends_at > new Date()),
});

export const adminDealRoutes = () => {
  const router = Router();
  router.use('/deals', authenticate, requirePermission('admin.settings.manage'));

  const list = async () =>
    (await query('SELECT * FROM promotions ORDER BY position, id')).rows.map(toContract);

  router.get('/deals', handler(async (_req, res) => ok(res, await list())));

  const checkCode = async (code: string | null) => {
    if (code && !(await query('SELECT 1 FROM coupons WHERE code = $1', [code])).rows[0]) {
      fail(400, 'That promo code doesn’t exist. Create it under Promo codes first.');
    }
  };

  router.post('/deals', handler(async (req, res) => {
    const d = parse(dealSchema, req.body);
    await checkCode(d.code);
    const { rows } = await query(
      `INSERT INTO promotions (title, subtitle, link, code, image, placement, starts_at, ends_at, active, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, (SELECT COALESCE(max(position), 0) + 1 FROM promotions))
       RETURNING *`,
      [d.title, d.subtitle, d.link, d.code, d.image, d.placement, d.starts_at, d.ends_at, d.active]
    );
    audit(req, 'deal.created', `deal:${rows[0].id}`, { title: d.title });
    ok(res, toContract(rows[0]), 201);
  }));

  router.put('/deals/:id', handler(async (req, res) => {
    const d = parse(dealSchema, req.body);
    await checkCode(d.code);
    const { rows } = await query(
      `UPDATE promotions SET title = $2, subtitle = $3, link = $4, code = $5, image = $6, placement = $7,
         starts_at = $8, ends_at = $9, active = $10, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [Number(req.params.id), d.title, d.subtitle, d.link, d.code, d.image, d.placement, d.starts_at, d.ends_at, d.active]
    );
    if (!rows[0]) fail(404, 'Deal not found.');
    audit(req, 'deal.updated', `deal:${rows[0].id}`, { active: d.active });
    ok(res, toContract(rows[0]));
  }));

  // New order of the deals: { ids: [3, 1, 2] }.
  router.put('/deals-order', authenticate, requirePermission('admin.settings.manage'), handler(async (req, res) => {
    const { ids } = parse(z.object({ ids: z.array(z.coerce.number().int().positive()).min(1) }), req.body);
    for (const [i, id] of ids.entries()) {
      await query('UPDATE promotions SET position = $2 WHERE id = $1', [id, i + 1]);
    }
    ok(res, await list());
  }));

  router.delete('/deals/:id', handler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM promotions WHERE id = $1', [Number(req.params.id)]);
    if (!rowCount) fail(404, 'Deal not found.');
    audit(req, 'deal.deleted', `deal:${req.params.id}`, {});
    ok(res, { deleted: true });
  }));

  return router;
};
