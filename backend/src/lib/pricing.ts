// src/lib/pricing.ts — every price the customer pays is calculated here, on
// the server. The browser only displays these numbers.
import { config } from '../config';
import { query } from '../db';
import { fail } from './http';

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface CartLine {
  key: number;
  product_id: number;
  name: string;
  image: string;
  options: Record<string, string>;
  quantity: number;
  price: number;
  special: number | null;
  unit_price: number;
  total: number;
  stock: number;
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

export const SHIPPING_METHODS = () => [
  {
    code: 'standard',
    title: 'Standard delivery',
    description: `3–5 business days. Free on orders over ${money(config.shop.freeShippingOver)}.`,
    cost: config.shop.standardShipping,
  },
  {
    code: 'express',
    title: 'Express delivery',
    description: '1–2 business days.',
    cost: config.shop.expressShipping,
  },
];

export const PAYMENT_METHODS = () => [
  { code: 'cod', title: 'Cash on delivery', description: 'Pay when your order arrives.' },
  ...(config.stripe.secretKey
    ? [{
        code: 'stripe',
        title: 'Credit or debit card',
        description: 'Paid securely through Stripe.',
        publishable_key: config.stripe.publishableKey,
      }]
    : []),
];

export const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: config.shop.currency }).format(n);

type Db = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

export const loadCartLines = async (userId: number, db: Db = { query: (t, p) => query(t, p) }): Promise<CartLine[]> => {
  const { rows } = await db.query(
    `SELECT ci.id AS key, ci.product_id, ci.quantity, ci.options,
            p.name, p.images, p.price, p.special, p.quantity AS stock
     FROM cart_items ci JOIN products p ON p.id = ci.product_id
     WHERE ci.user_id = $1 ORDER BY ci.id`,
    [userId]
  );
  return rows.map((r: any) => {
    const price = Number(r.price);
    const special = r.special === null ? null : Number(r.special);
    const unit = special ?? price;
    return {
      key: r.key,
      product_id: r.product_id,
      name: r.name,
      image: r.images[0] || '',
      options: r.options,
      quantity: r.quantity,
      price,
      special,
      unit_price: unit,
      total: round2(unit * r.quantity),
      stock: r.stock,
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
  const goods = round2(subtotal - discount);
  const method = SHIPPING_METHODS().find((m) => m.code === shippingMethod);
  let shipping = method ? method.cost : 0;
  if (method?.code === 'standard' && goods >= config.shop.freeShippingOver) shipping = 0;
  if (!lines.length) shipping = 0;
  const tax = round2(goods * config.shop.taxRate);
  const total = round2(goods + shipping + tax);

  const out: Totals['lines'] = [{ code: 'sub_total', title: 'Subtotal', value: subtotal }];
  if (discount) out.push({ code: 'coupon', title: `Promo code (${usable!.code})`, value: -discount });
  if (method) out.push({ code: 'shipping', title: method.title, value: shipping });
  out.push({ code: 'tax', title: `Tax (${round2(config.shop.taxRate * 100)}%)`, value: tax });
  out.push({ code: 'total', title: 'Total', value: total });

  return {
    subtotal,
    discount,
    shipping,
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
