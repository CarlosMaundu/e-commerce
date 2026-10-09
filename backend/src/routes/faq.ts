// src/routes/faq.ts — frequently asked questions.
//   GET    /rest/faq            published questions, grouped order, settings filled in
//   GET    /admin/faq           every question (admin.settings.manage)
//   POST   /admin/faq           { category, question, answer, published }
//   PUT    /admin/faq/:id       the same fields, any of them, plus position
//   DELETE /admin/faq/:id
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { cleanLegalHtml, fillTokens, tokenValues } from '../lib/legal';
import { FAQ_DEFAULTS } from '../lib/faqDefaults';
import { authenticate, requirePermission } from '../middleware/auth';

const toContract = (f: any) => ({
  faq_id: f.id,
  category: f.category,
  question: f.question,
  answer: f.answer,
  position: f.position,
  published: f.published,
  updated_at: f.updated_at,
});

const fields = z.object({
  category: z.string().trim().min(1, 'Please choose or type a topic.').max(60),
  question: z.string().trim().min(5, 'Please write the question.').max(300),
  answer: z
    .string()
    .max(20000)
    .refine((html) => cleanLegalHtml(html).replace(/<[^>]+>/g, '').trim().length >= 5, 'Please write the answer.'),
  published: z.boolean().default(true),
  position: z.coerce.number().int().min(0).max(100000).optional(),
});

/** Starts a new shop with a useful FAQ (only when there is none). */
export const seedFaq = async () => {
  const { n } = (await query('SELECT count(*)::int AS n FROM faq_items')).rows[0];
  if (n) return;
  for (const [i, f] of FAQ_DEFAULTS.entries()) {
    await query('INSERT INTO faq_items (category, question, answer, position) VALUES ($1, $2, $3, $4)', [
      f.category, f.question, f.answer, (i + 1) * 10,
    ]);
  }
};

const ORDER = 'ORDER BY min(position) OVER (PARTITION BY category), category, position, id';

export const publicFaqRoutes = () => {
  const router = Router();
  router.get('/faq', handler(async (_req, res) => {
    const rows = (await query(`SELECT * FROM faq_items WHERE published ${ORDER}`)).rows;
    const values = await tokenValues(null);
    res.set('Cache-Control', 'no-cache');
    ok(res, rows.map((f) => ({ ...toContract(f), answer: fillTokens(f.answer, values) })));
  }));
  return router;
};

export const adminFaqRoutes = () => {
  const router = Router();
  router.use('/faq', authenticate, requirePermission('admin.settings.manage'));

  router.get('/faq', handler(async (_req, res) => {
    ok(res, (await query(`SELECT * FROM faq_items ${ORDER}`)).rows.map(toContract));
  }));

  router.post('/faq', handler(async (req, res) => {
    const b = parse(fields, req.body);
    const position = b.position ?? (await query('SELECT COALESCE(max(position), 0) + 10 AS p FROM faq_items')).rows[0].p;
    const row = (await query(
      `INSERT INTO faq_items (category, question, answer, published, position, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [b.category, b.question, cleanLegalHtml(b.answer), b.published, position, req.auth!.userId]
    )).rows[0];
    audit(req, 'admin.faq_created', `faq:${row.id}`, {});
    ok(res, toContract(row), 201);
  }));

  router.put('/faq/:id', handler(async (req, res) => {
    const b = parse(fields.partial(), req.body);
    const current = (await query('SELECT * FROM faq_items WHERE id = $1', [Number(req.params.id)])).rows[0];
    if (!current) fail(404, 'Question not found.');
    const next = { ...current, ...b, answer: b.answer !== undefined ? cleanLegalHtml(b.answer) : current.answer };
    const row = (await query(
      `UPDATE faq_items SET category = $2, question = $3, answer = $4, published = $5, position = $6,
         updated_by = $7, updated_at = now() WHERE id = $1 RETURNING *`,
      [current.id, next.category, next.question, next.answer, next.published, next.position, req.auth!.userId]
    )).rows[0];
    audit(req, 'admin.faq_updated', `faq:${row.id}`, {});
    ok(res, toContract(row));
  }));

  router.delete('/faq/:id', handler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM faq_items WHERE id = $1', [Number(req.params.id)]) as any;
    if (!rowCount) fail(404, 'Question not found.');
    audit(req, 'admin.faq_deleted', `faq:${req.params.id}`, {});
    ok(res, { deleted: true });
  }));

  return router;
};
