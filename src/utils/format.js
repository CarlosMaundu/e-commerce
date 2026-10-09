// src/utils/format.js — consistent money and date formatting. The currency
// comes from Back office → Financial settings (via StoreContext); the last
// one seen is remembered so prices render right on the next visit.
const CURRENCY_KEY = 'shop-currency';
let currency = (() => {
  try {
    return localStorage.getItem(CURRENCY_KEY) || 'KES';
  } catch {
    return 'KES';
  }
})();

export const getCurrency = () => currency;
/** True when a currency from an earlier visit is known. */
export const hasRememberedCurrency = () => {
  try {
    return Boolean(localStorage.getItem(CURRENCY_KEY));
  } catch {
    return false;
  }
};
export const setCurrency = (code) => {
  currency = code;
  try {
    localStorage.setItem(CURRENCY_KEY, code);
  } catch {
    // storage unavailable: this visit only
  }
};

export const formatMoney = (value, code = currency) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(
    Number(value || 0)
  );

/** Short money for big figures: $6.28M, $753K; exact below 10,000. */
export const formatMoneyCompact = (value, code = currency) => {
  const n = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    ...(Math.abs(n) >= 10000
      ? { notation: 'compact', maximumFractionDigits: 2 }
      : { maximumFractionDigits: 0 }),
  }).format(n);
};

export const formatDate = (value, options = {}) =>
  value
    ? new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...options,
      }).format(new Date(value))
    : '';

/**
 * Money that may be in several currencies, never added across them:
 * [{ currency, amount }] → "KES 100.00 · USD 10.00" (zero when empty).
 */
export const formatMoneyList = (list) => {
  const items = (list || []).filter((x) => Number(x.amount));
  if (!items.length) return formatMoney(0);
  return items.map((x) => formatMoney(x.amount, x.currency)).join(' · ');
};

/** Groups amounts by currency: [{ currency, amount }] → [{ currency, amount }]. */
export const totalsByCurrency = (rows, pick = (r) => r.amount) => {
  const map = new Map();
  (rows || []).forEach((r) => {
    const c = r.currency || currency;
    map.set(c, (map.get(c) || 0) + Number(pick(r) || 0));
  });
  return [...map].map(([c, amount]) => ({ currency: c, amount }));
};

/** Compact table dates: dd-mm-yy (full time is on the detail view). */
export const formatShortDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  const two = (n) => String(n).padStart(2, '0');
  return `${two(d.getDate())}-${two(d.getMonth() + 1)}-${two(
    d.getFullYear() % 100
  )}`;
};

/** Saves rows as a CSV file (header row first). */
export const downloadCsv = (filename, header, rows) => {
  const cell = (v) => {
    const t = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const text = [header, ...rows].map((r) => r.map(cell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

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
