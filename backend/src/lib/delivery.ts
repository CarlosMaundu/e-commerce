// src/lib/delivery.ts — the delivery options shoppers choose from at
// checkout: standard (with an optional free-delivery threshold), express and
// pick up. Each can be switched off, renamed and priced in Back office →
// Delivery options. Kept in memory like the financial settings.
import { z } from 'zod';
import { config } from '../config';
import { query } from '../db';

export const DELIVERY_CODES = ['standard', 'express', 'pickup'] as const;
export type DeliveryCode = (typeof DELIVERY_CODES)[number];

const price = z.coerce
  .number({ invalid_type_error: 'Please enter a price.' })
  .min(0, 'Prices can’t be negative.');
const name = z.string().trim().min(1, 'Please give this option a name.').max(60);
const text = (max: number) => z.string().trim().max(max).default('');

export const deliverySchema = z
  .object({
    standard: z.object({
      enabled: z.boolean(),
      title: name,
      description: text(160),
      price,
      // 0: never free.
      free_over: price,
    }),
    express: z.object({ enabled: z.boolean(), title: name, description: text(160), price }),
    pickup: z.object({
      enabled: z.boolean(),
      title: name,
      description: text(160),
      price,
      location: text(300),
      hours: text(160),
    }),
    // Sending an item as a gift: a free message, and an optional paid box.
    gift: z.object({
      enabled: z.boolean(),
      box_price: price,
      box_description: text(160),
    }),
  })
  .refine((d) => d.standard.enabled || d.express.enabled || d.pickup.enabled, {
    message: 'Keep at least one delivery option switched on.',
    path: ['standard', 'enabled'],
  })
  .refine((d) => !d.pickup.enabled || d.pickup.location.length > 0, {
    message: 'Tell shoppers where to pick up their order.',
    path: ['pickup', 'location'],
  });

export type Delivery = z.output<typeof deliverySchema>;

export const defaultDelivery = (): Delivery => ({
  standard: {
    enabled: true,
    title: 'Standard delivery',
    description: '3–5 business days.',
    price: config.shop.standardShipping,
    free_over: config.shop.freeShippingOver,
  },
  express: {
    enabled: true,
    title: 'Express delivery',
    description: '1–2 business days.',
    price: config.shop.expressShipping,
  },
  pickup: {
    enabled: false,
    title: 'Pick up in store',
    description: 'Ready within 24 hours. Bring your order number.',
    price: 0,
    location: '',
    hours: 'Mon–Sat, 9am–6pm',
  },
  gift: {
    enabled: true,
    box_price: config.shop.giftBoxPrice,
    box_description: 'We’ll wrap your gift in a silver box with ribbons.',
  },
});

let current: Delivery = defaultDelivery();

export const delivery = () => current;

/** Saved values over the defaults, section by section. */
const merge = (base: Delivery, saved: any = {}) => ({
  standard: { ...base.standard, ...(saved.standard || {}) },
  express: { ...base.express, ...(saved.express || {}) },
  pickup: { ...base.pickup, ...(saved.pickup || {}) },
  gift: { ...base.gift, ...(saved.gift || {}) },
});

export const mergeDelivery = merge;

export const loadDelivery = async () => {
  const row = (await query('SELECT settings FROM delivery_settings WHERE id = 1')).rows[0];
  const parsed = deliverySchema.safeParse(merge(defaultDelivery(), row?.settings));
  current = parsed.success ? parsed.data : defaultDelivery();
  return current;
};

export const saveDelivery = async (settings: Delivery, userId: number) => {
  await query(
    `INSERT INTO delivery_settings (id, settings, updated_by, updated_at) VALUES (1, $1, $2, now())
     ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(settings), userId]
  );
  current = settings;
};
