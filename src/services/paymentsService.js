// src/services/paymentsService.js

// IMPORTANT: In a real production scenario, secret keys must be stored on the server side.
// This example is purely for demonstration in a test environment and should NOT be used in production.

const STRIPE_SECRET_KEY = process.env.REACT_APP_STRIPE_SECRET_KEY;
const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export async function createPaymentIntent(amount, currency = 'usd') {
  const params = new URLSearchParams();
  params.append('amount', amount.toString());
  params.append('currency', currency);
  params.append('payment_method_types[]', 'card');

  const response = await fetch(`${STRIPE_API_BASE}/payment_intents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  return data;
}

export async function confirmPaymentIntent(paymentIntentId, cardDetails) {
  // Create a test payment method using a test card number
  const { cardNumber, expMonth, expYear, cvv } = cardDetails;

  const pmParams = new URLSearchParams();
  pmParams.append('type', 'card');
  pmParams.append('card[number]', cardNumber);
  pmParams.append('card[exp_month]', expMonth);
  pmParams.append('card[exp_year]', expYear);
  pmParams.append('card[cvc]', cvv);

  // Create a PaymentMethod
  const pmResponse = await fetch(`${STRIPE_API_BASE}/payment_methods`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: pmParams,
  });
  const pmData = await pmResponse.json();
  if (pmData.error) {
    throw new Error(pmData.error.message);
  }

  // Confirm the PaymentIntent
  const confirmParams = new URLSearchParams();
  confirmParams.append('payment_method', pmData.id);

  const confirmResponse = await fetch(
    `${STRIPE_API_BASE}/payment_intents/${paymentIntentId}/confirm`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: confirmParams,
    }
  );

  const confirmData = await confirmResponse.json();
  if (confirmData.error) {
    throw new Error(confirmData.error.message);
  }

  return confirmData;
}
