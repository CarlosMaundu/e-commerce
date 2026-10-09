// src/lib/faqDefaults.ts — the FAQ a new shop starts with (seeded once, then
// edited in Back office → FAQ). {{placeholders}} come from the settings.
export const FAQ_DEFAULTS: { category: string; question: string; answer: string }[] = [
  {
    category: 'Orders',
    question: 'How do I place an order?',
    answer: '<p>Add the items you want to your cart, then select <strong>Checkout</strong>. Choose a delivery address and option, pick how you want to pay and place your order. You will get an order number and a confirmation email straight away.</p>',
  },
  {
    category: 'Orders',
    question: 'Can I change or cancel my order?',
    answer: '<p>You can cancel an order any time before it is dispatched. Send us a request from the <a href="/support">Support</a> page with your order number and we will cancel it and refund any payment in full. Once an order has left us, please use the returns process instead.</p>',
  },
  {
    category: 'Orders',
    question: 'How do I track my order?',
    answer: '<p>Sign in and open <a href="/account/orders">Your orders</a>, or use <a href="/account/track">Track an order</a> with your order number. We also email you when your order ships and when it is delivered.</p>',
  },
  {
    category: 'Delivery',
    question: 'How long does delivery take, and how much does it cost?',
    answer: '<p>The delivery options, prices and estimated times available for your address are shown at checkout before you pay. Express delivery is faster; you can also choose to pick up your order where available.</p>',
  },
  {
    category: 'Delivery',
    question: 'What if I’m not home when my order arrives?',
    answer: '<p>Our courier will usually call you on the phone number you gave us. If delivery can’t be completed, contact us and we will arrange another attempt.</p>',
  },
  {
    category: 'Payment',
    question: 'Which payment methods do you accept?',
    answer: '<p>We accept card payments (processed securely by Stripe), and where available M-Pesa, bank transfer and cash on delivery. Prices are in {{currency}}. {{prices_tax_sentence}}</p>',
  },
  {
    category: 'Payment',
    question: 'Is it safe to pay by card on your website?',
    answer: '<p>Yes. Card payments are handled by Stripe, a certified payment provider. Your full card number never reaches our systems.</p>',
  },
  {
    category: 'Returns and refunds',
    question: 'Can I return an item?',
    answer: '<p>Yes. You can ask to return an item within <strong>{{return_window_days}} days</strong> of delivery from <a href="/account/orders">Your orders</a>. See our <a href="/policies/refunds">Refund &amp; Return Policy</a> for what can be returned and how.</p>',
  },
  {
    category: 'Returns and refunds',
    question: 'When will I get my refund?',
    answer: '<p>We refund you once the returned item reaches us and has been checked, usually within 7 days. Card refunds go back to the same card and normally show within 5 to 10 business days. You can see every refund under <a href="/account/refunds">Refunds</a> in your account.</p>',
  },
  {
    category: 'Your account',
    question: 'I forgot my password. What should I do?',
    answer: '<p>Select <strong>Forgot password</strong> on the sign-in page and enter your email address. We will email you a link to choose a new password.</p>',
  },
  {
    category: 'Your account',
    question: 'How do I update my details or close my account?',
    answer: '<p>You can update your name, phone number, addresses and password in your account. To close your account or ask for a copy of your data, contact us through <a href="/support">Support</a>. See our <a href="/policies/privacy">Privacy Policy</a> for your rights.</p>',
  },
  {
    category: 'Contact',
    question: 'How do I contact you?',
    answer: '<p>Send us a request from the <a href="/support">Support</a> page and we will reply by email, usually within one business day. {{contact_sentence}}</p>',
  },
];
