import { describe, expect, it } from 'vitest';
import { resolveSettings, settingsFromMatches, safeSocialUrl } from '@/lib/site-settings';

describe('Company settings', () => {
  it('preserves optional slogan website links and blocks executable destinations', () => {
    const settings = resolveSettings({ sloganLink: 'https://example.org/about' });
    expect(safeSocialUrl(settings['sloganLink'])).toBe('https://example.org/about');
    expect(safeSocialUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });
  it('uses saved company identity and slogan across the publication', () => {
    const settings = settingsFromMatches([{ loaderData: { settings: { companyName: 'Νέα Εταιρεία', slogan: 'Η φωνή μας' } } }]);
    expect(settings['companyName']).toBe('Νέα Εταιρεία');
    expect(settings['slogan']).toBe('Η φωνή μας');
  });
  it('keeps legacy contact details and preserves intentionally cleared fields', () => {
    const settings = resolveSettings({ email: 'office@example.org', slogan: '' });
    expect(settings['email']).toBe('office@example.org');
    expect(settings['slogan']).toBe('');
    expect(settings['companyName']).toBeTruthy();
  });
  it('blocks executable social links while accepting web addresses', () => {
    expect(safeSocialUrl('javascript:alert(1)')).toBe('');
    expect(safeSocialUrl('https://example.org/company')).toBe('https://example.org/company');
  });
});