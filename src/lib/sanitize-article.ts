import sanitizeHtml from 'sanitize-html';
import { checkMediaUrl, type MediaFileKind, type MediaSource } from './media-embed';

const styleProps = {
  color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i],
  'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i],
  'font-size': [/^\d{1,3}(px|rem|em|%)$/],
  'font-family': [/^[\w\s,"'-]{1,80}$/],
  'text-align': [/^(left|right|center|justify)$/],
};

export type SanitizeMediaOptions = {
  /** The site's own origin: images served from it (signed storage URLs) are allowed. */
  origin?: string;
  /** The configured GitHub media repository. Without it no jsDelivr media is accepted. */
  media?: MediaSource | null;
};

export function sanitizeArticleHtml(html: string, options: SanitizeMediaOptions = {}): string {
  const media = options.media ?? null;
  const sameOrigin = (value: string) => {
    if (value.startsWith('/') && !value.startsWith('//')) return true;
    try {
      return Boolean(options.origin) && new URL(value).origin === new URL(options.origin!).origin;
    } catch {
      return false;
    }
  };
  /** Media may come from the site's own storage or from our GitHub repository via jsDelivr, nowhere else. */
  const allowed = (value: string | undefined, kinds: MediaFileKind[], ownImages = false) => {
    const v = (value ?? '').trim();
    if (!v) return false;
    if (ownImages && (v.startsWith('storage:') || sameOrigin(v))) return true;
    return checkMediaUrl(v, media, kinds).ok;
  };
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'span',
      'ul', 'ol', 'li', 'blockquote', 'hr', 'a', 'figure', 'figcaption', 'img', 'div', 'iframe', 'cite', 'footer', 'video', 'audio', 'source', 'track',
    ],
    allowedAttributes: {
      '*': ['style', 'data-align', 'data-variant', 'data-width'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
      video: ['controls', 'preload', 'playsinline', 'poster', 'crossorigin', 'aria-label', 'width', 'height'],
      audio: ['controls', 'preload', 'aria-label'],
      source: ['src', 'type'],
      track: ['src', 'kind', 'srclang', 'label'],
      iframe: ['src', 'width', 'height', 'allowfullscreen', 'allow', 'frameborder', 'sandbox', 'referrerpolicy', 'loading'],
      figure: ['data-type', 'data-align', 'data-variant', 'data-width', 'class', 'style'],
      figcaption: ['class'],
      span: ['class', 'style'],
      div: ['data-youtube-video'],
      mark: ['data-color', 'style'],
    },
    // Only the editor's own classes: arbitrary site classes (e.g. full-screen overlays) are dropped.
    allowedClasses: { figure: ['article-figure', 'pull-quote', 'media-figure'], figcaption: ['pq-role', 'pq-source'], span: ['pq-role', 'pq-source', 'media-credit'] },
    allowedStyles: { '*': styleProps },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { img: ['https', 'storage'], iframe: ['https'], source: ['https'], track: ['https'] },
    allowProtocolRelative: false,
    allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'],
    // Anything that is not our own image/media is removed instead of being passed to visitors' browsers.
    exclusiveFilter: (frame) => {
      const a = frame.attribs;
      if (frame.tag === 'img') return !allowed(a['src'], ['image'], true);
      if (frame.tag === 'source') return !allowed(a['src'], ['video', 'audio']);
      if (frame.tag === 'track') return !allowed(a['src'], ['captions']);
      return false;
    },
    transformTags: {
      video: (tagName, attribs) => {
        const next = { ...attribs, controls: 'controls', preload: 'metadata', playsinline: 'playsinline' };
        if (next['poster'] && !allowed(next['poster'], ['image'], true)) delete next['poster'];
        return { tagName, attribs: next };
      },
      audio: (tagName, attribs) => ({ tagName, attribs: { ...attribs, controls: 'controls', preload: 'metadata' } }),
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }),
      // Embedded players may not reach the page, forms or pop-ups.
      iframe: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups', referrerpolicy: 'strict-origin-when-cross-origin', loading: 'lazy' },
      }),
    },
  });
}
