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
