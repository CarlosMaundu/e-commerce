// src/lib/pricing.ts — every price the customer pays is calculated here, on
// the server. The browser only displays these numbers.
import { config } from '../config';
import { query } from '../db';
import { delivery } from './delivery';
import { finance } from './finance';
import { fail } from './http';
import { stockOf } from './products';

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface CartLine {
  key: number;
  product_id: number;
  variant_id: number | null;
  name: string;
  image: string;
  options: Record<string, string>;
  quantity: number;
  price: number;
  special: number | null;
  unit_price: number;
  total: number;
  stock: number;
  gift?: GiftChoice | null;
}

/** Sending a line as a gift: who it's to and from, a message, a gift box. */
export interface GiftChoice {
  to: string;
  from: string;
  message: string;
  gift_box: boolean;
}

export interface Coupon {
  code: string;
  description: string;
  type: 'percent' | 'fixed';
  value: string;
  min_total: string;
  starts_at: Date | null;
  ends_at: Date | null;
  uses_limit: number | null;
  uses_count: number;
  active: boolean;
}

/** The delivery options switched on in Back office → Delivery options. */
export const SHIPPING_METHODS = () => {
  const d = delivery();
  return [
    d.standard.enabled && {
      code: 'standard',
      title: d.standard.title,
      description: [
        d.standard.description,
        d.standard.free_over ? `Free on orders over ${money(d.standard.free_over)}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
      cost: d.standard.price,
    },
    d.express.enabled && {
      code: 'express',
      title: d.express.title,
      description: d.express.description,
      cost: d.express.price,
    },
    d.pickup.enabled && {
      code: 'pickup',
      title: d.pickup.title,
      description: [d.pickup.location, d.pickup.hours, d.pickup.description].filter(Boolean).join(' · '),
      cost: d.pickup.price,
      pickup: { location: d.pickup.location, hours: d.pickup.hours },
    },
  ].filter(Boolean) as { code: string; title: string; description: string; cost: number; pickup?: object }[];
};

export const PAYMENT_METHODS = () => [
  { code: 'cod', title: 'Cash on delivery', description: 'Pay when your order arrives.' },
  ...(config.stripe.secretKey && config.stripe.publishableKey
    ? [{
        code: 'stripe',
        title: 'Credit or debit card',
        description: 'Paid securely through Stripe.',
        publishable_key: config.stripe.publishableKey,
      }]
    : []),
];

export const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: finance().currency }).format(n);

/**
 * Tax on goods worth `goods`, and the order total. When prices include tax
 * (the Kenyan norm) the tax is the part already inside the price and the
 * total doesn't grow; otherwise tax is added on top.
 */
export const applyTax = (goods: number, shipping: number) => {
  const { tax_rate: rate, prices_include_tax: included } = finance();
  const tax = included ? round2(goods - goods / (1 + rate / 100)) : round2((goods * rate) / 100);
  return { tax, total: round2(goods + shipping + (included ? 0 : tax)) };
};

export const taxTitle = () => {
  const f = finance();
  return f.prices_include_tax ? `Includes ${f.tax_label} (${f.tax_rate}%)` : `${f.tax_label} (${f.tax_rate}%)`;
};

type Db = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

export const loadCartLines = async (userId: number, db: Db = { query: (t, p) => query(t, p) }): Promise<CartLine[]> => {
  const { rows } = await db.query(
    `SELECT ci.id AS key, ci.product_id, ci.variant_id, ci.quantity, ci.options, ci.gift,
            p.name, p.images, p.price, p.special, p.quantity AS product_stock, p.track_inventory,
            v.price AS v_price, v.special AS v_special, v.quantity AS v_stock, v.images AS v_images
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     LEFT JOIN product_variants v ON v.id = ci.variant_id
     WHERE ci.user_id = $1 ORDER BY ci.id`,
    [userId]
  );
  return rows.map((r: any) => {
    // A variant with its own price uses its own sale price too.
    const own = r.v_price !== null && r.v_price !== undefined;
    const price = Number(own ? r.v_price : r.price);
    const rawSpecial = own ? r.v_special : r.special;
    const special = rawSpecial === null || rawSpecial === undefined ? null : Number(rawSpecial);
    const unit = special ?? price;
    const stock = r.variant_id ? r.v_stock : r.product_stock;
    return {
      key: r.key,
      product_id: r.product_id,
      variant_id: r.variant_id,
      name: r.name,
      image: (r.v_images && r.v_images[0]) || r.images[0] || '',
      options: r.options,
      quantity: r.quantity,
      price,
      special,
      unit_price: unit,
      total: round2(unit * r.quantity),
      stock: stockOf(r.track_inventory, stock),
      gift: r.gift || null,
    };
  });
};

/** Why a coupon can't be used right now, or null when it can. */
export const couponProblem = (coupon: Coupon | undefined, subtotal: number): string | null => {
  const now = new Date();
  if (!coupon || !coupon.active) return 'That promo code isn’t valid.';
  if (coupon.starts_at && coupon.starts_at > now) return 'That promo code isn’t active yet.';
  if (coupon.ends_at && coupon.ends_at < now) return 'That promo code has expired.';
  if (coupon.uses_limit !== null && coupon.uses_count >= coupon.uses_limit) {
    return 'That promo code has been fully used.';
  }
  if (subtotal < Number(coupon.min_total)) {
    return `That promo code needs an order of at least ${money(Number(coupon.min_total))}.`;
  }
  return null;
};

export const findCoupon = async (code: string) =>
  (await query<Coupon>('SELECT * FROM coupons WHERE code = upper($1)', [code.trim()])).rows[0];

export interface Totals {
  subtotal: number;
  discount: number;
  shipping: number;
  gift: number;
  tax: number;
  total: number;
  coupon: { code: string; description: string } | null;
  coupon_problem: string | null;
  lines: { code: string; title: string; value: number }[];
}

export const computeTotals = (
  lines: CartLine[],
  coupon: Coupon | undefined,
  shippingMethod: string | null
): Totals => {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.total, 0));
  const problem = coupon ? couponProblem(coupon, subtotal) : null;
  const usable = coupon && !problem ? coupon : undefined;
  let discount = 0;
  if (usable) {
    discount =
      usable.type === 'percent'
        ? round2((subtotal * Number(usable.value)) / 100)
        : Math.min(round2(Number(usable.value)), subtotal);
  }
  // A gift box per line sent in one (taxed like the goods).
  const giftBoxes = lines.filter((l) => l.gift?.gift_box).length;
  const gift = round2(giftBoxes * delivery().gift.box_price);
  const goods = round2(subtotal - discount + gift);
  const method = SHIPPING_METHODS().find((m) => m.code === shippingMethod);
  let shipping = method ? method.cost : 0;
  const freeOver = delivery().standard.free_over;
  if (method?.code === 'standard' && freeOver > 0 && goods - gift >= freeOver) shipping = 0;
  if (!lines.length) shipping = 0;
  const { tax, total } = applyTax(goods, shipping);

  const out: Totals['lines'] = [{ code: 'sub_total', title: 'Subtotal', value: subtotal }];
  if (discount) out.push({ code: 'coupon', title: `Promo code (${usable!.code})`, value: -discount });
  if (gift) out.push({ code: 'gift_wrap', title: `Gift box${giftBoxes > 1 ? `es (${giftBoxes})` : ''}`, value: gift });
  if (method) out.push({ code: 'shipping', title: method.title, value: shipping });
  out.push({ code: 'tax', title: taxTitle(), value: tax });
  out.push({ code: 'total', title: 'Total', value: total });

  return {
    subtotal,
    discount,
    shipping,
    gift,
    tax,
    total,
    coupon: usable ? { code: usable.code, description: usable.description } : null,
    coupon_problem: problem,
    lines: out,
  };
};

export const checkStock = (lines: CartLine[]) => {
  for (const line of lines) {
    if (line.stock <= 0) fail(409, `“${line.name}” is out of stock. Please remove it from your cart.`);
    if (line.quantity > line.stock) {
      fail(409, `Only ${line.stock} of “${line.name}” left. Please lower the quantity in your cart.`);
    }
  }
};
