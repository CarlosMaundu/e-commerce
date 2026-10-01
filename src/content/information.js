// src/content/information.js
//
// Stand-in for the OpenCart `information` endpoint (GET /information,
// GET /information/{id}) until the backend exists. `body` is null until the
// business supplies approved copy; the page then shows a "coming soon" state
// rather than invented text (especially for legal pages).

export const INFORMATION_PAGES = [
  { slug: 'about', title: 'About us', body: null },
  { slug: 'careers', title: 'Careers', body: null },
  { slug: 'press', title: 'Press', body: null },
  { slug: 'faq', title: 'Frequently asked questions', body: null },
  { slug: 'support', title: 'Support', body: null },
  { slug: 'documentation', title: 'Documentation', body: null },
  { slug: 'terms', title: 'Terms and conditions', body: null },
  { slug: 'privacy', title: 'Privacy policy', body: null },
];

export const getInformationPage = (slug) =>
  INFORMATION_PAGES.find((page) => page.slug === slug);
