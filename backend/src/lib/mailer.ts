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

const orderLines = (items: { name: string; quantity: number; total: number }[]) =>
  items.map((i) => `- ${i.quantity} × ${i.name}: ${i.total.toFixed(2)}`).join('\n');

export const sendOrderConfirmationEmail = (
  to: string,
  order: { id: number; total: number; currency: string; items: { name: string; quantity: number; total: number }[] },
  link: string
) =>
  send(
    to,
    `Your Carlos Shop order #${order.id}`,
    `Thank you for your order.\n\n${orderLines(order.items)}\n\nTotal: ${order.total.toFixed(2)} ${order.currency}\n\nTrack it here: ${link}`
  );

export const sendOrderStatusEmail = (to: string, orderId: number, statusLabel: string, comment: string, link: string) =>
  send(
    to,
    `Order #${orderId} is now ${statusLabel.toLowerCase()}`,
    `Your order #${orderId} is now ${statusLabel.toLowerCase()}.${comment ? `\n\n${comment}` : ''}\n\nDetails: ${link}`
  );
