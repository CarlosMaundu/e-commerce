// src/tests/friendlyError.test.js
import {
  friendlyError,
  GENERIC_ERROR,
  UserFacingError,
} from '../utils/friendlyError';

const firebaseError = (code) =>
  Object.assign(new Error(`Firebase: Error (${code}).`), { code });

const axiosError = (status, data) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  });

describe('friendlyError', () => {
  test.each([
    ['auth/invalid-credential', /email or password is incorrect/i],
    ['auth/email-already-in-use', /already exists/i],
    ['auth/too-many-requests', /too many attempts/i],
    ['auth/network-request-failed', /internet connection/i],
    ['auth/requires-recent-login', /sign in again/i],
    ['auth/expired-action-code', /expired/i],
  ])('maps %s to a friendly sentence', (code, expected) => {
    const message = friendlyError(firebaseError(code));
    expect(message).toMatch(expected);
    expect(message).not.toMatch(/firebase|auth\//i);
  });

  test('never leaks unknown Firebase codes', () => {
    expect(
      friendlyError(firebaseError('auth/some-new-code'), 'Fallback.')
    ).toBe('Fallback.');
  });

  test('translates API validation messages', () => {
    const err = axiosError(400, {
      message: ['email must be an email', 'avatar must be a URL address'],
    });
    expect(friendlyError(err)).toBe(
      'Please enter a valid email address. Please provide a valid image link for the profile picture.'
    );
  });

  test('uses status-based messages and hides technical text', () => {
    expect(friendlyError(axiosError(404, {}))).toMatch(/couldn’t find/i);
    expect(friendlyError(axiosError(503, {}))).toMatch(
      /server ran into a problem/i
    );
    expect(friendlyError(axiosError(400, {}), 'Custom fallback.')).toMatch(
      /details you entered/i
    );
  });

  test('reports network failures when there is no response', () => {
    const err = Object.assign(new Error('Network Error'), {
      isAxiosError: true,
      request: {},
    });
    expect(friendlyError(err)).toMatch(/internet connection/i);
  });

  test('passes through user-facing errors and clean strings', () => {
    expect(friendlyError(new UserFacingError('Already exists.'))).toBe(
      'Already exists.'
    );
    expect(friendlyError('That promo code isn’t valid.')).toBe(
      'That promo code isn’t valid.'
    );
  });

  test('falls back for technical strings and empty input', () => {
    expect(
      friendlyError('TypeError: Cannot read properties of undefined')
    ).toBe(GENERIC_ERROR);
    expect(friendlyError(undefined, 'Nope.')).toBe('Nope.');
  });
});
