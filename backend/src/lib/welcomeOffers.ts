// src/lib/welcomeOffers.ts — promo codes marked "email to new customers when
// they sign up": sent once, right after a shopper creates an account.
import { config } from '../config';
import { query } from '../db';
import { sendWelcomeOfferEmail } from './mailer';
import { money } from './pricing';

const describe = (c: any) => {
  const off = c.type === 'percent' ? `${Number(c.value)}% off` : `${money(Number(c.value))} off`;
  const rule = c.audience === 'first_order' ? ' your first order' : c.audience === 'new_customers' ? ` orders in your first ${c.new_customer_days || 30} days` : ' your order';
  const min = Number(c.min_total) > 0 ? ` over ${money(Number(c.min_total))}` : '';
  return `${off}${rule}${min}`;
};

/** Emails the active sign-up offers; never fails the sign-up. */
export const sendWelcomeOffers = async (user: { email: string; firstname: string }) => {
  try {
    const offers = (
      await query(
        `SELECT * FROM coupons WHERE active AND send_on_signup
           AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())
           AND (uses_limit IS NULL OR uses_count < uses_limit)
         ORDER BY created_at`
      )
    ).rows;
    if (!offers.length) return;
    await sendWelcomeOfferEmail(
      user.email,
      user.firstname,
      offers.map((c) => ({ code: c.code, text: describe(c) })),
      `${config.frontendUrl.replace(/\/$/, '')}/products`
    );
  } catch (error) {
    console.error('Welcome offer email failed:', error);
  }
};
