import { sentEmails } from './helpers';

export const mailerMock = () => ({
  sendPasswordResetEmail: jest.fn(async (to: string, link: string) => {
    sentEmails.push({ to, link, kind: 'reset' });
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
