import { describe, expect, it } from 'vitest';
import { signupOutcome, authFailure } from '@/lib/auth-feedback';

describe('Registration and recovery outcomes', () => {
  it('does not claim a confirmation email was sent for an existing confirmed account', () => {
    expect(signupOutcome({ session: null, user: { identities: [] } })).toBe('existing');
  });
  it('requires confirmation for a new registration without a session', () => {
    expect(signupOutcome({ session: null, user: { identities: [{}] } })).toBe('confirmation');
  });
  it('recognizes a signed-in registration', () => {
    expect(signupOutcome({ session: {}, user: { identities: [{}] } })).toBe('signed-in');
  });
  it('distinguishes email limits from other failures', () => {
    expect(authFailure({ code: 'over_email_send_rate_limit' }, 'fallback')).not.toBe('fallback');
    expect(authFailure({ code: 'unknown' }, 'fallback')).toBe('fallback');
  });
});