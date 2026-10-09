import { sentEmails } from './helpers';

export const mailerMock = () => ({
  sendPasswordResetEmail: jest.fn(async (to: string, link: string) => {
    sentEmails.push({ to, link, kind: 'reset' });
  }),
  sendVerificationEmail: jest.fn(async (to: string, _name: string, link: string) => {
    sentEmails.push({ to, link, kind: 'verify' });
  }),
  sendSupportReceivedEmail: jest.fn(async (to: string, _name: string, number: string, _s: string, link: string) => {
    sentEmails.push({ to, link, kind: `support:received:${number}` });
  }),
  sendSupportReplyEmail: jest.fn(async (to: string, _name: string, number: string, _s: string, _r: string, link: string) => {
    sentEmails.push({ to, link, kind: `support:reply:${number}` });
  }),
  sendSupportAlertEmail: jest.fn(async (to: string, number: string, _s: string, _f: string, _m: string, link: string) => {
    sentEmails.push({ to, link, kind: `support:alert:${number}` });
  }),
  sendAccountSetupEmail: jest.fn(async (to: string, _name: string, link: string) => {
    sentEmails.push({ to, link, kind: 'setup' });
  }),
  sendOrderConfirmationEmail: jest.fn(async (to: string, _order: unknown, link: string) => {
    sentEmails.push({ to, link, kind: 'order' });
  }),
  sendOrderStatusEmail: jest.fn(async (to: string, _id: number, status: string, _c: string, link: string) => {
    sentEmails.push({ to, link, kind: `status:${status}` });
  }),
});

export const tokenFrom = (link: string) => new URL(link).searchParams.get('token')!;
