// src/routes/legal.ts — Terms and Conditions, Privacy Policy and the Refund
// & Return Policy.
//   GET  /rest/legal/:slug             the published page, placeholders filled in
//   GET  /admin/legal                  the pages, with when and by whom they changed
//   GET  /admin/legal/:slug            the page as written (with placeholders) + preview
//   PUT  /admin/legal/:slug            { title, body } — formatted text (HTML)
//   POST /admin/legal/:slug/reset      back to the built-in wording
import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import {
  cleanLegalHtml, fillTokens, LEGAL_SLUGS, LEGAL_TOKENS, LegalSlug, loadLegalPage, resetLegalPage, saveLegalPage, tokenValues,
} from '../lib/legal';
import { LEGAL_DEFAULTS } from '../lib/legalDefaults';
import { authenticate, requirePermission } from '../middleware/auth';

const slugOf = (raw: string) => {
  if (!(LEGAL_SLUGS as readonly string[]).includes(raw)) fail(404, 'Page not found.');
  return raw as LegalSlug;
};

const bodySchema = z.object({
  title: z.string().trim().min(1, 'Please give the page a title.').max(120),
  body: z
    .string()
    .max(200_000, 'The page is too long.')
    .refine((html) => cleanLegalHtml(html).replace(/<[^>]+>/g, '').trim().length >= 20, 'Please write the page’s content.'),
});

export const publicLegalRoutes = () => {
  const router = Router();
  router.get('/legal/:slug', handler(async (req, res) => {
    const page = await loadLegalPage(slugOf(req.params.slug));
    res.set('Cache-Control', 'no-cache');
    ok(res, {
      slug: page.slug,
      title: page.title,
      body: fillTokens(page.body, await tokenValues(page.updated_at)),
      updated_at: page.updated_at,
    });
  }));
  return router;
};

export const adminLegalRoutes = () => {
  const router = Router();
  router.use('/legal', authenticate, requirePermission('admin.settings.manage'));

  router.get('/legal', handler(async (_req, res) => {
    const pages = await Promise.all(LEGAL_SLUGS.map(loadLegalPage));
    ok(res, pages.map(({ body: _body, ...p }) => p));
  }));

  router.get('/legal/:slug', handler(async (req, res) => {
    const page = await loadLegalPage(slugOf(req.params.slug));
    const values = await tokenValues(page.updated_at);
    ok(res, {
      ...page,
      preview: fillTokens(page.body, values),
      tokens: LEGAL_TOKENS.map((t) => ({ ...t, value: values[t.token] })),
    });
  }));

  router.put('/legal/:slug', handler(async (req, res) => {
    const slug = slugOf(req.params.slug);
    const b = parse(bodySchema, req.body);
    await saveLegalPage(slug, b.title, b.body, req.auth!.userId);
    audit(req, 'admin.legal_page_updated', `legal:${slug}`, {});
    const page = await loadLegalPage(slug);
    ok(res, { ...page, preview: fillTokens(page.body, await tokenValues(page.updated_at)) });
  }));

  router.post('/legal/:slug/reset', handler(async (req, res) => {
    const slug = slugOf(req.params.slug);
    await resetLegalPage(slug);
    audit(req, 'admin.legal_page_reset', `legal:${slug}`, {});
    const page = await loadLegalPage(slug);
    ok(res, { ...page, default_title: LEGAL_DEFAULTS[slug].title });
  }));

  return router;
};
