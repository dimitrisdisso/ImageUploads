import { storagePaths } from './article-html';

export function validEditorialPath(path: string) {
  return path.length > 0 && path.length <= 1024 && /^[A-Za-z0-9._\-/]+$/.test(path)
    && path.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

export function articleUsesImage(data: { image?: string; html?: string }, path: string) {
  return data.image === `storage:${path}` || storagePaths(data.html ?? '').includes(path);
}

export function publicImageUrl(articleId: string, path: string) {
  return `/api/public/editorial-image?article=${encodeURIComponent(articleId)}&path=${encodeURIComponent(path)}`;
}