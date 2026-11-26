// Shared helpers for article body HTML. Images uploaded to private storage are
// stored as `storage:<path>` references and swapped for signed URLs on display.

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Convert the legacy paragraph array format into HTML. */
export function bodyToHtml(body: string[] | undefined): string {
  return (body ?? [])
    .map((p) =>
      p.startsWith('## ')
        ? `<h2>${escapeHtml(p.slice(3))}</h2>`
        : p.startsWith('> ')
          ? `<blockquote><p>${escapeHtml(p.slice(2))}</p></blockquote>`
          : `<p>${escapeHtml(p)}</p>`,
    )
    .join('');
}

const STORAGE_REF = /storage:([A-Za-z0-9._\-/]+)/g;

export function storagePaths(html: string): string[] {
  return [...new Set([...html.matchAll(STORAGE_REF)].map((m) => m[1]!))];
}

export function replaceStorageRefs(html: string, urls: Record<string, string>): string {
  return html.replace(STORAGE_REF, (all, path: string) => urls[path] ?? all);
}

/** Turn signed preview URLs for editorial images back into durable storage references. */
export function toStorageRefs(html: string): string {
  return html
    .replace(
      /(?:https?:\/\/[^"'\s/]+)?\/api\/media\/file\?key=editorial%2F([^&"'\s]+)(?:&amp;|&)[^"'\s]*/g,
      (_all, path: string) => `storage:${decodeURIComponent(path)}`,
    )
    // Links created by the previous storage provider, in case older drafts still contain them.
    .replace(
      /https?:\/\/[^"'\s]*\/storage\/v1\/object\/sign\/editorial\/([^?"'\s]+)\?token=[^"'\s]*/g,
      (_all, path: string) => `storage:${decodeURIComponent(path)}`,
    );
}

/** Plain-text paragraphs, used for search and excerpts. */
export function htmlToParagraphs(html: string): string[] {
  return html
    .replace(/<\/(p|h[1-6]|li|blockquote|figcaption|figure)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Which posts reference a given storage path (cover or body). */
export function postsUsingPath(
  posts: { id: string; status: string; data: Record<string, unknown> }[],
  path: string,
) {
  const ref = `storage:${path}`;
  return posts.filter((p) => JSON.stringify(p.data).includes(ref));
}
