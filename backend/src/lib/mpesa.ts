// src/lib/mpesa.ts — M-Pesa through Safaricom's Daraja API: an access token
// from the consumer key and secret, the STK push ("enter your M-Pesa PIN"
// prompt on the customer's phone) and the status query used to confirm a
// payment. Sandbox and production differ only in the host. Tests inject a fake.
import { fail } from './http';
import { compactTimestamp } from './time';
import { MpesaConfig } from './paymentProviders';

export interface MpesaGateway {
  /** Checks the credentials by asking for an access token. */
  checkCredentials(cfg: MpesaConfig): Promise<void>;
  stkPush(
    cfg: MpesaConfig,
    input: { phone: string; amount: number; reference: string; description: string; callbackUrl: string }
  ): Promise<{ checkoutRequestId: string; customerMessage: string }>;
  /** paid, failed (cancelled, wrong PIN, timeout…) or still pending. */
  query(cfg: MpesaConfig, checkoutRequestId: string): Promise<{ status: 'paid' | 'failed' | 'pending'; message: string }>;
}

/** 07XX…, +2547XX…, 2541XX… → 2547XXXXXXXX; null when it isn't a Kenyan mobile. */
export const normalisePhone = (input: string) => {
  const digits = input.replace(/[^\d]/g, '');
  const local = digits.startsWith('254') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  return /^(7|1)\d{8}$/.test(local) ? `254${local}` : null;
};

const host = (cfg: MpesaConfig) => (cfg.sandbox ? 'https://sandbox.safaricom.co.ke' : 'https://api.safaricom.co.ke');

const timestamp = () => {
  // Daraja wants Nairobi time, YYYYMMDDHHmmss.
  // Safaricom's clock: Nairobi time, whatever the shop's time zone.
  return compactTimestamp('Africa/Nairobi');
};

const tokens = new Map<string, { token: string; until: number }>();

const accessToken = async (cfg: MpesaConfig) => {
  const cacheKey = `${host(cfg)}|${cfg.consumerKey}`;
  const cached = tokens.get(cacheKey);
  if (cached && cached.until > Date.now()) return cached.token;
  const res = await fetch(`${host(cfg)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString('base64')}` },
  }).catch(() => fail(502, 'We couldn’t reach Safaricom. Please try again.'));
  const body: any = await res!.json().catch(() => ({}));
  if (!res!.ok || !body.access_token) {
    fail(400, 'Safaricom didn’t accept the consumer key and secret. Check them and the mode (sandbox or live).');
  }
  tokens.set(cacheKey, { token: body.access_token, until: Date.now() + (Number(body.expires_in || 3599) - 60) * 1000 });
  return body.access_token as string;
};

const post = async (cfg: MpesaConfig, path: string, payload: object) => {
  const res = await fetch(`${host(cfg)}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken(cfg)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => fail(502, 'We couldn’t reach Safaricom. Please try again.'));
  return { ok: res!.ok, body: (await res!.json().catch(() => ({}))) as any };
};

export const darajaGateway = (): MpesaGateway => ({
  async checkCredentials(cfg) {
    await accessToken(cfg);
  },
  async stkPush(cfg, { phone, amount, reference, description, callbackUrl }) {
    const ts = timestamp();
    const { ok, body } = await post(cfg, '/mpesa/stkpush/v1/processrequest', {
      BusinessShortCode: cfg.shortcode,
      Password: Buffer.from(`${cfg.shortcode}${cfg.passkey}${ts}`).toString('base64'),
      Timestamp: ts,
      TransactionType: cfg.accountType === 'till' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
      Amount: Math.ceil(amount), // whole shillings only
      PartyA: phone,
      PartyB: cfg.accountType === 'till' && cfg.tillNumber ? cfg.tillNumber : cfg.shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: reference.slice(0, 12),
      TransactionDesc: description.slice(0, 13),
    });
    if (!ok || body.ResponseCode !== '0') {
      fail(400, `Safaricom didn’t send the prompt: ${body.errorMessage || body.ResponseDescription || 'unknown error'}.`);
    }
    return { checkoutRequestId: body.CheckoutRequestID, customerMessage: body.CustomerMessage || '' };
  },
  async query(cfg, checkoutRequestId) {
    const ts = timestamp();
    const { body } = await post(cfg, '/mpesa/stkpushquery/v1/query', {
      BusinessShortCode: cfg.shortcode,
      Password: Buffer.from(`${cfg.shortcode}${cfg.passkey}${ts}`).toString('base64'),
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    });
    // Still being processed: Daraja answers with an error code, not a result.
    if (body.ResultCode === undefined) return { status: 'pending', message: body.errorMessage || 'Waiting for the customer.' };
    return String(body.ResultCode) === '0'
      ? { status: 'paid', message: body.ResultDesc || 'Paid.' }
      : { status: 'failed', message: body.ResultDesc || 'The payment didn’t go through.' };
  },
});
