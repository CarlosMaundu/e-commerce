// src/tests/shopDate.test.js — back-office date ranges use the shop's
// calendar day (Nairobi), not the viewer's clock or UTC.
import { shopDaysAgo, shopToday } from '../utils/format';

test('late evening UTC is already the next day in the shop', () => {
  const now = new Date('2026-10-20T23:15:00Z'); // 02:15 on the 21st in Nairobi
  expect(shopToday(now)).toBe('2026-10-21');
  expect(shopDaysAgo(29, now)).toBe('2026-09-22');
});

test('days ago crosses month ends', () => {
  const now = new Date('2026-03-01T09:00:00Z');
  expect(shopToday(now)).toBe('2026-03-01');
  expect(shopDaysAgo(1, now)).toBe('2026-02-28');
});
