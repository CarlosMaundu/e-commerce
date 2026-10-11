// src/lib/search.ts — the fallback when a product search finds nothing
// exactly: related items ranked by how close they are.
//   1. SKU families: ST-CNV-LOW-WHI-40 → ST-CNV-LOW-WHI → ST-CNV-LOW → ST-CNV
//      (a longer shared prefix ranks higher), on product and variant SKUs.
//   2. Shared words (3+ letters) in the name, SKUs, brand, category or tags.
//   3. Typos ("snekers"), by trigram similarity when pg_trgm is installed.
import { query } from '../db';

let trigram: boolean | null = null;
const hasTrigram = async () => {
  if (trigram === null) {
    trigram = (await query(`SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'`)).rows.length > 0;
  }
  return trigram;
};

const HAYSTACK = `lower(concat_ws(' ', p.name, p.sku, b.name, c.name, array_to_string(p.tags, ' '),
  (SELECT string_agg(v.sku, ' ') FROM product_variants v WHERE v.product_id = p.id)))`;

/** Prefixes of a code-like search, longest first: A-B-C-D → A-B-C, A-B. */
export const skuPrefixes = (search: string) => {
  const parts = search.trim().split('-').filter(Boolean);
  if (parts.length < 2) return [];
  const out: string[] = [];
  for (let n = parts.length - 1; n >= 2; n -= 1) out.push(parts.slice(0, n).join('-'));
  return out;
};

export const searchWords = (search: string) =>
  [...new Set(search.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w)))].slice(0, 6);

/**
 * WHERE and ORDER BY fragments for related matches; adds to `params`.
 * Returns null when the search has nothing to go on.
 */
export const relatedMatch = async (search: string, params: unknown[]) => {
  const bind = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  const scores: string[] = [];
  const conditions: string[] = [];
  skuPrefixes(search).forEach((prefix, i, all) => {
    const p = bind(`${prefix.toLowerCase()}%`);
    const hit = `(lower(p.sku) LIKE ${p} OR EXISTS (SELECT 1 FROM product_variants v
      WHERE v.product_id = p.id AND lower(v.sku) LIKE ${p}))`;
    conditions.push(hit);
    scores.push(`CASE WHEN ${hit} THEN ${10 * (all.length - i)} ELSE 0 END`);
  });
  for (const w of searchWords(search)) {
    const p = bind(`%${w}%`);
    conditions.push(`${HAYSTACK} LIKE ${p}`);
    scores.push(`CASE WHEN ${HAYSTACK} LIKE ${p} THEN 2 ELSE 0 END`);
  }
  if (await hasTrigram()) {
    const s = bind(search.toLowerCase());
    conditions.push(`word_similarity(${s}, lower(p.name)) > 0.4`);
    scores.push(`word_similarity(${s}, lower(p.name)) * 5`);
  }
  if (!conditions.length) return null;
  return { where: `(${conditions.join(' OR ')})`, score: `(${scores.join(' + ')})` };
};

/**
 * Records a shop search for the Search report. Instant search sends a query
 * as the shopper types, so a search that extends (or trims) the same
 * visitor's search from the last two minutes replaces it: "lap", "lapt",
 * "laptop" count once, as "laptop". Never fails the search itself.
 */
export const logSearch = async (term: string, results: number, visitor: string, userId: number | null) => {
  const normalized = term.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
  if (normalized.length < 2) return;
  try {
    const last = (
      await query(
        `SELECT id, normalized FROM search_queries
         WHERE visitor = $1 AND created_at > now() - interval '2 minutes' ORDER BY id DESC LIMIT 1`,
        [visitor]
      )
    ).rows[0];
    if (last && (normalized.startsWith(last.normalized) || last.normalized.startsWith(normalized))) {
      await query(
        'UPDATE search_queries SET term = $2, normalized = $3, results = $4, created_at = now() WHERE id = $1',
        [last.id, term.slice(0, 120), normalized, results]
      );
      return;
    }
    await query(
      'INSERT INTO search_queries (term, normalized, results, user_id, visitor) VALUES ($1, $2, $3, $4, $5)',
      [term.slice(0, 120), normalized, results, userId, visitor]
    );
  } catch (error) {
    console.error('Search log failed:', error);
  }
};
