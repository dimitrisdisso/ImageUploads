// Media hosted in a public GitHub repository and served through the jsDelivr CDN.
//
//   https://cdn.jsdelivr.net/gh/USER/REPO@REF/path/to/file.ext
//
// This module is pure (no imports, no browser or server APIs) so the editor, the server-side
// validation, the sanitizer and the tests all share exactly the same rules.

export type MediaKind = 'image' | 'video' | 'audio';
/** `captions` are WebVTT subtitle files that belong to a video. */
export type MediaFileKind = MediaKind | 'captions';
export type MediaSource = { user: string; repo: string; ref: string };
export type ParsedMediaUrl = MediaSource & { path: string; ext: string; kind: MediaFileKind; url: string };

export const CDN_HOST = 'cdn.jsdelivr.net';
export const CDN_ORIGIN = `https://${CDN_HOST}`;
/** jsDelivr does not serve single GitHub files larger than this by default. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Supported file types. SVG is deliberately absent (it can carry scripts). */
export const FILE_TYPES: Record<string, { kind: MediaFileKind; mime: string }> = {
  jpg: { kind: 'image', mime: 'image/jpeg' },
  jpeg: { kind: 'image', mime: 'image/jpeg' },
  png: { kind: 'image', mime: 'image/png' },
  webp: { kind: 'image', mime: 'image/webp' },
  gif: { kind: 'image', mime: 'image/gif' },
  avif: { kind: 'image', mime: 'image/avif' },
  mp4: { kind: 'video', mime: 'video/mp4' },
  webm: { kind: 'video', mime: 'video/webm' },
  mp3: { kind: 'audio', mime: 'audio/mpeg' },
  m4a: { kind: 'audio', mime: 'audio/mp4' },
  ogg: { kind: 'audio', mime: 'audio/ogg' },
  opus: { kind: 'audio', mime: 'audio/ogg; codecs=opus' },
  wav: { kind: 'audio', mime: 'audio/wav' },
  vtt: { kind: 'captions', mime: 'text/vtt' },
};

export const CREDIT_LABEL: Record<MediaKind, string> = { image: 'Φωτογραφία', video: 'Βίντεο', audio: 'Ηχητικό' };

export type MediaUrlErrorCode = 'not_configured' | 'host' | 'http' | 'query' | 'path' | 'ext' | 'ref' | 'repo' | 'kind' | 'input';

/** Error with a message that can be shown to editors as it is (Greek, like the rest of the back office). */
export class MediaUrlError extends Error {
  code: MediaUrlErrorCode;
  constructor(code: MediaUrlErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const USER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^(?!\.+$)[A-Za-z0-9._-]{1,100}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const SHA_RE = /^[0-9a-f]{7,40}$/i;
const TAG_RE = /^v?\d[A-Za-z0-9._-]*$/;

/** A commit hash or a version tag (v1, v2.1, 2026.11) never changes, so jsDelivr caches it permanently. */
export function isPinnedRef(ref: string): boolean {
  return SHA_RE.test(ref) || TAG_RE.test(ref);
}

export function isValidSource(source: MediaSource | null | undefined): source is MediaSource {
  return Boolean(source && USER_RE.test(source.user) && REPO_RE.test(source.repo) && REF_RE.test(source.ref));
}

const supportedList = () => Object.keys(FILE_TYPES).map((e) => `.${e}`).join(', ');

export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function mediaKindOfPath(path: string): MediaFileKind | null {
  return FILE_TYPES[extensionOf(path)]?.kind ?? null;
}

export function mimeTypeOfPath(path: string): string {
  return FILE_TYPES[extensionOf(path)]?.mime ?? 'application/octet-stream';
}

function cleanPath(input: string): string {
  const path = input.trim().replace(/^(\.\/|\/)+/, '');
  const segments = path.split('/');
  if (!path || path.length > 300 || segments.length > 8 || !segments.every((s) => SEGMENT_RE.test(s))) {
    throw new MediaUrlError('path', 'Η διαδρομή του αρχείου πρέπει να έχει μόνο λατινικά γράμματα, αριθμούς και τα - _ . (χωρίς κενά ή ελληνικά), π.χ. images/2026/11/plateia.jpg');
  }
  const ext = extensionOf(path);
  if (!FILE_TYPES[ext]) throw new MediaUrlError('ext', `Μη υποστηριζόμενος τύπος αρχείου${ext ? ` (.${ext})` : ''}. Επιτρέπονται: ${supportedList()}.`);
  return path;
}

function build(source: MediaSource, path: string): ParsedMediaUrl {
  if (!isValidSource(source)) throw new MediaUrlError('not_configured', 'Ορίστε πρώτα το αποθετήριο GitHub στις Ρυθμίσεις (ενότητα «Πολυμέσα»).');
  const clean = cleanPath(path);
  const ext = extensionOf(clean);
  const kind = FILE_TYPES[ext]!.kind;
  return { ...source, path: clean, ext, kind, url: `${CDN_ORIGIN}/gh/${source.user}/${source.repo}@${source.ref}/${clean}` };
}

/** Builds the jsDelivr URL for a file path inside the media repository. */
export function buildMediaUrl(source: MediaSource, path: string): string {
  return build(source, path).url;
}

function parseOrThrow(input: string): ParsedMediaUrl {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new MediaUrlError('input', 'Μη έγκυρη διεύθυνση.');
  }
  if (url.hostname === CDN_HOST && url.protocol === 'http:') throw new MediaUrlError('http', 'Χρησιμοποιήστε https:// στη διεύθυνση.');
  if (url.protocol !== 'https:' || url.hostname !== CDN_HOST || url.username || url.password || url.port) {
    throw new MediaUrlError('host', `Επιτρέπονται μόνο σύνδεσμοι της μορφής ${CDN_ORIGIN}/gh/ΧΡΗΣΤΗΣ/ΑΠΟΘΕΤΗΡΙΟ@ΕΚΔΟΣΗ/αρχείο.`);
  }
  if (url.search || url.hash) throw new MediaUrlError('query', 'Αφαιρέστε ό,τι υπάρχει μετά το «?» ή το «#» στη διεύθυνση.');
  if (url.pathname.includes('%') || !url.pathname.startsWith('/gh/')) {
    throw new MediaUrlError('host', `Επιτρέπονται μόνο σύνδεσμοι της μορφής ${CDN_ORIGIN}/gh/ΧΡΗΣΤΗΣ/ΑΠΟΘΕΤΗΡΙΟ@ΕΚΔΟΣΗ/αρχείο.`);
  }
  const rest = url.pathname.slice(4).split('/');
  const user = rest[0] ?? '';
  const repoRef = rest[1] ?? '';
  const at = repoRef.indexOf('@');
  if (at < 1) throw new MediaUrlError('ref', 'Λείπει η έκδοση στη διεύθυνση: ΑΠΟΘΕΤΗΡΙΟ@main ή ΑΠΟΘΕΤΗΡΙΟ@v1.');
  const source: MediaSource = { user, repo: repoRef.slice(0, at), ref: repoRef.slice(at + 1) };
  if (!isValidSource(source)) throw new MediaUrlError('ref', 'Μη έγκυρο όνομα χρήστη, αποθετηρίου ή έκδοσης στη διεύθυνση.');
  return build(source, rest.slice(2).join('/'));
}

/** Parses a jsDelivr GitHub URL; returns null for anything else (never throws). */
export function parseMediaUrl(input: string): ParsedMediaUrl | null {
  try {
    return parseOrThrow(input);
  } catch {
    return null;
  }
}

/**
 * Turns whatever an editor pasted into the canonical jsDelivr URL. Accepts:
 *  - a jsDelivr URL
 *  - a file path inside the media repository (images/2026/11/photo.jpg)
 *  - a github.com "blob"/"raw" page URL or raw.githubusercontent.com URL (converted to jsDelivr)
 * Throws MediaUrlError with a message for the editor when it cannot.
 */
export function normalizeMediaInput(input: string, source: MediaSource | null): string {
  const value = input.trim();
  if (!value) throw new MediaUrlError('input', 'Επικολλήστε τη διεύθυνση ή τη διαδρομή του αρχείου.');
  if (!/^https?:\/\//i.test(value)) {
    if (!isValidSource(source)) throw new MediaUrlError('not_configured', 'Ορίστε πρώτα το αποθετήριο GitHub στις Ρυθμίσεις (ενότητα «Πολυμέσα»).');
    return build(source, value).url;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new MediaUrlError('input', 'Μη έγκυρη διεύθυνση.');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (url.hostname === 'github.com' && (parts[2] === 'blob' || parts[2] === 'raw') && parts.length > 4) {
    return build({ user: parts[0]!, repo: parts[1]!, ref: parts[3]! }, parts.slice(4).join('/')).url;
  }
  if (url.hostname === 'raw.githubusercontent.com' && parts.length > 3) {
    return build({ user: parts[0]!, repo: parts[1]!, ref: parts[2]! }, parts.slice(3).join('/')).url;
  }
  return parseOrThrow(value).url;
}

export type MediaCheck = { ok: true; parsed: ParsedMediaUrl; notes: string[] } | { ok: false; code: MediaUrlErrorCode; message: string };

/**
 * Full policy check for a URL that is about to be stored or published:
 * jsDelivr only, exactly our repository, and a stable reference (the configured one, or any tag/commit).
 */
export function checkMediaUrl(input: string, source: MediaSource | null | undefined, kinds?: MediaFileKind[]): MediaCheck {
  let parsed: ParsedMediaUrl;
  try {
    parsed = parseOrThrow(input);
  } catch (error) {
    return error instanceof MediaUrlError ? { ok: false, code: error.code, message: error.message } : { ok: false, code: 'input', message: 'Μη έγκυρη διεύθυνση.' };
  }
  if (!isValidSource(source)) return { ok: false, code: 'not_configured', message: 'Ορίστε πρώτα το αποθετήριο GitHub στις Ρυθμίσεις (ενότητα «Πολυμέσα»).' };
  if (parsed.user.toLowerCase() !== source.user.toLowerCase() || parsed.repo.toLowerCase() !== source.repo.toLowerCase()) {
    return { ok: false, code: 'repo', message: `Το αρχείο ανήκει σε άλλο αποθετήριο (${parsed.user}/${parsed.repo}). Επιτρέπονται μόνο αρχεία από το ${source.user}/${source.repo}.` };
  }
  if (parsed.ref !== source.ref && !isPinnedRef(parsed.ref)) {
    return { ok: false, code: 'ref', message: `Η έκδοση «${parsed.ref}» δεν είναι αποδεκτή. Χρησιμοποιήστε «${source.ref}», ένα tag (π.χ. v1) ή ένα commit.` };
  }
  if (kinds && !kinds.includes(parsed.kind)) {
    return { ok: false, code: 'kind', message: `Αυτό το αρχείο (.${parsed.ext}) δεν ταιριάζει εδώ. Αναμένεται: ${kinds.join(' ή ')}.` };
  }
  const notes: string[] = [];
  if (!isPinnedRef(parsed.ref)) {
    notes.push(`Η έκδοση «${parsed.ref}» είναι branch: το jsDelivr την κρατά στην κρυφή μνήμη έως 12 ώρες, οπότε μια αλλαγή αρχείου δεν φαίνεται αμέσως. Για μόνιμους συνδέσμους ορίστε ένα tag (π.χ. v1).`);
  }
  return { ok: true, parsed, notes };
}

/**
 * Cheap yes/no used by the sanitizer. With `source === undefined` only the format is checked;
 * with a source (or null = "not configured") the repository and reference are enforced too.
 */
export function isAllowedMediaUrl(url: string | undefined, source?: MediaSource | null, kinds?: MediaFileKind[]): boolean {
  if (!url) return false;
  if (source === undefined) {
    const parsed = parseMediaUrl(url);
    return Boolean(parsed && (!kinds || kinds.includes(parsed.kind)));
  }
  return checkMediaUrl(url, source, kinds).ok;
}

/** Reads the media repository from the site settings; null when it is not (validly) configured. */
export function mediaSourceFromSettings(settings: Record<string, string | undefined>): MediaSource | null {
  const source: MediaSource = {
    user: (settings['mediaGithubUser'] ?? '').trim(),
    repo: (settings['mediaGithubRepo'] ?? '').trim(),
    ref: (settings['mediaRef'] ?? '').trim() || 'main',
  };
  return isValidSource(source) ? source : null;
}

/** Message for the settings form, or null when the three fields are fine (or all empty). */
export function validateMediaSettings(settings: Record<string, string | undefined>): string | null {
  const user = (settings['mediaGithubUser'] ?? '').trim();
  const repo = (settings['mediaGithubRepo'] ?? '').trim();
  const ref = (settings['mediaRef'] ?? '').trim();
  if (!user && !repo && !ref) return null;
  if (!user || !repo) return 'Συμπληρώστε και το όνομα χρήστη και το όνομα αποθετηρίου GitHub για τα πολυμέσα.';
  if (!USER_RE.test(user)) return 'Μη έγκυρο όνομα χρήστη GitHub (μόνο γράμματα, αριθμοί και παύλες).';
  if (!REPO_RE.test(repo)) return 'Μη έγκυρο όνομα αποθετηρίου GitHub.';
  if (ref && !REF_RE.test(ref)) return 'Μη έγκυρη έκδοση (tag, commit ή branch χωρίς κενά ή «/»).';
  return null;
}

const decodeAttr = (value: string) => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/**
 * Lists every problem with media references inside article HTML:
 * images, video, audio, sources, posters and caption tracks must point to the site's own storage
 * or to the configured GitHub repository through jsDelivr.
 */
export function auditMediaHtml(html: string, source: MediaSource | null | undefined): string[] {
  const problems: string[] = [];
  for (const tag of html.matchAll(/<(img|video|audio|source|track)\b[^>]*>/gi)) {
    const name = tag[1]!.toLowerCase();
    for (const attr of tag[0].matchAll(/\b(src|poster)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      const attribute = attr[1]!.toLowerCase();
      const value = decodeAttr(attr[2] ?? attr[3] ?? '').trim();
      if (!value) continue;
      const imageLike = name === 'img' || attribute === 'poster';
      if (imageLike && value.startsWith('storage:')) continue;
      if (imageLike && value.startsWith('/') && !value.startsWith('//')) continue;
      const kinds: MediaFileKind[] = imageLike ? ['image'] : name === 'track' ? ['captions'] : ['video', 'audio'];
      const result = checkMediaUrl(value, source, kinds);
      if (!result.ok) problems.push(`${result.message} (${value.slice(0, 120)})`);
    }
  }
  return problems;
}

/** Cover-style fields: empty, a bundled/own-storage reference, or an allowed jsDelivr image. */
export function auditMediaField(value: string, source: MediaSource | null | undefined): string | null {
  const v = value.trim();
  if (!v || v.startsWith('asset:') || v.startsWith('storage:') || (v.startsWith('/') && !v.startsWith('//'))) return null;
  const result = checkMediaUrl(v, source, ['image']);
  return result.ok ? null : `${result.message} (${v.slice(0, 120)})`;
}

/** Caption + credit as a single line, e.g. "Η πλατεία το απόγευμα — Φωτογραφία: Μαρία Κ." */
export function composeCaption(caption: string, credit: string, kind: MediaKind): string {
  return [caption.trim(), credit.trim() ? `${CREDIT_LABEL[kind]}: ${credit.trim()}` : ''].filter(Boolean).join(' — ');
}

export const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export type MediaFigureOptions = {
  kind: MediaKind;
  /** Full jsDelivr URL (use buildMediaUrl to make one from a path). */
  src: string;
  /** Image: alt text (required). Video/audio: short title used as the accessible name. */
  label: string;
  caption?: string;
  credit?: string;
  /** Video only: poster image URL. */
  poster?: string;
  /** Video only: WebVTT captions URL. */
  captions?: string;
};

/**
 * The markup the editor stores for an image, video or audio block. It is exactly what the article
 * sanitizer accepts, so it can also be pasted into a CMS field or used in seed content.
 */
export function mediaFigureHtml(o: MediaFigureOptions): string {
  const src = escapeHtml(o.src);
  const type = escapeHtml(mimeTypeOfPath(o.src));
  const credit = o.credit?.trim() ? `<span class="media-credit">${escapeHtml(`${CREDIT_LABEL[o.kind]}: ${o.credit.trim()}`)}</span>` : '';
  const caption = o.caption?.trim() ? escapeHtml(o.caption.trim()) : '';
  const figcaption = caption || credit ? `<figcaption>${caption}${caption && credit ? ' ' : ''}${credit}</figcaption>` : '';
  const head = (kind: MediaKind) => `<figure data-type="article-${kind}" data-align="center" data-width="100" class="article-figure${kind === 'image' ? '' : ' media-figure'}">`;
  if (o.kind === 'image') {
    return `${head('image')}<img src="${src}" alt="${escapeHtml(o.label)}" loading="lazy" decoding="async">${figcaption}</figure>`;
  }
  const fallback = `<p>Το πρόγραμμα περιήγησής σας δεν μπορεί να αναπαράγει αυτό το αρχείο. <a href="${src}">Άνοιγμα ή λήψη ${o.kind === 'video' ? 'βίντεο' : 'ηχητικού'}</a>.</p>`;
  if (o.kind === 'video') {
    const poster = o.poster ? ` poster="${escapeHtml(o.poster)}"` : '';
    const track = o.captions ? `<track kind="captions" src="${escapeHtml(o.captions)}" srclang="el" label="Ελληνικά">` : '';
    const cors = o.captions ? ' crossorigin="anonymous"' : '';
    return `${head('video')}<video controls preload="metadata" playsinline${poster}${cors} aria-label="${escapeHtml(o.label)}"><source src="${src}" type="${type}">${track}${fallback}</video>${figcaption}</figure>`;
  }
  return `${head('audio')}<audio controls preload="metadata" aria-label="${escapeHtml(o.label)}"><source src="${src}" type="${type}">${fallback}</audio>${figcaption}</figure>`;
}
