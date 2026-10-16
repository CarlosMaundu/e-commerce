// src/lib/time.ts — dates in the shop's time zone (config.shopTimezone).
import { config } from '../config';

const parts = (date: Date, timeZone: string) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );

/** YYYY-MM-DD in the shop's time zone (or another one). */
export const shopDate = (date = new Date(), timeZone = config.shopTimezone) => {
  const p = parts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
};

/** YYYYMMDDHHmmss in a time zone (M-Pesa wants Nairobi time). */
export const compactTimestamp = (timeZone: string, date = new Date()) => {
  const p = parts(date, timeZone);
  return `${p.year}${p.month}${p.day}${p.hour}${p.minute}${p.second}`;
};
