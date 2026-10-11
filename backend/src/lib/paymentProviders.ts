// src/lib/paymentProviders.ts — the ways customers can pay, as set up in
// Back office → Payments: card (Stripe), M-Pesa (Safaricom Daraja) and cash on
// delivery (which can also take a card tap or an M-Pesa prompt at the door).
// Settings are cached in memory and reloaded when saved; secrets are stored
// encrypted and never sent back in full. Stripe falls back to the
// STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY environment variables.
import { config } from '../config';
import { query } from '../db';
import { decrypt, encrypt, mask } from './secrets';

export type ProviderCode = 'stripe' | 'mpesa' | 'cod';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'secret' | 'select' | 'switch';
  required?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
  // Only asked for when another field has this value.
  when?: { key: string; value: string };
}

export const PROVIDERS: Record<ProviderCode, { name: string; description: string; fields: FieldDef[] }> = {
  stripe: {
    name: 'Card payments (Stripe)',
    description: 'Visa, Mastercard, Apple Pay and Google Pay at checkout, refunds to the card, and tap-to-pay links at the door.',
    fields: [
      { key: 'publishable_key', label: 'Publishable key', type: 'text', required: true, help: 'Starts with pk_test_ or pk_live_.' },
      { key: 'secret_key', label: 'Secret key', type: 'secret', required: true, help: 'Starts with sk_test_ or sk_live_. Stored encrypted.' },
    ],
  },
  mpesa: {
    name: 'M-Pesa (Safaricom Daraja)',
    description: 'Send an M-Pesa prompt (STK push) to the customer’s phone; they enter their PIN and the payment is recorded.',
    fields: [
      {
        key: 'account_type', label: 'Account type', type: 'select', required: true,
        options: [{ value: 'paybill', label: 'Paybill' }, { value: 'till', label: 'Till number (Buy Goods)' }],
      },
      { key: 'shortcode', label: 'Business shortcode', type: 'text', required: true, help: 'Your Paybill number, or the store number for a till. Sandbox: 174379.' },
      { key: 'till_number', label: 'Till number', type: 'text', when: { key: 'account_type', value: 'till' }, help: 'Where the money goes for Buy Goods.' },
      { key: 'consumer_key', label: 'Consumer key', type: 'secret', required: true, help: 'From your app on developer.safaricom.co.ke.' },
      { key: 'consumer_secret', label: 'Consumer secret', type: 'secret', required: true },
      { key: 'passkey', label: 'Passkey (Lipa na M-Pesa Online)', type: 'secret', required: true },
      { key: 'callback_url', label: 'Callback URL', type: 'text', help: 'Where Safaricom confirms payments. Leave empty to use this shop’s address.' },
    ],
  },
  cod: {
    name: 'Cash on delivery',
    description: 'Customers pay when the order arrives: cash, a card tap (payment link) or an M-Pesa prompt.',
    fields: [
      { key: 'tap_to_pay', label: 'Card tap at the door (needs card payments)', type: 'switch' },
      { key: 'mpesa_prompt', label: 'M-Pesa prompt at the door (needs M-Pesa)', type: 'switch' },
      { key: 'instructions', label: 'Note shown at checkout', type: 'text', help: 'e.g. Have the exact amount ready, or pay by card or M-Pesa.' },
    ],
  },
};

export interface ProviderState {
  code: ProviderCode;
  enabled: boolean;
  mode: 'test' | 'live';
  settings: Record<string, any>;
  secrets: Record<string, string>;
  last_test_at: Date | null;
  last_test_ok: boolean | null;
  last_test_message: string;
  updated_at: Date | null;
}

const defaults = (code: ProviderCode): ProviderState => ({
  code,
  // Pay on delivery is on out of the box; the others once configured.
  enabled: code === 'cod',
  mode: 'test',
  settings: code === 'cod' ? { tap_to_pay: true, mpesa_prompt: true, instructions: '' } : code === 'mpesa' ? { account_type: 'paybill' } : {},
  secrets: {},
  last_test_at: null,
  last_test_ok: null,
  last_test_message: '',
  updated_at: null,
});

let cache: Record<ProviderCode, ProviderState> | null = null;

export const loadProviders = async () => {
  const rows = (await query('SELECT * FROM payment_providers')).rows;
  const next = {} as Record<ProviderCode, ProviderState>;
  for (const code of Object.keys(PROVIDERS) as ProviderCode[]) {
    const r = rows.find((x) => x.code === code);
    next[code] = r
      ? {
          code,
          enabled: r.enabled,
          mode: r.mode,
          settings: { ...defaults(code).settings, ...r.settings },
          secrets: decrypt(r.secrets),
          last_test_at: r.last_test_at,
          last_test_ok: r.last_test_ok,
          last_test_message: r.last_test_message,
          updated_at: r.updated_at,
        }
      : defaults(code);
  }
  cache = next;
  return next;
};

export const provider = (code: ProviderCode): ProviderState => (cache || ({} as any))[code] || defaults(code);

const envStripe = () => Boolean(config.stripe.secretKey && config.stripe.publishableKey);

/**
 * Stripe keys in use. Until Stripe is saved in the back office the
 * environment keys apply; after that its switch decides, using the saved keys
 * (or the environment's where none were saved).
 */
export const stripeKeys = () => {
  const p = provider('stripe');
  if (!p.updated_at) return { secretKey: config.stripe.secretKey, publishableKey: config.stripe.publishableKey };
  if (!p.enabled) return { secretKey: '', publishableKey: '' };
  return {
    secretKey: p.secrets.secret_key || config.stripe.secretKey,
    publishableKey: (p.settings.publishable_key as string) || config.stripe.publishableKey,
  };
};
export const cardsReady = () => Boolean(stripeKeys().secretKey && stripeKeys().publishableKey);

export interface MpesaConfig {
  sandbox: boolean;
  accountType: 'paybill' | 'till';
  shortcode: string;
  tillNumber: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  callbackUrl: string;
}

/** The M-Pesa set-up, or null when it isn't switched on and complete. */
export const mpesaConfig = (draft?: ProviderState): MpesaConfig | null => {
  const p = draft || provider('mpesa');
  const s = p.secrets;
  if (!draft && !p.enabled) return null;
  if (!p.settings.shortcode || !s.consumer_key || !s.consumer_secret || !s.passkey) return null;
  return {
    sandbox: p.mode !== 'live',
    accountType: p.settings.account_type === 'till' ? 'till' : 'paybill',
    shortcode: String(p.settings.shortcode),
    tillNumber: String(p.settings.till_number || ''),
    consumerKey: s.consumer_key,
    consumerSecret: s.consumer_secret,
    passkey: s.passkey,
    callbackUrl: String(p.settings.callback_url || ''),
  };
};
export const mpesaReady = () => Boolean(mpesaConfig());

/** What staff see: settings, which secrets are saved (masked), status. */
export const toContractProvider = (p: ProviderState) => {
  const def = PROVIDERS[p.code];
  // Stripe keys from the environment, not (yet) replaced in the back office.
  const usingEnv = p.code === 'stripe' && !p.secrets.secret_key && envStripe();
  const keys = p.code === 'stripe' ? stripeKeys() : null;
  return {
    code: p.code,
    name: def.name,
    description: def.description,
    fields: def.fields,
    enabled: p.code === 'stripe' && !p.updated_at ? envStripe() : p.enabled,
    mode: usingEnv ? (config.stripe.secretKey.startsWith('sk_live') ? 'live' : 'test') : p.mode,
    settings: usingEnv ? { ...p.settings, publishable_key: p.settings.publishable_key || config.stripe.publishableKey } : p.settings,
    // Which secrets are saved, masked: { secret_key: '••••1a2b' }.
    secrets: Object.fromEntries(
      def.fields
        .filter((f) => f.type === 'secret')
        .map((f) => [f.key, mask(usingEnv && f.key === 'secret_key' ? config.stripe.secretKey : p.secrets[f.key] || '')])
    ),
    configured:
      p.code === 'cod'
        ? true
        : p.code === 'stripe'
          ? Boolean(p.secrets.secret_key || config.stripe.secretKey)
          : Boolean(mpesaConfig({ ...p, enabled: true })),
    ready: p.code === 'cod' ? p.enabled : p.code === 'stripe' ? Boolean(keys!.secretKey && keys!.publishableKey) : mpesaReady(),
    from_environment: usingEnv,
    last_test: p.last_test_at ? { at: p.last_test_at, ok: p.last_test_ok, message: p.last_test_message } : null,
    date_modified: p.updated_at,
  };
};

/** Saves a provider; secrets left empty keep their saved value. */
export const saveProvider = async (
  code: ProviderCode,
  input: { enabled: boolean; mode: 'test' | 'live'; settings: Record<string, any>; secrets: Record<string, string> },
  userId: number
) => {
  const current = provider(code);
  const secrets = { ...current.secrets };
  for (const [k, v] of Object.entries(input.secrets)) if (v) secrets[k] = v;
  await query(
    `INSERT INTO payment_providers (code, enabled, mode, settings, secrets, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (code) DO UPDATE SET enabled = EXCLUDED.enabled, mode = EXCLUDED.mode, settings = EXCLUDED.settings,
       secrets = EXCLUDED.secrets, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [code, input.enabled, input.mode, JSON.stringify(input.settings), encrypt(secrets), userId]
  );
  await loadProviders();
  return provider(code);
};

export const recordTest = async (code: ProviderCode, ok: boolean, message: string) => {
  // A first test doesn't change whether the provider is on.
  const p = provider(code);
  const enabled = p.updated_at ? p.enabled : code === 'stripe' ? envStripe() : p.enabled;
  await query(
    `INSERT INTO payment_providers (code, enabled, mode, settings, secrets, last_test_at, last_test_ok, last_test_message)
     VALUES ($1, $2, $3, $4, $5, now(), $6, $7)
     ON CONFLICT (code) DO UPDATE SET last_test_at = now(), last_test_ok = $6, last_test_message = $7`,
    [code, enabled, p.mode, JSON.stringify(p.settings), encrypt(p.secrets), ok, message]
  );
  await loadProviders();
};
