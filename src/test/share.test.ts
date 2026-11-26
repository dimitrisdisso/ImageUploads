import { describe, expect, it } from 'vitest';
import { shareLinks } from '@/lib/share';

describe('Article sharing', () => {
  it('shares the exact article link with social platforms', () => {
    const url = 'https://example.org/arthro/hello';
    const links = shareLinks(url, 'Νέα & ιστορίες');
    expect(new URL(links.find(link => link.label === 'Facebook')?.href ?? '').searchParams.get('u')).toBe(url);
    expect(new URL(links.find(link => link.label === 'X')?.href ?? '').searchParams.get('text')).toBe('Νέα & ιστορίες');
    expect(new URL(links.find(link => link.label === 'WhatsApp')?.href ?? '').searchParams.get('text')).toBe(`Νέα & ιστορίες ${url}`);
  });
});