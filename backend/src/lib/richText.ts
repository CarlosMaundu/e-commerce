// src/lib/richText.ts — product descriptions are formatted text (HTML from
// the back-office editor). Only simple formatting survives; scripts, styles
// other than text alignment, and unsafe links are removed before saving.
import sanitizeHtml from 'sanitize-html';

const ALIGN = [/^left$/, /^right$/, /^center$/, /^justify$/];

export const cleanRichText = (html: string) =>
  sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'h4', 'blockquote'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      p: ['style'],
      h2: ['style'],
      h3: ['style'],
      h4: ['style'],
    },
    allowedStyles: { '*': { 'text-align': ALIGN } },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
    },
  }).trim();
