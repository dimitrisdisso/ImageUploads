import { describe, it, expect } from 'vitest';
import { pickLead } from '@/lib/editorial';
const list = [{ slug: 'newest' }, { slug: 'older' }];
describe('homepage lead article', () => {
  it('uses the admin-chosen article', () => { expect(pickLead(list, 'older')?.slug).toBe('older'); });
  it('falls back to the newest when none is chosen or it is gone', () => {
    expect(pickLead(list, '')?.slug).toBe('newest');
    expect(pickLead(list, 'deleted')?.slug).toBe('newest');
  });
});
