// src/lib/jobs.ts — background work the API does on its own: settling card
// and M-Pesa payments nobody is watching, and placing card orders Stripe
// says are paid. Each job takes a database lock, so with several API
// servers only one runs it at a time.
import { pool, query } from '../db';
import { MpesaGateway } from './mpesa';
import { PaymentGateway } from './payments';
import { placeOrder } from './placeOrder';
import { settleWaitingRequests } from '../routes/adminPayments';
import { deliverDueEmails } from './mailer';

// How long raw analytics and the audit log are kept (orders, invoices, the
// ledger and stock movements are business records and stay).
export const RETENTION = {
  searches: 400, // days
  deal_events: 400,
  product_views: 3 * 365,
  audit_log: 2 * 365,
  sent_emails: 90,
};

/** Deletes analytics events and log rows older than RETENTION. */
export const removeOldData = async () => {
  const del = async (sql: string, days: number) => (await query(sql, [days])).rowCount || 0;
  return (
    (await del(`DELETE FROM search_queries WHERE created_at < now() - make_interval(days => $1)`, RETENTION.searches)) +
    (await del(`DELETE FROM promotion_events WHERE created_at < now() - make_interval(days => $1)`, RETENTION.deal_events)) +
    (await del(`DELETE FROM product_views WHERE day < current_date - $1::int`, RETENTION.product_views)) +
    (await del(`DELETE FROM audit_logs WHERE created_at < now() - make_interval(days => $1)`, RETENTION.audit_log)) +
    (await del(`DELETE FROM email_outbox WHERE sent_at < now() - make_interval(days => $1)`, RETENTION.sent_emails)) +
    (await del(`DELETE FROM rate_limits WHERE reset_at < now() - make_interval(days => $1)`, 1))
  );
};

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

/** Every minute: payments, emails due a retry, and (every 6 hours) old data. */
export const startJobs = (gateways: { payments: PaymentGateway | null; mpesa: MpesaGateway }) => {
  const tick = async () => {
    const placed = await runJob('payments:card-orders', () => placePaidCardOrders(gateways.payments));
    if (placed) console.log(`Placed ${placed} paid card orders the customer didn’t come back for`);
    const settled = await runJob('payments:requests', () => settleWaitingRequests(gateways));
    if (settled) console.log(`Settled ${settled} payment requests`);
    await runJob('email:outbox', deliverDueEmails);
    // Old analytics events, a few times a day.
    if (Date.now() - lastCleanup > 6 * 3600 * 1000) {
      lastCleanup = Date.now();
      const removed = await runJob('data:retention', removeOldData);
      if (removed) console.log(`Removed ${removed} old analytics and audit rows`);
    }
  };
  let lastCleanup = 0;
  const timer = setInterval(tick, 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
};
