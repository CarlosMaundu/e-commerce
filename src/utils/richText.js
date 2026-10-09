// src/utils/richText.js — product descriptions are formatted HTML from the
// back-office editor; older ones are plain text ("• " lines are bullets).
// Everything is sanitised again here before it reaches the page.
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'a',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'hr',
];

export const isHtml = (text = '') => /<\/?[a-z][\s\S]*>/i.test(text);

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Plain text to simple HTML: blank-line paragraphs, "• " lists. */
export const textToHtml = (text = '') =>
  text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n').filter((l) => l.trim());
      if (lines.length && lines.every((l) => /^\s*[•\-*]\s+/.test(l))) {
        return `<ul>${lines
          .map((l) => `<li>${escape(l.replace(/^\s*[•\-*]\s+/, ''))}</li>`)
          .join('')}</ul>`;
      }
      return `<p>${lines.map(escape).join('<br>')}</p>`;
    })
    .join('');

/** Safe HTML for any description, old or new. */
export const toSafeHtml = (description = '') =>
  DOMPurify.sanitize(
    isHtml(description) ? description : textToHtml(description),
    {
      ALLOWED_TAGS,
      ALLOWED_ATTR: ['href', 'target', 'rel', 'style'],
    }
  );

/** Description without formatting, for snippets and meta text. */
export const plainText = (description = '') => {
  if (!isHtml(description)) return description;
  const div = document.createElement('div');
  div.innerHTML = DOMPurify.sanitize(description);
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
};

/** True when the editor holds no words (e.g. "<p></p>"). */
export const isBlankHtml = (html = '') => !plainText(html).trim();
