import { sentEmails } from './helpers';

export const mailerMock = () => ({
  sendPasswordResetEmail: jest.fn(async (to: string, link: string) => {
    sentEmails.push({ to, link, kind: 'reset' });
  }),
  sendAccountSetupEmail: jest.fn(async (to: string, _name: string, link: string) => {
    sentEmails.push({ to, link, kind: 'setup' });
  }),
});

export const tokenFrom = (link: string) => new URL(link).searchParams.get('token')!;
