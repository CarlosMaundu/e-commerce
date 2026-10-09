// src/lib/legal.ts — the shop's legal pages. Staff edit them as formatted
// text (headings, paragraphs, bold, italics, lists, links, quotes) in the
// back office; pages never edited use the defaults in legalDefaults.ts.
// Placeholders such as {{store_name}} or {{return_window_days}} are filled in
// from the live settings each time a page is shown, so the wording follows
// the settings without anyone re-editing it.
import sanitizeHtml from 'sanitize-html';
import { config } from '../config';
import { query } from '../db';
import { finance } from './finance';
import { LEGAL_DEFAULTS } from './legalDefaults';
import { getRefundSettings } from './refunds';
import { getStore } from './store';

export const LEGAL_SLUGS = ['terms', 'privacy', 'refunds'] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

const ALIGN = [/^left$/, /^right$/, /^center$/, /^justify$/];

/** What may be stored: simple formatting only; links open in a new tab only when external. */
export const cleanLegalHtml = (html: string) =>
  sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'h4', 'blockquote', 'hr'],
    allowedAttributes: { a: ['href', 'target', 'rel'], p: ['style'], h2: ['style'], h3: ['style'], h4: ['style'], li: ['style'] },
    allowedStyles: { '*': { 'text-align': ALIGN } },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      a: (tagName, attribs) => {
        const external = /^https?:\/\//i.test(attribs.href || '');
        const out: Record<string, string> = { href: attribs.href || '' };
        if (external) Object.assign(out, { target: '_blank', rel: 'noopener noreferrer' });
        return { tagName, attribs: out };
      },
    },
  }).trim();

/** Placeholders staff can use, with what each one becomes. */
export const LEGAL_TOKENS: { token: string; label: string }[] = [
  { token: 'store_name', label: 'Shop name' },
  { token: 'store_email', label: 'Contact email' },
  { token: 'store_phone', label: 'Contact phone' },
  { token: 'store_address', label: 'Postal / physical address' },
  { token: 'website', label: 'Website address' },
  { token: 'currency', label: 'Currency' },
  { token: 'tax_label', label: 'Tax name (e.g. VAT)' },
  { token: 'tax_rate', label: 'Tax rate (%)' },
  { token: 'prices_tax_sentence', label: 'Sentence: whether prices include tax' },
  { token: 'return_window_days', label: 'Return window (days)' },
  { token: 'restocking_fee_sentence', label: 'Sentence: restocking fee' },
  { token: 'delivery_refund_sentence', label: 'Sentence: delivery charges on returns' },
  { token: 'contact_sentence', label: 'Sentence: how to contact us' },
  { token: 'last_updated', label: 'Date this page was last changed' },
];

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const longDate = (d: Date | string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Nairobi' }).format(
    new Date(d)
  );

/** The values placeholders become now. */
export const tokenValues = async (updatedAt: Date | string | null) => {
  const store = await getStore();
  const f = finance();
  const r = await getRefundSettings();
  const contact = [
    store.email && `email us at ${store.email}`,
    store.phone && `call us on ${store.phone}`,
    store.address && `write to us at ${store.address}`,
  ].filter(Boolean) as string[];
  return {
    store_name: store.name,
    store_email: store.email || 'our support team',
    store_phone: store.phone || 'the number shown on our website',
    store_address: store.address || 'the address shown on our website',
    website: config.frontendUrl.replace(/\/$/, ''),
    currency: f.currency,
    tax_label: f.tax_label,
    tax_rate: String(Number(f.tax_rate)),
    prices_tax_sentence: f.prices_include_tax
      ? `Prices include ${f.tax_label} at ${Number(f.tax_rate)}%.`
      : `${f.tax_label} at ${Number(f.tax_rate)}% is added at checkout.`,
    return_window_days: String(r.return_window_days),
    restocking_fee_sentence: r.restocking_fee_percent > 0
      ? `A restocking fee of ${r.restocking_fee_percent}% of the item price may be deducted from refunds for items returned for a reason other than a fault, damage or our error. We tell you the amount before the refund is paid.`
      : 'We do not charge a restocking fee.',
    delivery_refund_sentence: r.refund_delivery
      ? 'If you return every item in an order, we also refund the original delivery charge.'
      : 'Original delivery charges are not refunded unless the item was faulty, damaged in transit or not what you ordered.',
    contact_sentence: contact.length
      ? `You can ${contact.length > 1 ? `${contact.slice(0, -1).join(', ')} or ${contact.at(-1)}` : contact[0]}.`
      : 'You can contact us through the Support page on our website.',
    last_updated: longDate(updatedAt || new Date()),
  } as Record<string, string>;
};

/** Replaces {{token}} with its (escaped) value; unknown tokens are left as they are. */
export const fillTokens = (html: string, values: Record<string, string>) =>
  html.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, key) => (key in values ? escape(values[key]) : m));

export const loadLegalPage = async (slug: LegalSlug) => {
  const row = (
    await query(
      `SELECT l.*, NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), '') AS updated_by_name
       FROM legal_pages l LEFT JOIN users u ON u.id = l.updated_by WHERE l.slug = $1`,
      [slug]
    )
  ).rows[0];
  const def = LEGAL_DEFAULTS[slug];
  return {
    slug,
    title: row?.title ?? def.title,
    body: row?.body ?? def.body,
    customised: Boolean(row),
    updated_at: row?.updated_at ?? def.updated,
    updated_by: row?.updated_by_name ?? null,
  };
};

export const saveLegalPage = async (slug: LegalSlug, title: string, body: string, userId: number) => {
  await query(
    `INSERT INTO legal_pages (slug, title, body, updated_by, updated_at) VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body,
       updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [slug, title, cleanLegalHtml(body), userId]
  );
};

export const resetLegalPage = (slug: LegalSlug) => query('DELETE FROM legal_pages WHERE slug = $1', [slug]);
