// src/services/paymentsService.js

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

export async function confirmPaymentIntent(paymentIntentId, paymentMethodId) {
  // Now we assume paymentMethodId is already created by Stripe Elements on the client.
  const confirmParams = new URLSearchParams();
  confirmParams.append('payment_method', paymentMethodId);

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
