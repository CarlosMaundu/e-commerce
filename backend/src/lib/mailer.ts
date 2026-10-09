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

export const sendVerificationEmail = (to: string, name: string, link: string) =>
  send(
    to,
    'Confirm your Carlos Shop email address',
    `Hi ${name || 'there'},\n\nPlease confirm your email address to finish setting up your account (the link expires in 24 hours):\n${link}\n\nIf you didn't create an account, you can ignore this email.`
  );

export const sendAccountSetupEmail = (to: string, name: string, link: string) =>
  send(
    to,
    'Your Carlos Shop account is ready',
    `Hi ${name || 'there'},\n\nAn account was created for you at Carlos Shop. Choose your password here (the link expires in ${config.setupTokenHours} hours):\n${link}`
  );

const orderLines = (items: { name: string; quantity: number; total: number }[]) =>
  items.map((i) => `- ${i.quantity} × ${i.name}: ${i.total.toFixed(2)}`).join('\n');

export const sendOrderConfirmationEmail = (
  to: string,
  order: { number: string; total: number; currency: string; items: { name: string; quantity: number; total: number }[] },
  link: string
) =>
  send(
    to,
    `Your Carlos Shop order ${order.number}`,
    `Thank you for your order.\n\n${orderLines(order.items)}\n\nTotal: ${order.total.toFixed(2)} ${order.currency}\n\nTrack it here: ${link}`
  );

export const sendOrderStatusEmail = (to: string, orderNumber: string, statusLabel: string, comment: string, link: string) =>
  send(
    to,
    `Order ${orderNumber} is now ${statusLabel.toLowerCase()}`,
    `Your order ${orderNumber} is now ${statusLabel.toLowerCase()}.${comment ? `\n\n${comment}` : ''}\n\nDetails: ${link}`
  );

// ---------- support ----------

const excerpt = (text: string, max = 1200) => (text.length > max ? `${text.slice(0, max)}…` : text);

export const sendSupportReceivedEmail = (to: string, name: string, number: string, subject: string, link: string) =>
  send(
    to,
    `We've received your request ${number}: ${subject}`,
    `Hi ${name || 'there'},\n\nThanks for getting in touch. Your request ${number} ("${subject}") has reached our support team and we'll reply as soon as we can, usually within one business day.\n\n${link}\n\nPlease quote ${number} if you contact us about this again.`
  );

export const sendSupportReplyEmail = (to: string, name: string, number: string, subject: string, reply: string, link: string) =>
  send(
    to,
    `Re: ${subject} [${number}]`,
    `Hi ${name || 'there'},\n\n${excerpt(reply)}\n\n—\nReply or follow your request here: ${link}`
  );

export const sendSupportAlertEmail = (to: string, number: string, subject: string, from: string, message: string, link: string) =>
  send(
    to,
    `New support request ${number}: ${subject}`,
    `From: ${from}\n\n${excerpt(message)}\n\nOpen it in the back office: ${link}`
  );
