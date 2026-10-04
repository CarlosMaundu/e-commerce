// src/content/policies.js — Terms and conditions, Privacy policy and the
// Refund & Return Policy. Built from the shop's own settings (name, contact
// details, currency and VAT, return window, restocking fee), so they always
// match how the shop actually works.

export const POLICY_UPDATED = '2026-10-04';

export const POLICY_LINKS = [
  { slug: 'terms', label: 'Terms and conditions' },
  { slug: 'privacy', label: 'Privacy policy' },
  { slug: 'refunds', label: 'Refund & Return Policy' },
];

export const policyPath = (slug) => `/policies/${slug}`;

const contactLine = (shop) =>
  [
    shop.email && `email ${shop.email}`,
    shop.phone && `call ${shop.phone}`,
    shop.address && `write to ${shop.address}`,
  ]
    .filter(Boolean)
    .join(', ') || 'use the Support page';

const terms = (shop) => {
  const f = shop.finance || {};
  const tax = f.taxLabel || 'VAT';
  return {
    title: 'Terms and conditions',
    intro: `These terms apply when you use ${shop.name} and when you buy from us. By creating an account or placing an order you agree to them.`,
    sections: [
      {
        heading: 'About us',
        body: [
          `${shop.name} is an online shop. To reach us, ${contactLine(shop)}.`,
        ],
      },
      {
        heading: 'Your account',
        body: [
          'Give us accurate details and keep them up to date. Keep your password private; you’re responsible for what happens in your account.',
          'We may ask you to confirm your email address before you can sign in. We may suspend an account that is used for fraud or abuse.',
        ],
      },
      {
        heading: 'Orders',
        body: [
          'When you place an order you get an order number and a confirmation email. Your order is accepted when we start preparing it.',
          'We may cancel an order if an item is no longer available or was clearly priced in error. If you have already paid, we refund you in full.',
        ],
      },
      {
        heading: 'Prices and tax',
        body: [
          `Prices are in ${f.currency || 'KES'}. ${
            f.pricesIncludeTax
              ? `They include ${tax} at ${f.taxRate}%.`
              : `${tax} at ${f.taxRate}% is added at checkout.`
          } Delivery and any gift wrapping are shown before you pay.`,
          'Promo codes have their own conditions (for example a minimum spend or an end date) and can’t be exchanged for cash.',
        ],
      },
      {
        heading: 'Payment',
        list: [
          'Card payments are processed securely by Stripe. We never see or store your full card number.',
          'You can also pay by M-Pesa, bank transfer or cash on delivery where offered. Your invoice shows what is due and by when.',
          'Each payment has a reference (for example an M-Pesa code) that appears on your invoice.',
        ],
      },
      {
        heading: 'Delivery and collection',
        body: [
          'Delivery times are estimates. We keep you updated by email and in your account, where you can track your order.',
          'If you choose to pick up your order, bring your order number. The goods are your responsibility once delivered or collected.',
        ],
      },
      {
        heading: 'Gifts',
        body: [
          'If you send an item as a gift, we print your message on the packing slip, leave prices off it, and wrap the item in the gift box you chose. Gift boxes are charged as shown at checkout.',
        ],
      },
      {
        heading: 'Returns and refunds',
        body: [
          'You can return items as set out in our Refund & Return Policy, which forms part of these terms.',
        ],
        link: { slug: 'refunds', label: 'Read the Refund & Return Policy' },
      },
      {
        heading: 'Product information and reviews',
        body: [
          'We describe and photograph products as accurately as we can; colours may look slightly different on your screen.',
          'Reviews must be honest and about the product. We may remove reviews that are offensive, misleading or unrelated.',
        ],
      },
      {
        heading: 'Our responsibility to you',
        body: [
          'Nothing in these terms limits your rights under Kenyan consumer protection law. We are not responsible for losses that were not foreseeable, or for delays caused by events outside our control.',
        ],
      },
      {
        heading: 'Law and changes',
        body: [
          'These terms are governed by the laws of Kenya. We may update them; the version that applies to an order is the one shown when you placed it.',
        ],
      },
    ],
  };
};

const privacy = (shop) => ({
  title: 'Privacy policy',
  intro: `This policy explains what personal data ${shop.name} collects, why, and the choices you have. We process personal data in line with the Kenya Data Protection Act, 2019.`,
  sections: [
    {
      heading: 'What we collect',
      list: [
        'Account details: your name, email address, phone number and password (stored only as a secure hash). If you sign in with Google, your name, email and profile photo from Google.',
        'Delivery addresses you save, and the orders, invoices, payments, returns and refunds linked to your account.',
        'Payment references such as M-Pesa codes or bank references. Card details are handled by Stripe and never reach us.',
        'Gift details you add: the recipient’s name and your message.',
        'Security information: the device, browser and IP address of each sign-in, so you and we can see where your account is signed in.',
        'Reviews you write and, if you subscribe, your email for our newsletter.',
      ],
    },
    {
      heading: 'Why we use it',
      list: [
        'To process, deliver and support your orders, returns and refunds.',
        'To take payments and keep the invoices and accounting records the law requires.',
        'To keep your account and our shop secure, including stopping fraud.',
        'To send emails about your account and orders. We only send marketing emails if you subscribe, and every newsletter lets you unsubscribe.',
      ],
    },
    {
      heading: 'Who we share it with',
      body: [
        'Only with those who help us run the shop: Stripe for card payments, mobile money and bank partners for those payments, our delivery partners for your address and phone number, and our email provider. We share data with authorities only when the law requires it. We don’t sell your data.',
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        'We keep your account until you ask us to close it. Orders, invoices and payment records are kept for as long as tax law requires (in Kenya, usually at least five years), even after an account is closed.',
      ],
    },
    {
      heading: 'How we protect it',
      body: [
        'Connections to the shop are encrypted, passwords are hashed, and staff only see what their role needs. Staff access to customer accounts is recorded, and you can sign out of all your devices from your account.',
      ],
    },
    {
      heading: 'Cookies and storage',
      body: [
        'We use a secure cookie to keep you signed in, and your browser’s storage to remember your cart and preferences such as currency. We don’t use advertising cookies.',
      ],
    },
    {
      heading: 'Your rights',
      list: [
        'See the personal data we hold about you, and get a copy.',
        'Correct it. You can update most details yourself in your account.',
        'Ask us to delete it, or object to how we use it, where the law allows.',
        'Complain to the Office of the Data Protection Commissioner if you’re unhappy with how we handle your data.',
      ],
    },
    {
      heading: 'Contact',
      body: [
        `For anything about your data, ${contactLine(shop)}. We may update this policy; the date at the top shows the latest version.`,
      ],
    },
  ],
});

const refunds = (shop) => {
  const r = shop.returns || {};
  const days = r.windowDays || 0;
  const fee = r.restockingFeePercent || 0;
  return {
    title: 'Refund & Return Policy',
    intro: `If something isn’t right, you can return it. Here is how returns and refunds work at ${shop.name}.`,
    sections: [
      {
        heading: 'Returning an item',
        body: [
          days > 0
            ? `You can ask to return an item within ${days} days of delivery.`
            : 'You can ask to return an item after it has been delivered.',
          'Items should be unused and in their original packaging where possible. Tell us if you have opened the item; it helps us check it quickly.',
        ],
      },
      {
        heading: 'How it works',
        list: [
          'Sign in, open Your orders, choose the delivered order and select Return next to the item. Tell us the reason and how many you’re returning.',
          'We review your request and let you know. Once it’s approved, send the item back to us.',
          'When the item arrives we check it, and then refund you.',
          'You can follow each step under Returns in your account, including your refund.',
        ],
        link: { to: '/account/returns', label: 'Go to your returns' },
      },
      {
        heading: 'What we refund',
        list: [
          'The price you paid for the returned items.',
          fee > 0
            ? `A restocking fee of ${fee}% of the item price may be deducted. We tell you the amount before you’re refunded.`
            : 'We don’t charge a restocking fee.',
          r.refundDelivery
            ? 'If you return everything in an order, we also refund the delivery charge.'
            : 'Delivery charges aren’t refunded, unless the item arrived damaged or we sent the wrong item.',
        ],
      },
      {
        heading: 'How you’re refunded',
        list: [
          'Card payments are refunded to the same card. Your bank usually shows the money within 5–10 business days.',
          'M-Pesa, bank transfer and cash payments are refunded by M-Pesa or bank transfer.',
          'Some larger refunds are checked by a manager first, which can take a little longer.',
        ],
      },
      {
        heading: 'Damaged or wrong items',
        body: [
          `If an item arrives damaged or isn’t what you ordered, choose that reason when you request the return, or contact us: ${contactLine(shop)}. We’ll put it right.`,
        ],
      },
      {
        heading: 'Cancelling an order',
        body: [
          'You can ask us to cancel an order before it is dispatched. If you’ve already paid, we refund you in full.',
        ],
      },
    ],
  };
};

const BUILDERS = { terms, privacy, refunds };

/** The policy for a slug, filled in from the shop's settings. */
export const getPolicy = (slug, shop) => BUILDERS[slug]?.(shop) || null;
