import { Node } from '@tiptap/core';
import { NodeSelection, type EditorState } from '@tiptap/pm/state';
import { mediaFigureHtml, type MediaKind } from '../../lib/media-embed';

/** Insert after a selected image/quote instead of replacing it. */
const insertPos = (state: EditorState) => (state.selection instanceof NodeSelection ? state.selection.to : null);

export type ImageAlign = 'center' | 'left' | 'right' | 'full';
export type QuoteVariant = 'pull' | 'wide';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    articleImage: {
      insertArticleImage: (attrs: { src: string; alt?: string; caption?: string; align?: ImageAlign; width?: number }) => ReturnType;
    };
    articleMedia: {
      insertArticleMedia: (attrs: { kind: 'video' | 'audio'; src: string; label: string; caption?: string; credit?: string; poster?: string; captions?: string }) => ReturnType;
    };
    pullQuote: {
      insertPullQuote: (attrs: { text: string; name?: string; role?: string; source?: string; variant?: QuoteVariant }) => ReturnType;
    };
  }
}

export const ArticleImage = Node.create({
  name: 'articleImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      caption: { default: '' },
      align: { default: 'center' },
      width: { default: 100 },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'figure[data-type="article-image"]',
        getAttrs: (el) => {
          const e = el as HTMLElement;
          const img = e.querySelector('img');
          return {
            src: img?.getAttribute('src') ?? '',
            alt: img?.getAttribute('alt') ?? '',
            caption: e.querySelector('figcaption')?.textContent ?? '',
            align: e.getAttribute('data-align') ?? 'center',
            width: Number(e.getAttribute('data-width') ?? 100),
          };
        },
      },
    ];
  },
  renderHTML({ node }) {
    const { src, alt, caption, align, width } = node.attrs as { src: string; alt: string; caption: string; align: string; width: number };
    const figure: [string, Record<string, string>, ...unknown[]] = [
      'figure',
      { 'data-type': 'article-image', 'data-align': align, 'data-width': String(align === 'full' ? 100 : width), class: 'article-figure' },
      ['img', { src, alt: alt ?? '', loading: 'lazy' }],
    ];
    if (caption) figure.push(['figcaption', {}, caption]);
    return figure as never;
  },
  addCommands() {
    return {
      insertArticleImage:
        (attrs) =>
        ({ commands, state }) => {
          const content = { type: this.name, attrs: { align: 'center', width: 100, alt: '', caption: '', ...attrs } };
          const pos = insertPos(state);
          return pos == null ? commands.insertContent(content) : commands.insertContentAt(pos, content);
        },
    };
  },
});

export const PullQuote = Node.create({
  name: 'pullQuote',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { text: { default: '' }, name: { default: '' }, role: { default: '' }, source: { default: '' }, variant: { default: 'pull' } };
  },
  parseHTML() {
    return [
      {
        tag: 'figure[data-type="pull-quote"]',
        getAttrs: (el) => {
          const e = el as HTMLElement;
          return {
            text: e.querySelector('blockquote')?.textContent?.trim() ?? '',
            name: e.querySelector('cite')?.textContent ?? '',
            role: e.querySelector('.pq-role')?.textContent ?? '',
            source: e.querySelector('.pq-source')?.textContent ?? '',
            variant: e.getAttribute('data-variant') ?? 'pull',
          };
        },
      },
    ];
  },
  renderHTML({ node }) {
    const { text, name, role, source, variant } = node.attrs as Record<string, string>;
    const caption: unknown[] = ['figcaption', {}];
    if (name) caption.push(['cite', {}, name]);
    if (role) caption.push(['span', { class: 'pq-role' }, role]);
    if (source) caption.push(['span', { class: 'pq-source' }, source]);
    return [
      'figure',
      { 'data-type': 'pull-quote', 'data-variant': variant, class: 'pull-quote' },
      ['blockquote', {}, ['p', {}, text]],
      ...(caption.length > 2 ? [caption] : []),
    ] as never;
  },
  addCommands() {
    return {
      insertPullQuote:
        (attrs) =>
        ({ commands, state }) => {
          const content = { type: this.name, attrs: { variant: 'pull', ...attrs } };
          const pos = insertPos(state);
          return pos == null ? commands.insertContent(content) : commands.insertContentAt(pos, content);
        },
    };
  },
});

/** Video or audio hosted in the GitHub media repository (served through jsDelivr). */
export const ArticleMedia = Node.create({
  name: 'articleMedia',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { kind: { default: 'video' }, src: { default: '' }, label: { default: '' }, caption: { default: '' }, credit: { default: '' }, poster: { default: '' }, captions: { default: '' } };
  },
  parseHTML() {
    return ['video', 'audio'].map((kind) => ({
      tag: `figure[data-type="article-${kind}"]`,
      getAttrs: (el: HTMLElement | string) => {
        const e = el as HTMLElement;
        const media = e.querySelector(kind);
        const credit = e.querySelector('.media-credit')?.textContent ?? '';
        const full = e.querySelector('figcaption')?.textContent ?? '';
        return {
          kind,
          src: media?.querySelector('source')?.getAttribute('src') ?? media?.getAttribute('src') ?? '',
          label: media?.getAttribute('aria-label') ?? '',
          caption: credit ? full.replace(credit, '').trim() : full,
          credit: credit.replace(/^[^:]*:\s*/, ''),
          poster: media?.getAttribute('poster') ?? '',
          captions: media?.querySelector('track')?.getAttribute('src') ?? '',
        };
      },
    }));
  },
  renderHTML({ node }) {
    const a = node.attrs as Record<string, string>;
    const holder = document.createElement('div');
    holder.innerHTML = mediaFigureHtml({ kind: a['kind'] as MediaKind, src: a['src'] ?? '', label: a['label'] ?? '', caption: a['caption'], credit: a['credit'], poster: a['poster'], captions: a['captions'] });
    return holder.firstElementChild as never;
  },
  addCommands() {
    return {
      insertArticleMedia:
        (attrs) =>
        ({ commands, state }) => {
          const content = { type: this.name, attrs: { caption: '', credit: '', poster: '', captions: '', ...attrs } };
          const pos = insertPos(state);
          return pos == null ? commands.insertContent(content) : commands.insertContentAt(pos, content);
        },
    };
  },
});
