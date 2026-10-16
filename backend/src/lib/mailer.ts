// src/lib/mailer.ts — transactional email. In Docker, SMTP goes to Mailpit
// (http://localhost:8025) so no real email is sent during development.
import nodemailer from 'nodemailer';
import { config } from '../config';
import { query } from '../db';

const transport = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
});

/** Tries one saved email; on failure it waits longer before each retry. */
const deliver = async (id: number) => {
  const row = (await query(
    `UPDATE email_outbox SET attempts = attempts + 1, next_attempt_at = now() + interval '10 minutes'
     WHERE id = $1 AND sent_at IS NULL RETURNING *`,
    [id]
  )).rows[0];
  if (!row) return;
  try {
    await transport.sendMail({ from: config.smtp.from, to: row.to_address, subject: row.subject, text: row.body });
    await query('UPDATE email_outbox SET sent_at = now(), last_error = \'\' WHERE id = $1', [id]);
  } catch (error: any) {
    // 1, 2, 4, 8… minutes, up to 6 hours.
    const minutes = Math.min(2 ** (row.attempts - 1), 360);
    await query(
      `UPDATE email_outbox SET last_error = $2, next_attempt_at = now() + make_interval(mins => $3) WHERE id = $1`,
      [id, String(error?.message || error).slice(0, 500), minutes]
    );
    console.error(`Email ${id} to ${row.to_address} failed (attempt ${row.attempts}):`, error?.message || error);
  }
};

/**
 * Saves the email, then sends it in the background: callers never wait for
 * (or fail because of) the mail server. Failed sends are retried by the
 * background job (deliverDueEmails).
 */
const send = async (to: string, subject: string, text: string) => {
  const { id } = (await query(
    'INSERT INTO email_outbox (to_address, subject, body) VALUES ($1, $2, $3) RETURNING id',
    [to, subject.slice(0, 300), text]
  )).rows[0];
  void deliver(id).catch((error) => console.error('Email delivery failed:', error));
};

/** Sends emails that are due a (re)try; gives up after 10 attempts. */
export const deliverDueEmails = async () => {
  const due = (await query(
    `SELECT id FROM email_outbox WHERE sent_at IS NULL AND attempts < 10 AND next_attempt_at <= now()
     ORDER BY id LIMIT 50`
  )).rows;
  for (const { id } of due) await deliver(id);
  return due.length;
};

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

// ---------- returns ----------

export const sendReturnUpdateEmail = (
  to: string,
  name: string,
  returnId: number,
  headline: string,
  message: string,
  link: string
) =>
  send(
    to,
    `Return #${returnId}: ${headline}`,
    `Hi ${name || 'there'},\n\n${message}\n\nSee your return: ${link}`
  );

// ---------- welcome offers ----------

export const sendWelcomeOfferEmail = (
  to: string,
  name: string,
  offers: { code: string; text: string }[],
  link: string
) =>
  send(
    to,
    offers.length === 1 ? `Welcome! Here’s ${offers[0].text}` : 'Welcome! Here are your new-customer offers',
    `Hi ${name || 'there'},\n\nThanks for joining. ${offers.length === 1 ? 'Here’s a code' : 'Here are codes'} for your order:\n\n${offers
      .map((o) => `- ${o.code}: ${o.text}`)
      .join('\n')}\n\nEnter the code in your cart at checkout.\n\nStart shopping: ${link}`
  );
