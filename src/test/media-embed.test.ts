import { describe, expect, it } from 'vitest';
import {
  auditMediaField, auditMediaHtml, buildMediaUrl, checkMediaUrl, composeCaption, isPinnedRef, mediaFigureHtml,
  mediaSourceFromSettings, normalizeMediaInput, parseMediaUrl, validateMediaSettings, type MediaSource,
} from '@/lib/media-embed';
import { sanitizeArticleHtml } from '@/lib/sanitize-article';

const source: MediaSource = { user: 'epitropi', repo: 'media', ref: 'v1' };
const url = (path: string, ref = 'v1', repo = 'media', user = 'epitropi') => `https://cdn.jsdelivr.net/gh/${user}/${repo}@${ref}/${path}`;

describe('jsDelivr URLs', () => {
  it('builds the canonical URL from a repository path', () => {
    expect(buildMediaUrl(source, 'images/2026/11/plateia.jpg')).toBe(url('images/2026/11/plateia.jpg'));
    expect(buildMediaUrl(source, '/images/a.webp')).toBe(url('images/a.webp'));
  });
  it('rejects paths that would be unpredictable or unsafe', () => {
    for (const bad of ['../secret.jpg', 'images/φωτό.jpg', 'images/a b.jpg', 'images//a.jpg', 'images/a.svg', 'images/a.html', 'images/a', '']) {
      expect(() => buildMediaUrl(source, bad), bad).toThrow();
    }
  });
  it('parses and rejects other hosts, queries and encodings', () => {
    expect(parseMediaUrl(url('a/b.mp4'))?.kind).toBe('video');
    expect(parseMediaUrl(url('a/b.vtt'))?.kind).toBe('captions');
    expect(parseMediaUrl('https://evil.test/gh/epitropi/media@v1/a.jpg')).toBeNull();
    expect(parseMediaUrl('https://cdn.jsdelivr.net.evil.test/gh/epitropi/media@v1/a.jpg')).toBeNull();
    expect(parseMediaUrl('http://cdn.jsdelivr.net/gh/epitropi/media@v1/a.jpg')).toBeNull();
    expect(parseMediaUrl(url('a.jpg') + '?x=1')).toBeNull();
    expect(parseMediaUrl('https://cdn.jsdelivr.net/gh/epitropi/media@v1/a%2e.jpg')).toBeNull();
    expect(parseMediaUrl('https://cdn.jsdelivr.net/npm/lodash@4/a.jpg')).toBeNull();
    expect(parseMediaUrl('https://cdn.jsdelivr.net/gh/epitropi/media/a.jpg')).toBeNull();
  });
  it('converts GitHub page links and bare paths', () => {
    expect(normalizeMediaInput('https://github.com/epitropi/media/blob/v1/images/a.jpg', source)).toBe(url('images/a.jpg'));
    expect(normalizeMediaInput('https://raw.githubusercontent.com/epitropi/media/main/images/a.jpg', source)).toBe(url('images/a.jpg', 'main'));
    expect(normalizeMediaInput('images/a.jpg', source)).toBe(url('images/a.jpg'));
    expect(() => normalizeMediaInput('images/a.jpg', null)).toThrow();
  });
});

describe('Stable references and ownership', () => {
  it('recognises tags and commits as permanent', () => {
    expect(isPinnedRef('v1')).toBe(true);
    expect(isPinnedRef('2026.11')).toBe(true);
    expect(isPinnedRef('a1b2c3d4e5f6')).toBe(true);
    expect(isPinnedRef('main')).toBe(false);
    expect(isPinnedRef('feature')).toBe(false);
  });
  it('accepts only our repository', () => {
    expect(checkMediaUrl(url('a.jpg'), source).ok).toBe(true);
    expect(checkMediaUrl(url('a.jpg', 'v1', 'media', 'someone-else'), source).ok).toBe(false);
    expect(checkMediaUrl(url('a.jpg', 'v1', 'other'), source).ok).toBe(false);
    expect(checkMediaUrl(url('a.jpg'), null).ok).toBe(false);
  });
  it('accepts the configured ref or a pinned ref, and warns about branches', () => {
    expect(checkMediaUrl(url('a.jpg', 'v7'), source).ok).toBe(true);
    expect(checkMediaUrl(url('a.jpg', 'abcdef1234'), source).ok).toBe(true);
    expect(checkMediaUrl(url('a.jpg', 'dev'), source).ok).toBe(false);
    const onMain = checkMediaUrl(url('a.jpg', 'main'), { ...source, ref: 'main' });
    expect(onMain.ok && onMain.notes.length).toBe(1);
  });
  it('checks the kind of file', () => {
    expect(checkMediaUrl(url('a.mp3'), source, ['image']).ok).toBe(false);
    expect(checkMediaUrl(url('a.mp3'), source, ['audio']).ok).toBe(true);
  });
  it('reads and validates the settings', () => {
    expect(mediaSourceFromSettings({ mediaGithubUser: 'epitropi', mediaGithubRepo: 'media', mediaRef: '' })).toEqual({ user: 'epitropi', repo: 'media', ref: 'main' });
    expect(mediaSourceFromSettings({})).toBeNull();
    expect(validateMediaSettings({})).toBeNull();
    expect(validateMediaSettings({ mediaGithubUser: 'epitropi' })).not.toBeNull();
    expect(validateMediaSettings({ mediaGithubUser: 'bad user', mediaGithubRepo: 'media' })).not.toBeNull();
    expect(validateMediaSettings({ mediaGithubUser: 'epitropi', mediaGithubRepo: 'media', mediaRef: 'v1' })).toBeNull();
  });
});

describe('Audit of saved content', () => {
  it('flags media from elsewhere and allows our own', () => {
    expect(auditMediaHtml(`<img src="${url('a.jpg')}" alt="x"><img src="storage:b.jpg">`, source)).toEqual([]);
    expect(auditMediaHtml('<img src="https://example.com/a.jpg">', source)).toHaveLength(1);
    expect(auditMediaHtml(`<video poster="${url('p.jpg')}"><source src="${url('a.mp4')}"><track src="${url('a.vtt')}"></video>`, source)).toEqual([]);
    expect(auditMediaHtml('<video><source src="https://example.com/a.mp4"></video>', source)).toHaveLength(1);
    expect(auditMediaHtml(`<img src="${url('a.jpg')}">`, null)).toHaveLength(1);
  });
  it('checks cover image fields', () => {
    expect(auditMediaField('', source)).toBeNull();
    expect(auditMediaField('storage:x.jpg', source)).toBeNull();
    expect(auditMediaField(url('a.jpg'), source)).toBeNull();
    expect(auditMediaField('https://example.com/a.jpg', source)).not.toBeNull();
  });
});

describe('Embed markup', () => {
  it('builds accessible, lazy images with a credit line', () => {
    const html = mediaFigureHtml({ kind: 'image', src: url('a.jpg'), label: 'Η πλατεία', caption: 'Απόγευμα', credit: 'Μαρία Κ.' });
    expect(html).toContain('alt="Η πλατεία"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('Φωτογραφία: Μαρία Κ.');
    expect(composeCaption('Απόγευμα', 'Μαρία Κ.', 'image')).toBe('Απόγευμα — Φωτογραφία: Μαρία Κ.');
  });
  it('builds video and audio with controls, metadata preload and a fallback link', () => {
    const video = mediaFigureHtml({ kind: 'video', src: url('a.mp4'), label: 'Συνέντευξη', captions: url('a.vtt'), poster: url('p.jpg') });
    expect(video).toContain('controls');
    expect(video).toContain('preload="metadata"');
    expect(video).not.toContain('autoplay');
    expect(video).toContain('<track kind="captions"');
    expect(video).toContain(`<a href="${url('a.mp4')}">`);
    const audio = mediaFigureHtml({ kind: 'audio', src: url('a.mp3'), label: 'Ηχογράφηση' });
    expect(audio).toContain('type="audio/mpeg"');
  });
  it('escapes editor text', () => {
    expect(mediaFigureHtml({ kind: 'image', src: url('a.jpg'), label: '"><script>x</script>' })).not.toContain('<script>');
  });
});

describe('Sanitizer and media', () => {
  const opts = { origin: 'https://site.test', media: source };
  it('keeps our own media and its markup', () => {
    const html = [
      mediaFigureHtml({ kind: 'image', src: url('a.jpg'), label: 'x', credit: 'Μ' }),
      mediaFigureHtml({ kind: 'video', src: url('a.mp4'), label: 'v', captions: url('a.vtt'), poster: url('p.jpg') }),
      mediaFigureHtml({ kind: 'audio', src: url('a.mp3'), label: 'a' }),
    ].join('');
    const out = sanitizeArticleHtml(html, opts);
    expect(out).toContain(`src="${url('a.jpg')}"`);
    expect(out).toContain('<video');
    expect(out).toContain('<track');
    expect(out).toContain('<audio');
    expect(out).toContain('media-credit');
    expect(out).toContain('controls');
  });
  it('removes media from other hosts, other repositories and unsafe references', () => {
    const out = sanitizeArticleHtml(
      `<img src="https://example.com/a.jpg"><img src="${url('a.jpg', 'v1', 'other')}"><img src="data:image/png;base64,AAAA"><video autoplay onerror="x()" poster="https://example.com/p.jpg"><source src="https://example.com/a.mp4"></video><img src="https://site.test/api/media/file?key=x"><img src="storage:ok.jpg">`,
      opts,
    );
    expect(out).not.toContain('example.com');
    expect(out).not.toContain('other');
    expect(out).not.toContain('data:');
    expect(out).not.toContain('autoplay');
    expect(out).not.toContain('onerror');
    expect(out).toContain('https://site.test/api/media/file');
    expect(out).toContain('storage:ok.jpg');
  });
  it('accepts no jsDelivr media when the repository is not configured', () => {
    expect(sanitizeArticleHtml(`<img src="${url('a.jpg')}">`)).not.toContain('jsdelivr');
  });
});
