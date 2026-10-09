// src/content/policies.js — the legal pages and their addresses. The text
// itself is edited in Back office → Legal pages (GET /rest/legal/:slug).

export const POLICY_LINKS = [
  { slug: 'terms', label: 'Terms and conditions' },
  { slug: 'privacy', label: 'Privacy policy' },
  { slug: 'refunds', label: 'Refund & Return Policy' },
];

export const policyPath = (slug) => `/policies/${slug}`;
