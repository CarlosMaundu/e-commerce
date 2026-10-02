// src/lib/mailer.ts — transactional email. In Docker, SMTP goes to Mailpit
// (http://localhost:8025) so no real email is sent during development.
import nodemailer from 'nodemailer';
import { config } from '../config';

const transport = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
});

const send = (to: string, subject: string, text: string) =>
  transport.sendMail({ from: config.smtp.from, to, subject, text });

export const sendPasswordResetEmail = (to: string, link: string) =>
  send(
    to,
    'Reset your Carlos Shop password',
    `We received a request to reset your password.\n\nChoose a new password here (the link expires in ${config.resetTokenMinutes} minutes):\n${link}\n\nIf you didn't ask for this, you can ignore this email.`
  );

export const sendAccountSetupEmail = (to: string, name: string, link: string) =>
  send(
    to,
    'Your Carlos Shop account is ready',
    `Hi ${name || 'there'},\n\nAn account was created for you at Carlos Shop. Choose your password here (the link expires in ${config.setupTokenHours} hours):\n${link}`
  );
