// src/utils/colors.js — swatch colours for variation values such as "Navy".

const NAMED = {
  black: '#1B1B1B',
  white: '#F7F7F5',
  gray: '#9AA0A6',
  grey: '#9AA0A6',
  stone: '#BDB7AB',
  silver: '#C9CCD1',
  blue: '#2F6FDB',
  navy: '#1F2A44',
  red: '#D32F2F',
  ruby: '#9B111E',
  green: '#2E7D32',
  sage: '#A3B18A',
  olive: '#708238',
  cream: '#F1E7D0',
  beige: '#D9C8A9',
  camel: '#C19A6B',
  brown: '#7B4B2A',
  pink: '#F48FB1',
  rose: '#E8A0A8',
  nude: '#D8A48F',
  berry: '#8E3B5B',
  yellow: '#F2C14E',
  orange: '#F27A1A',
  purple: '#7E57C2',
  tortoise:
    'linear-gradient(135deg, #5B3A1E 0 30%, #C08A4A 30% 55%, #3B2412 55%)',
  plaid:
    'repeating-linear-gradient(0deg, #8C8C8C 0 4px, #E0DCD3 4px 8px), #E0DCD3',
  floral:
    'radial-gradient(circle at 30% 30%, #E57373 0 22%, transparent 23%), radial-gradient(circle at 70% 65%, #81C784 0 18%, transparent 19%), #FFF8EE',
};

/** CSS background for a colour name; unknown names get a steady hue. */
export const swatchFor = (name = '') => {
  const key = name.trim().toLowerCase();
  if (NAMED[key]) return NAMED[key];
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${hash}, 45%, 55%)`;
};

/** True for attributes that are colours (shown as swatches). */
export const isColorAttribute = (name = '') =>
  /^(colou?r|shade)$/i.test(name.trim());
