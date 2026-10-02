// src/lib/google.ts — verifies "Sign in with Google" ID tokens.
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  givenName: string;
  familyName: string;
  picture: string;
}

export type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity>;

export const verifyGoogleIdToken: GoogleVerifier = async (idToken) => {
  const client = new OAuth2Client(config.googleClientId);
  const ticket = await client.verifyIdToken({ idToken, audience: config.googleClientId });
  const p = ticket.getPayload();
  if (!p?.sub || !p.email) throw new Error('Google token has no email');
  return {
    sub: p.sub,
    email: p.email,
    emailVerified: Boolean(p.email_verified),
    givenName: p.given_name || '',
    familyName: p.family_name || '',
    picture: p.picture || '',
  };
};
