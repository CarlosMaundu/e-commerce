// src/lib/secrets.ts — encrypts payment credentials before they're stored
// (AES-256-GCM). The key comes from PAYMENTS_SECRET_KEY, else JWT_SECRET; if
// that key changes, saved credentials must be entered again.
import crypto from 'crypto';
import { config } from '../config';

const key = () =>
  crypto.createHash('sha256').update(process.env.PAYMENTS_SECRET_KEY || config.jwtSecret).digest();

export const encrypt = (value: Record<string, string>) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
};

/** The stored secrets, or {} when there are none or they can't be read. */
export const decrypt = (stored: string): Record<string, string> => {
  if (!stored) return {};
  try {
    const [iv, tag, data] = stored.split('.').map((p) => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));
  } catch {
    return {};
  }
};

/** "••••1234" so staff can tell which key is saved without seeing it. */
export const mask = (value: string) => (value ? `••••${value.slice(-4)}` : '');
