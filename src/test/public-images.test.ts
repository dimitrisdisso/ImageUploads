import { describe, expect, it } from 'vitest';
import { articleUsesImage, publicImageUrl, validEditorialPath } from '@/lib/public-images';

describe('Publication-checked images', () => {
  it('matches event cover and in-body photos using the same exact-reference rule', () => {
    expect(articleUsesImage({ image: 'storage:event.jpg', html: '<img src="storage:event-detail.jpg">' }, 'event.jpg')).toBe(true);
    expect(articleUsesImage({ image: 'storage:event.jpg', html: '<img src="storage:event-detail.jpg">' }, 'event-detail.jpg')).toBe(true);
    expect(articleUsesImage({ image: 'storage:event.jpg' }, 'another-event.jpg')).toBe(false);
  });
  it('matches exact cover and body references, not path prefixes', () => {
    expect(articleUsesImage({ image: 'storage:a.jpg' }, 'a.jpg')).toBe(true);
    expect(articleUsesImage({ html: '<img src="storage:folder/b.jpg">' }, 'folder/b.jpg')).toBe(true);
    expect(articleUsesImage({ html: '<img src="storage:a.jpg.private">' }, 'a.jpg')).toBe(false);
    expect(articleUsesImage({}, 'a.jpg')).toBe(false);
  });
  it('rejects traversal, remote URLs and invalid paths', () => {
    for (const path of ['../a.jpg', '/a.jpg', 'x//a.jpg', 'https://evil.test/a', 'x/./a.jpg', '']) expect(validEditorialPath(path)).toBe(false);
    expect(validEditorialPath('folder/a.webp')).toBe(true);
  });
  it('returns a same-origin checked link without a reusable storage token', () => {
    expect(publicImageUrl('post 1', 'a.jpg')).toBe('/api/public/editorial-image?article=post%201&path=a.jpg');
  });
});