import { describe, it, expect } from 'vitest';
import { bodyToHtml, htmlToParagraphs, postsUsingPath, replaceStorageRefs, storagePaths, toStorageRefs } from '@/lib/article-html';
import { sanitizeArticleHtml } from '@/lib/sanitize-article';
import { bucketSeries } from '@/lib/stats';

describe('Article body storage', () => {
  it('turns signed image links back into durable references when saving', () => {
    const html = '<img src="https://old-storage.example/storage/v1/object/sign/editorial/abc.webp?token=eyJ.a.b">';
    expect(toStorageRefs(html)).toBe('<img src="storage:abc.webp">');
  });
  it('turns signed R2 preview links back into durable references', () => {
    const html = '<img src="/api/media/file?key=editorial%2Fabc.webp&amp;exp=1&amp;sig=x-Y_z"><img src="https://site.gr/api/media/file?key=editorial%2Fdef.jpg&exp=2&sig=q">';
    expect(toStorageRefs(html)).toBe('<img src="storage:abc.webp"><img src="storage:def.jpg">');
  });
  it('swaps references for viewable links when displaying', () => {
    const html = '<img src="storage:abc.webp"><img src="storage:def.jpg">';
    expect(storagePaths(html)).toEqual(['abc.webp', 'def.jpg']);
    expect(replaceStorageRefs(html, { 'abc.webp': 'https://a', 'def.jpg': 'https://d' })).toBe('<img src="https://a"><img src="https://d">');
  });
  it('converts older articles without losing headings or quotes', () => {
    expect(bodyToHtml(['Κείμενο', '## Τίτλος', '> Παράθεση'])).toBe('<p>Κείμενο</p><h2>Τίτλος</h2><blockquote><p>Παράθεση</p></blockquote>');
  });
  it('keeps plain paragraphs for search', () => {
    expect(htmlToParagraphs('<h2>Άνω Πόλη</h2><p>Πρώτη <strong>γραμμή</strong></p>')).toEqual(['Άνω Πόλη', 'Πρώτη γραμμή']);
  });
});

describe('Media usage', () => {
  it('detects an image used in an article body or cover', () => {
    const posts = [
      { id: 'a', status: 'published', data: { image: 'storage:cover.jpg' } },
      { id: 'b', status: 'draft', data: { html: '<img src="storage:body.jpg">' } },
    ];
    expect(postsUsingPath(posts, 'cover.jpg').map((p) => p.id)).toEqual(['a']);
    expect(postsUsingPath(posts, 'body.jpg').map((p) => p.id)).toEqual(['b']);
    expect(postsUsingPath(posts, 'other.jpg')).toEqual([]);
  });
});

describe('Published formatting', () => {
  it('keeps quote blocks, image positions and colors', () => {
    const html = '<figure data-type="pull-quote" data-variant="wide" class="pull-quote"><blockquote><p>Λόγια</p></blockquote><figcaption><cite>Σοφία</cite></figcaption></figure><figure data-type="article-image" data-align="right" data-width="50" class="article-figure"><img src="storage:a.jpg" alt="x"></figure><p><span style="color: #7b1d26">κόκκινο</span></p>';
    const out = sanitizeArticleHtml(html);
    expect(out).toContain('data-variant="wide"');
    expect(out).toContain('data-align="right"');
    expect(out).toContain('src="storage:a.jpg"');
    expect(out).toContain('color:#7b1d26');
  });
  it('removes scripts and unsafe links', () => {
    const out = sanitizeArticleHtml('<p onclick="x()">α</p><script>alert(1)</script><a href="javascript:alert(1)">β</a><iframe src="https://evil.test"></iframe>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('evil.test');
  });
  it('drops site classes that could restyle the page and forces https embeds', () => {
    const out = sanitizeArticleHtml('<p class="fixed inset-0 z-50">α</p><figure class="pull-quote fixed"><blockquote><p>β</p></blockquote></figure><div data-youtube-video=""><iframe src="http://www.youtube.com/embed/x"></iframe></div><iframe src="https://www.youtube-nocookie.com/embed/y"></iframe>');
    expect(out).not.toContain('fixed');
    expect(out).toContain('class="pull-quote"');
    expect(out).not.toContain('http://www.youtube.com');
    expect(out).toContain('sandbox=');
  });
});

describe('Statistics charts', () => {
  it('shows every day of a 7-day range, including empty days', () => {
    const series = bucketSeries([{ day: '2026-10-20', count: 2 }], 7, new Date('2026-10-20T12:00:00Z'));
    expect(series).toHaveLength(7);
    expect(series.at(-1)?.count).toBe(2);
    expect(series.slice(0, 6).every((s) => s.count === 0)).toBe(true);
  });
  it('groups all-time data by month', () => {
    const series = bucketSeries([{ day: '2026-09-01', count: 1 }, { day: '2026-09-15', count: 2 }, { day: '2026-10-02', count: 4 }], 0);
    expect(series.map((s) => s.count)).toEqual([3, 4]);
  });
});
