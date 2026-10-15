// src/lib/jobs.ts — background work the API does on its own: settling card
// and M-Pesa payments nobody is watching, and placing card orders Stripe
// says are paid. Each job takes a database lock, so with several API
// servers only one runs it at a time.
import { pool, query } from '../db';
import { MpesaGateway } from './mpesa';
import { PaymentGateway } from './payments';
import { placeOrder } from './placeOrder';
import { settleWaitingRequests } from '../routes/adminPayments';

/** Runs `fn` unless another server holds the job's lock. */
export const runJob = async (name: string, fn: () => Promise<unknown>) => {
  const client = await pool.connect();
  try {
    const { locked } = (await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [name])).rows[0];
    if (!locked) return null;
    try {
      return await fn();
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [name]);
    }
  } catch (error) {
    console.error(`Job ${name} failed:`, error);
    return null;
  } finally {
    client.release();
  }
};

/**
 * Card orders still waiting at checkout whose payment Stripe shows as done
 * (the customer closed the page, or the webhook didn't arrive): place them.
 */
export const placePaidCardOrders = async (payments: PaymentGateway | null) => {
  if (!payments) return 0;
  const waiting = (await query(
    `SELECT id, user_id, payment_reference FROM orders
     WHERE placed_at IS NULL AND payment_method = 'stripe' AND payment_reference IS NOT NULL
       AND created_at BETWEEN now() - interval '3 days' AND now() - interval '2 minutes'
     ORDER BY id LIMIT 50`
  )).rows;
  let placed = 0;
  for (const o of waiting) {
    try {
      if ((await payments.getStatus(o.payment_reference)) !== 'succeeded') continue;
      const r = await placeOrder(o.id, { paid: true, userId: o.user_id, allowShortStock: true });
      if (r.placed) placed += 1;
    } catch (error) {
      console.error(`Couldn’t check card order ${o.id}:`, error);
    }
  }
  return placed;
};

/** Every minute: place paid card orders and settle waiting payment requests. */
export const startJobs = (gateways: { payments: PaymentGateway | null; mpesa: MpesaGateway }) => {
  const tick = async () => {
    const placed = await runJob('payments:card-orders', () => placePaidCardOrders(gateways.payments));
    if (placed) console.log(`Placed ${placed} paid card orders the customer didn’t come back for`);
    const settled = await runJob('payments:requests', () => settleWaitingRequests(gateways));
    if (settled) console.log(`Settled ${settled} payment requests`);
  };
  const timer = setInterval(tick, 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
};
