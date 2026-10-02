// src/lib/security.ts — passwords, tokens and hashing helpers.
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config';

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string | null) =>
  hash ? bcrypt.compare(password, hash) : Promise.resolve(false);

/** Same rules the sign-up page shows. */
export const passwordSchema = z
  .string({ required_error: 'Please enter a password.' })
  .min(8, 'Use at least 8 characters for your password.')
  .max(128, 'Use at most 128 characters for your password.')
  .regex(/[a-z]/, 'Your password needs a lowercase letter.')
  .regex(/[A-Z]/, 'Your password needs an uppercase letter.')
  .regex(/[0-9!@#$%^&*]/, 'Your password needs a number or symbol.');

export const randomToken = () => crypto.randomBytes(32).toString('base64url');
export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export interface AccessClaims {
  sub: string; // user id
  sid: string; // session id
}

export const signAccessToken = (claims: AccessClaims) =>
  jwt.sign(claims, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${config.accessTokenMinutes}m`,
  });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as AccessClaims;
