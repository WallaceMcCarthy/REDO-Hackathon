import { describe, expect, it } from 'vitest';
import { plainError } from './AuthModal';

describe('plainError', () => {
  const redacted = new Error('[Request ID: x] Server Error');
  it('sign-in mentions the pause after failed tries', () => {
    expect(plainError(redacted, 'signIn')).toMatch(/pauses for a while/);
  });
  it('sign-up does not claim the email has an account', () => {
    expect(plainError(redacted, 'signUp')).not.toMatch(/already has an account/);
    expect(plainError(new Error('Account a@b.c already exists'), 'signUp')).toMatch(/already has an account/);
  });
});
