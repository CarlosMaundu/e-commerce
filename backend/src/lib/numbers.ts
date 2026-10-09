// src/lib/numbers.ts — order and invoice numbers, and payment references in
// the formats people recognise. Generated in the app (no database counters),
// from the time plus a random part so two at the same moment don't collide.
import { randomInt } from 'crypto';

const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const pick = (chars: string, n: number) => Array.from({ length: n }, () => chars[randomInt(chars.length)]).join('');
const digits = (n: number) => pick('0123456789', n);

/** Date parts in the shop's time zone (East Africa Time). */
const parts = (at: Date | string = new Date()) => {
  const d = new Date(at);
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)!.value;
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute'), s: get('second') };
};
const ymd = (at?: Date | string) => {
  const p = parts(at);
  return `${p.y}${p.m}${p.d}`;
};

// Seconds since 2024-01-01 in base 36: six characters until the 2090s.
const EPOCH = Date.UTC(2024, 0, 1);

/**
 * Order numbers: [channel]-[time in base 36][3 random], e.g. WEB-1FT3K9X7Q:
 * 46,656 possibilities per second. Inserts still go through insertNumbered,
 * which picks a new number if one is ever taken.
 */
export type Channel = 'WEB' | 'STF';
export const orderNumber = (channel: Channel = 'WEB', at: Date | string = new Date()) => {
  const secs = Math.max(0, Math.floor((new Date(at).getTime() - EPOCH) / 1000));
  return `${channel}-${secs.toString(36).toUpperCase().padStart(6, '0')}${pick(ALNUM, 3)}`;
};

/**
 * Runs an INSERT … ON CONFLICT (number) DO NOTHING RETURNING … with a fresh
 * number until a row comes back. Safe inside transactions: a taken number
 * returns no row instead of raising (which would abort the transaction).
 */
export const insertNumbered = async <T>(make: () => string, run: (number: string) => Promise<T[]>, attempts = 8) => {
  for (let i = 0; i < attempts; i += 1) {
    const rows = await run(make());
    if (rows.length) return rows;
  }
  throw new Error('Could not find a free number after several attempts.');
};

/** Invoice numbers: INV-YYYYMMDD-HHMMSS-XXXX, e.g. INV-20261004-204015-X7R2. */
export const invoiceNumber = (at: Date | string = new Date()) => {
  const p = parts(at);
  return `INV-${p.y}${p.m}${p.d}-${p.h}${p.min}${p.s}-${pick(ALNUM, 4)}`;
};

// ---------- payment references ----------

/** M-Pesa receipt, e.g. RG41RE78XZ: year and month letters, then 8 characters. */
export const mpesaRef = (at: Date | string = new Date()) => {
  const p = parts(at);
  const year = LETTERS[(Number(p.y) - 2023 + 17) % 26]; // 2023 → R, 2024 → S …
  const month = LETTERS[Number(p.m) - 1];
  return `${year}${month}${digits(2)}${pick(LETTERS, 2)}${digits(2)}${pick(LETTERS, 2)}`;
};
/** SWIFT transfer, e.g. MT103-20261004-A. */
export const swiftRef = (at?: Date | string) => `MT103-${ymd(at)}-${pick(LETTERS, 1)}`;
/** RTGS, e.g. FT262770891234: FT, year, day of the year, then 7 digits. */
export const rtgsRef = (at: Date | string = new Date()) => {
  const p = parts(at);
  const start = Date.UTC(Number(p.y), 0, 1);
  const day = Math.floor((Date.UTC(Number(p.y), Number(p.m) - 1, Number(p.d)) - start) / 86400000) + 1;
  return `FT${p.y.slice(2)}${String(day).padStart(3, '0')}${digits(7)}`;
};
/** PesaLink, e.g. PLK984321098543. */
export const pesalinkRef = () => `PLK${digits(12)}`;
/** Cash receipt, e.g. RCT-20261004-4821. */
export const cashReceipt = (at?: Date | string) => `RCT-${ymd(at)}-${digits(4)}`;
/** Stripe-shaped ids for demo card payments and refunds. */
export const stripeLikeRef = (prefix: 'pi' | 're') =>
  `${prefix}_3${pick(ALNUM + 'abcdefghijklmnopqrstuvwxyz', 23)}`;
/** A bank reference of one of the three kinds. */
export const bankRef = (at?: Date | string) => [swiftRef, rtgsRef, pesalinkRef][randomInt(3)](at as any);
