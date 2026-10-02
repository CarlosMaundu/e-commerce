// src/utils/format.js — consistent money and date formatting.
const currency = 'USD';

export const formatMoney = (value, code = currency) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(
    Number(value || 0)
  );

export const formatDate = (value, options = {}) =>
  value
    ? new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...options,
      }).format(new Date(value))
    : '';

export const formatDateTime = (value) =>
  formatDate(value, { hour: 'numeric', minute: '2-digit' });

/** "Color: Black · Size: M" for a cart or order line's chosen options. */
export const optionText = (options = {}) =>
  Object.entries(options || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k.charAt(0).toUpperCase()}${k.slice(1)}: ${v}`)
    .join(' · ');

export const percentChange = (current, previous) => {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};
