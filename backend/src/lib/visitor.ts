// src/lib/visitor.ts — an anonymous visitor id for counting searches and deal
// views once: a keyed hash (HMAC) of the IP address and browser that also
// changes every day, so stored values can't be matched back to a person or
// followed from one day to the next. VISITOR_HASH_SECRET sets the key
// (defaults to one derived from JWT_SECRET).
import crypto from 'crypto';
import { Request } from 'express';
import { config } from '../config';
import { shopDate } from './time';

const key = () => process.env.VISITOR_HASH_SECRET || `visitor:${config.jwtSecret}`;

export const visitorId = (req: Request) =>
  crypto
    .createHmac('sha256', key())
    .update(`${shopDate()}|${req.ip}|${req.get('user-agent') || ''}`)
    .digest('hex')
    .slice(0, 32);
