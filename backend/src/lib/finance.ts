// src/lib/finance.ts — the shop's money rules: currency, tax (name, rate and
// whether prices already include it) and delivery prices. Edited in Back
// office → Financial settings; defaults come from the environment (KES, VAT
// 16%, prices including VAT). Kept in memory so pricing stays synchronous;
// loadFinance() runs at start-up and saveFinance() updates the copy.
import { z } from 'zod';
import { config } from '../config';
import { query } from '../db';

export const financeSchema = z.object({
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Please choose a three-letter currency code, such as KES.'),
  tax_label: z.string().trim().min(1, 'Please name the tax, for example VAT.').max(20),
  tax_rate: z.coerce
    .number({ invalid_type_error: 'Please enter the tax rate as a number.' })
    .min(0, 'The tax rate can’t be negative.')
    .max(100, 'The tax rate must be 100% or less.'),
  prices_include_tax: z.boolean(),
  standard_shipping: z.coerce.number().min(0, 'Delivery prices can’t be negative.'),
  express_shipping: z.coerce.number().min(0, 'Delivery prices can’t be negative.'),
  // 0 means standard delivery is never free.
  free_shipping_over: z.coerce.number().min(0, 'The free-delivery threshold can’t be negative.'),
});

export type Finance = z.output<typeof financeSchema>;

export const defaultFinance = (): Finance => ({
  currency: config.shop.currency,
  tax_label: config.shop.taxLabel,
  tax_rate: Math.round(config.shop.taxRate * 10000) / 100,
  prices_include_tax: config.shop.pricesIncludeTax,
  standard_shipping: config.shop.standardShipping,
  express_shipping: config.shop.expressShipping,
  free_shipping_over: config.shop.freeShippingOver,
});

let current: Finance = defaultFinance();

/** The rules in force now (synchronous; see loadFinance). */
export const finance = () => current;

export const loadFinance = async () => {
  const row = (await query('SELECT settings FROM finance_settings WHERE id = 1')).rows[0];
  const parsed = financeSchema.safeParse({ ...defaultFinance(), ...(row?.settings || {}) });
  current = parsed.success ? parsed.data : defaultFinance();
  return current;
};

export const saveFinance = async (settings: Finance, userId: number) => {
  await query(
    `INSERT INTO finance_settings (id, settings, updated_by, updated_at) VALUES (1, $1, $2, now())
     ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(settings), userId]
  );
  current = settings;
};

/** What shoppers see: currency and how tax is shown. */
export const publicFinance = () => {
  const f = finance();
  return {
    currency: f.currency,
    tax_label: f.tax_label,
    tax_rate: f.tax_rate,
    prices_include_tax: f.prices_include_tax,
    free_shipping_over: f.free_shipping_over,
  };
};
