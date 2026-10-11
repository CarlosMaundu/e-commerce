// src/routes/adminPayments.ts — Back office → Payments (set up and test each
// way of paying) and collecting money at the door for cash-on-delivery
// orders: a card payment link with a QR code, or an M-Pesa prompt sent to the
// customer's phone. Safaricom confirms M-Pesa payments on the callback; staff
// screens also poll, so a payment is recorded whichever arrives first.
import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { query, transaction } from '../db';
import { audit } from '../lib/audit';
import { recordPayment } from '../lib/accounting';
import { fail, handler, HttpError, ok, parse } from '../lib/http';
import { MpesaGateway, normalisePhone } from '../lib/mpesa';
import {
  cardsReady,
  loadProviders,
  mpesaConfig,
  mpesaReady,
  provider,
  ProviderCode,
  PROVIDERS,
  recordTest,
  saveProvider,
  stripeKeys,
  toContractProvider,
} from '../lib/paymentProviders';
import { PaymentGateway } from '../lib/payments';
import { round2 } from '../lib/pricing';
import { authenticate, requirePermission } from '../middleware/auth';

const CODES = Object.keys(PROVIDERS) as ProviderCode[];

// The callback URL carries a signature, so only Safaricom (who got it from
// us) can confirm a request.
const sign = (id: number) => crypto.createHmac('sha256', config.jwtSecret).update(`mpesa:${id}`).digest('hex').slice(0, 24);
// Safaricom only calls public https:// addresses (not localhost or a LAN IP).
export const publicHttps = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname);
  } catch {
    return false;
  }
};
const callbackBase = () =>
  (provider('mpesa').settings.callback_url as string) || `${config.frontendUrl.replace(/\/$/, '')}/api/payments/mpesa/callback`;
const CALLBACK_HELP =
  'Safaricom needs a public https:// callback address, and this shop’s address isn’t one (e.g. it runs on localhost). ' +
  'Set Callback URL under Payment methods → M-Pesa to a public address that reaches this shop, ' +
  'e.g. https://your-tunnel.trycloudflare.com/api/payments/mpesa/callback.';
const callbackUrl = (id: number) => {
  const base = callbackBase();
  if (!publicHttps(base)) fail(400, CALLBACK_HELP);
  return `${base.replace(/\/$/, '')}/${id}/${sign(id)}`;
};

const toContractRequest = (r: any) => ({
  request_id: r.id,
  order_id: r.order_id,
  method: r.provider,
  amount: Number(r.amount),
  currency: r.currency,
  phone: r.phone,
  url: r.provider === 'card_link' ? r.url : undefined,
  status: r.status,
  reference: r.reference,
  message: r.message,
  date_added: r.created_at,
  date_modified: r.updated_at,
});

/** Records the money once, whichever confirmation arrives first. */
const markPaid = async (requestId: number, reference: string, method: 'mpesa' | 'stripe', userId: number | null) =>
  transaction(async (db) => {
    const r = (await db.query('SELECT * FROM payment_requests WHERE id = $1 FOR UPDATE', [requestId])).rows[0];
    if (!r || r.status === 'paid') return r;
    const invoice = (await db.query('SELECT * FROM invoices WHERE order_id = $1 FOR UPDATE', [r.order_id])).rows[0];
    let paymentId = null;
    const outstanding = invoice ? round2(Number(invoice.total) - Number(invoice.amount_paid)) : 0;
    if (invoice && outstanding > 0.009) {
      const payment = await recordPayment(db, {
        invoice,
        method,
        amount: Math.min(Number(r.amount), outstanding),
        reference,
        note: method === 'mpesa' ? 'M-Pesa prompt at delivery' : 'Card tap at delivery',
        by: userId ?? r.created_by,
      });
      paymentId = payment.id;
      await db.query(`UPDATE orders SET payment_status = 'paid', updated_at = now() WHERE id = $1 AND payment_status <> 'paid'`, [
        r.order_id,
      ]);
    }
    return (
      await db.query(
        `UPDATE payment_requests SET status = 'paid', reference = $2, payment_id = $3, message = 'Paid.', updated_at = now()
         WHERE id = $1 RETURNING *`,
        [r.id, reference, paymentId]
      )
    ).rows[0];
  });

export const adminPaymentRoutes = ({ payments, mpesa }: { payments: PaymentGateway | null; mpesa: MpesaGateway }) => {
  const router = Router();

  // ---------- Back office → Payments ----------
  router.use('/payment-providers', authenticate, requirePermission('admin.payments.manage'));

  router.get('/payment-providers', handler(async (_req, res) => {
    await loadProviders();
    ok(res, CODES.map((c) => toContractProvider(provider(c))));
  }));

  router.put('/payment-providers/:code', handler(async (req, res) => {
    const code = req.params.code as ProviderCode;
    if (!CODES.includes(code)) fail(404, 'Unknown payment method.');
    const def = PROVIDERS[code];
    const b = parse(
      z.object({
        enabled: z.coerce.boolean(),
        mode: z.enum(['test', 'live']).default('test'),
        settings: z.record(z.any()).default({}),
        secrets: z.record(z.string().trim().max(500)).default({}),
      }),
      req.body
    );
    // Only the fields this provider has; text trimmed, switches true/false.
    const settings: Record<string, any> = {};
    const secrets: Record<string, string> = {};
    for (const f of def.fields) {
      if (f.type === 'secret') secrets[f.key] = String(b.secrets[f.key] || '');
      else if (f.type === 'switch') settings[f.key] = Boolean(b.settings[f.key]);
      else settings[f.key] = String(b.settings[f.key] ?? '').trim().slice(0, 500);
    }
    if (b.enabled) {
      const current = provider(code);
      const missing = def.fields.filter((f) => {
        if (!f.required || (f.when && settings[f.when.key] !== f.when.value)) return false;
        const fromEnv = code === 'stripe' && Boolean(config.stripe.secretKey);
        if (f.type === 'secret') return !secrets[f.key] && !current.secrets[f.key] && !fromEnv;
        return !settings[f.key] && !(fromEnv && f.key === 'publishable_key' && config.stripe.publishableKey);
      });
      if (missing.length) {
        throw new HttpError(
          400,
          ['Please fill in the required details to switch this on.'],
          Object.fromEntries(missing.map((f) => [f.key, `Please enter the ${f.label.toLowerCase()}.`]))
        );
      }
      if (code === 'mpesa' && settings.callback_url && !publicHttps(settings.callback_url)) {
        throw new HttpError(400, ['The callback URL must be a public https:// address.'], {
          callback_url: 'Use a public https:// address that reaches this shop (not localhost).',
        });
      }
      if (code === 'stripe' && settings.publishable_key && !/^pk_(test|live)_/.test(settings.publishable_key)) {
        fail(400, 'The publishable key should start with pk_test_ or pk_live_.');
      }
      if (code === 'stripe' && secrets.secret_key && !/^(sk|rk)_(test|live)_/.test(secrets.secret_key)) {
        fail(400, 'The secret key should start with sk_test_ or sk_live_.');
      }
    }
    const saved = await saveProvider(code, { ...b, settings, secrets }, req.auth!.userId);
    audit(req, 'payments.provider_saved', `payment_provider:${code}`, { enabled: b.enabled, mode: b.mode });
    ok(res, toContractProvider(saved));
  }));

  // Tests the saved set-up: Stripe → the account; M-Pesa → an access token,
  // and optionally a 1-shilling prompt to a phone.
  router.post('/payment-providers/:code/test', handler(async (req, res) => {
    const code = req.params.code as ProviderCode;
    if (!CODES.includes(code) || code === 'cod') fail(400, 'There’s nothing to test for this payment method.');
    const { phone } = parse(z.object({ phone: z.string().trim().max(20).optional() }), req.body);
    let result: { ok: boolean; message: string };
    try {
      if (code === 'stripe') {
        const key = provider('stripe').secrets.secret_key || stripeKeys().secretKey || config.stripe.secretKey;
        if (!key) fail(400, 'Add the secret key first.');
        const name = await payments!.checkKey(key);
        result = { ok: true, message: `Connected to ${name} (${key.startsWith('sk_live') ? 'live' : 'test'} mode).` };
      } else {
        const cfg = mpesaConfig({ ...provider('mpesa'), enabled: true });
        if (!cfg) fail(400, 'Fill in the shortcode, consumer key, consumer secret and passkey first.');
        await mpesa.checkCredentials(cfg!);
        let message = `Safaricom accepted the credentials (${cfg!.sandbox ? 'sandbox' : 'live'}).`;
        if (phone) {
          const to = normalisePhone(phone);
          if (!to) fail(400, 'Please enter a Kenyan mobile number, e.g. 0712 345 678.');
          await mpesa.stkPush(cfg!, {
            phone: to!, amount: 1, reference: 'TEST', description: 'Test payment', callbackUrl: `${callbackUrl(0)}`,
          });
          message += ` A test prompt for KES 1 was sent to ${phone}.`;
        }
        result = { ok: true, message };
      }
    } catch (error: any) {
      result = { ok: false, message: error?.messages?.[0] || error?.message || 'The test failed.' };
    }
    await recordTest(code, result.ok, result.message);
    audit(req, 'payments.provider_tested', `payment_provider:${code}`, { ok: result.ok });
    ok(res, { ...result, provider: toContractProvider(provider(code)) });
  }));

  // ---------- collecting at the door ----------
  router.use(['/orders/:id/collect', '/orders/:id/payment-requests', '/payment-requests'], authenticate);

  /** Ways staff can take payment for this order right now. */
  router.get('/orders/:id/payment-requests', requirePermission('orders.payments.record'), handler(async (req, res) => {
    const rows = (await query('SELECT * FROM payment_requests WHERE order_id = $1 ORDER BY created_at DESC LIMIT 10', [
      Number(req.params.id),
    ])).rows;
    const cod = provider('cod').settings;
    ok(res, {
      requests: rows.map(toContractRequest),
      card_link: Boolean(cod.tap_to_pay) && cardsReady(),
      mpesa: Boolean(cod.mpesa_prompt) && mpesaReady(),
    });
  }));

  router.post('/orders/:id/collect', requirePermission('orders.payments.record'), handler(async (req, res) => {
    const b = parse(
      z.object({
        method: z.enum(['card_link', 'mpesa'], { errorMap: () => ({ message: 'Choose card or M-Pesa.' }) }),
        phone: z.string().trim().max(20).optional(),
      }),
      req.body
    );
    const order = (await query('SELECT * FROM orders WHERE id = $1', [Number(req.params.id)])).rows[0];
    if (!order) fail(404, 'Order not found.');
    const invoice = (await query('SELECT * FROM invoices WHERE order_id = $1', [order.id])).rows[0];
    const amount = invoice ? round2(Number(invoice.total) - Number(invoice.amount_paid)) : 0;
    if (!invoice || amount <= 0.009) fail(400, 'Nothing is owed on this order.');
    const cod = provider('cod').settings;
    let row: any;
    if (b.method === 'card_link') {
      if (!cod.tap_to_pay || !cardsReady() || !payments) fail(400, 'Card payments at the door aren’t set up. See Payments.');
      const link = await payments!.createPaymentLink({
        amountCents: Math.round(amount * 100),
        currency: order.currency,
        orderId: order.id,
        description: `Order ${order.number}`,
        email: order.email,
      });
      row = (await query(
        `INSERT INTO payment_requests (order_id, invoice_id, provider, amount, currency, external_id, url, created_by, message)
         VALUES ($1, $2, 'card_link', $3, $4, $5, $6, $7, 'Waiting for the customer to pay.') RETURNING *`,
        [order.id, invoice.id, amount, order.currency, link.id, link.url, req.auth!.userId]
      )).rows[0];
    } else {
      const cfg = cod.mpesa_prompt ? mpesaConfig() : null;
      if (!cfg) fail(400, 'M-Pesa prompts aren’t set up. See Payments.');
      if (order.currency !== 'KES') fail(400, 'M-Pesa takes payments in Kenyan shillings only.');
      if (!publicHttps(callbackBase())) fail(400, CALLBACK_HELP);
      const phone = normalisePhone(b.phone || '');
      if (!phone) fail(400, 'Please enter the customer’s M-Pesa number, e.g. 0712 345 678.');
      row = (await query(
        `INSERT INTO payment_requests (order_id, invoice_id, provider, amount, currency, phone, created_by, message)
         VALUES ($1, $2, 'mpesa', $3, $4, $5, $6, 'Sending the prompt…') RETURNING *`,
        [order.id, invoice.id, Math.ceil(amount), order.currency, phone, req.auth!.userId]
      )).rows[0];
      try {
        const sent = await mpesa.stkPush(cfg!, {
          phone: phone!,
          amount: Math.ceil(amount),
          reference: order.number,
          description: `Order ${order.number}`,
          callbackUrl: callbackUrl(row.id),
        });
        row = (await query(
          `UPDATE payment_requests SET external_id = $2, message = $3, updated_at = now() WHERE id = $1 RETURNING *`,
          [row.id, sent.checkoutRequestId, 'Prompt sent. Waiting for the customer to enter their PIN.']
        )).rows[0];
      } catch (error: any) {
        await query(`UPDATE payment_requests SET status = 'failed', message = $2, updated_at = now() WHERE id = $1`, [
          row.id, error?.messages?.[0] || 'The prompt wasn’t sent.',
        ]);
        throw error;
      }
    }
    audit(req, 'payment.collect_started', `order:${order.id}`, { method: b.method, amount });
    ok(res, toContractRequest(row), 201);
  }));

  /** The request's latest state; checks with Stripe or Safaricom while pending. */
  router.get('/payment-requests/:id', requirePermission('orders.payments.record'), handler(async (req, res) => {
    let r = (await query('SELECT * FROM payment_requests WHERE id = $1', [Number(req.params.id)])).rows[0];
    if (!r) fail(404, 'Payment request not found.');
    if (r.status === 'pending' && r.external_id) {
      try {
        if (r.provider === 'card_link' && payments) {
          const link = await payments.getPaymentLink(r.external_id);
          if (link.status === 'paid') r = await markPaid(r.id, link.paymentId || r.external_id, 'stripe', req.auth!.userId);
          else if (link.status === 'expired') {
            r = (await query(`UPDATE payment_requests SET status = 'expired', message = 'The link expired.', updated_at = now()
              WHERE id = $1 RETURNING *`, [r.id])).rows[0];
          }
        } else if (r.provider === 'mpesa') {
          const cfg = mpesaConfig();
          if (cfg) {
            const q = await mpesa.query(cfg, r.external_id);
            // The receipt number arrives on the callback; until then the request id stands in.
            if (q.status === 'paid') r = await markPaid(r.id, r.reference || r.external_id, 'mpesa', req.auth!.userId);
            else if (q.status === 'failed') {
              r = (await query(`UPDATE payment_requests SET status = 'failed', message = $2, updated_at = now()
                WHERE id = $1 RETURNING *`, [r.id, q.message])).rows[0];
            }
          }
        }
      } catch {
        // Keep it pending; the next check (or the callback) settles it.
      }
    }
    ok(res, toContractRequest(r));
  }));

  router.delete('/payment-requests/:id', requirePermission('orders.payments.record'), handler(async (req, res) => {
    const r = (await query(
      `UPDATE payment_requests SET status = 'cancelled', message = 'Cancelled by staff.', updated_at = now()
       WHERE id = $1 AND status = 'pending' RETURNING *`,
      [Number(req.params.id)]
    )).rows[0];
    if (!r) fail(400, 'Only a request that’s still waiting can be cancelled.');
    ok(res, toContractRequest(r));
  }));

  return router;
};

/** Safaricom's confirmation of an M-Pesa prompt (no sign-in; signed URL). */
export const mpesaCallbackRoutes = ({ mpesa }: { mpesa: MpesaGateway }) => {
  const router = Router();
  router.post('/payments/mpesa/callback/:id/:sig', handler(async (req, res) => {
    const id = Number(req.params.id);
    // Always answer Safaricom with "accepted" so it doesn't retry forever.
    const accepted = () => res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    if (!id || req.params.sig !== sign(id)) return accepted();
    const cb = req.body?.Body?.stkCallback;
    const r = (await query('SELECT * FROM payment_requests WHERE id = $1', [id])).rows[0];
    if (!cb || !r || cb.CheckoutRequestID !== r.external_id) return accepted();
    const items: { Name: string; Value?: unknown }[] = cb.CallbackMetadata?.Item || [];
    const receipt = String(items.find((i) => i.Name === 'MpesaReceiptNumber')?.Value || '');
    if (r.status === 'paid') {
      // Already recorded from a status check: swap in the M-Pesa receipt number.
      if (receipt && r.reference === r.external_id) {
        await query('UPDATE payment_requests SET reference = $2, updated_at = now() WHERE id = $1', [id, receipt]);
        if (r.payment_id) await query('UPDATE payments SET reference = $2 WHERE id = $1', [r.payment_id, receipt]);
      }
      return accepted();
    }
    if (r.status !== 'pending') return accepted();
    if (String(cb.ResultCode) !== '0') {
      await query(`UPDATE payment_requests SET status = 'failed', message = $2, updated_at = now() WHERE id = $1`, [
        id, cb.ResultDesc || 'The payment didn’t go through.',
      ]);
      return accepted();
    }
    // Confirm with Safaricom before recording money.
    const cfg = mpesaConfig();
    const confirmed = cfg ? (await mpesa.query(cfg, r.external_id).catch(() => ({ status: 'pending' }))).status : 'paid';
    if (confirmed !== 'paid') return accepted();
    await markPaid(id, receipt || r.external_id, 'mpesa', null);
    return accepted();
  }));
  return router;
};
