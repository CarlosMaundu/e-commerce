// src/components/common/LegalContent.js — a legal page's formatted text
// (headings, paragraphs, bold, italics, lists, links, quotes, dividers) in
// the shop's typography, laid out for comfortable reading. Section headings
// get ids so the page can link to them.
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Box } from '@mui/material';
import { toSafeHtml } from '../../utils/richText';

export const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

/** Adds ids to <h2> headings and lists them for a table of contents. */
export const withHeadingIds = (html) => {
  const toc = [];
  const out = (html || '').replace(
    /<h2([^>]*)>([\s\S]*?)<\/h2>/g,
    (m, attrs, inner) => {
      const text = inner.replace(/<[^>]+>/g, '').trim();
      const id = slugify(text) || `section-${toc.length + 1}`;
      toc.push({ id, text });
      return `<h2${attrs} id="${id}">${inner}</h2>`;
    }
  );
  return { html: out, toc };
};

export const legalSx = {
  color: 'text.primary',
  fontSize: '1rem',
  lineHeight: 1.75,
  maxWidth: '75ch',
  '& p': { m: 0, mb: 1.75 },
  '& h2': {
    fontSize: { xs: '1.25rem', md: '1.4rem' },
    fontWeight: 700,
    lineHeight: 1.3,
    mt: 5,
    mb: 1.5,
    scrollMarginTop: 120,
  },
  '& h3': { fontSize: '1.1rem', fontWeight: 700, mt: 3, mb: 1 },
  '& h4': { fontSize: '1rem', fontWeight: 700, mt: 2.5, mb: 0.75 },
  '& > :first-of-type': { mt: 0 },
  '& ul, & ol': { pl: 3.5, mt: 0, mb: 1.75 },
  '& li': { mb: 0.75, pl: 0.5 },
  '& li > p': { mb: 0.5 },
  '& a': {
    color: 'primary.main',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
  '& strong, & b': { fontWeight: 700 },
  '& blockquote': {
    m: 0,
    my: 2,
    px: 2,
    py: 1.25,
    borderLeft: 4,
    borderColor: 'primary.main',
    bgcolor: 'background.neutral',
    borderRadius: '0 8px 8px 0',
  },
  '& hr': { border: 0, borderTop: 1, borderColor: 'divider', my: 4 },
};

const LegalContent = ({ html, sx, ...rest }) => {
  const safe = useMemo(() => withHeadingIds(toSafeHtml(html)).html, [html]);
  return (
    <Box
      sx={{ ...legalSx, ...sx }}
      // Sanitised on the server when saved, and again by toSafeHtml.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: safe }}
      {...rest}
    />
  );
};

LegalContent.propTypes = { html: PropTypes.string, sx: PropTypes.object };

export default LegalContent;
