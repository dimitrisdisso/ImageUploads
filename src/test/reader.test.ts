import { describe, it, expect } from 'vitest';
import { COMMENT_PUBLISHED_STATUS, registrationSchema, commentSchema, safeReturnPath, canEditComment } from '@/lib/reader';
describe('Reader account rules', () => {
  it('publishes new and edited comments without inspection', () => expect(COMMENT_PUBLISHED_STATUS).toBe('approved'));
  it('requires a name at registration', () => expect(registrationSchema.safeParse({ name: '', email: 'reader@example.com', password: 'password123' }).success).toBe(false));
  it('validates registration email', () => expect(registrationSchema.safeParse({ name: 'Αναγνώστης', email: 'not-an-email', password: 'password123' }).success).toBe(false));
  it('rejects an empty comment', () => expect(commentSchema.safeParse('   ').success).toBe(false));
  it('limits comments to 1500 characters', () => { expect(commentSchema.safeParse('α'.repeat(1500)).success).toBe(true); expect(commentSchema.safeParse('α'.repeat(1501)).success).toBe(false); });
  it('only allows the owner to edit a comment', () => { expect(canEditComment({ user_id: 'owner' }, 'owner')).toBe(true); expect(canEditComment({ user_id: 'owner' }, 'other')).toBe(false); expect(canEditComment({ user_id: null }, undefined)).toBe(false); });
  it('returns readers to an article', () => expect(safeReturnPath('/arthro/test')).toBe('/arthro/test'));
  it('never accepts an external login destination', () => { for (const url of ['https://evil.test', '//evil.test', '/\\evil.test', '/auth']) expect(safeReturnPath(url)).toBe('/profile'); });
});