// src/lib/demoMoney.ts — the demo catalog is written in US dollars. When the
// shop runs in another currency, demo prices are converted at a rough rate
// and rounded to shop-like amounts (KES 3,179 rather than 3,185.00).
import { finance } from './finance';

const PER_USD: Record<string, number> = {
  USD: 1, KES: 130, UGX: 3700, TZS: 2600, RWF: 1350, NGN: 1500, ZAR: 18, GHS: 15,
  EUR: 0.92, GBP: 0.79, INR: 84, AED: 3.67,
};

export const demoRate = () => PER_USD[finance().currency] ?? 1;

export const demoPrice = (usd: number) => {
  const rate = demoRate();
  if (rate === 1) return usd;
  if (rate < 10) return Math.round(usd * rate * 100) / 100;
  const rounded = Math.round((usd * rate) / 10) * 10;
  return rounded >= 100 ? rounded - 1 : rounded;
};

/** A round amount for thresholds and discounts (KES 6,500 for $50). */
export const demoAmount = (usd: number) =>
  demoRate() === 1 ? usd : Math.max(1, Math.round((usd * demoRate()) / 100)) * 100;

/** demoAmount as text for demo copy, e.g. "KES 6,500" or "$50". */
export const demoMoney = (usd: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: finance().currency,
    maximumFractionDigits: 0,
  }).format(demoAmount(usd));
