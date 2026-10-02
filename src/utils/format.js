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

export const optionText = (options = {}) =>
  [options.size && `Size ${options.size}`, options.color]
    .filter(Boolean)
    .join(' · ');

export const percentChange = (current, previous) => {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};
