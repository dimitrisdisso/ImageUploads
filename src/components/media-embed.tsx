import { useState, type ReactNode } from 'react';
import { buildMediaUrl, CREDIT_LABEL, mimeTypeOfPath, type MediaKind, type MediaSource } from '@/lib/media-embed';

/**
 * Reusable embeds for media hosted in the public GitHub repository and served by jsDelivr.
 * Use them in page templates; the article editor stores equivalent plain HTML (see mediaFigureHtml).
 *
 *   <MediaImage source={src} path="images/2026/11/plateia.jpg" alt="…" credit="Μαρία Κ." width={1600} height={1000} />
 *
 * `src` can be a full jsDelivr URL or, together with `source`, a path inside the repository.
 */
type Common = {
  /** Repository settings (use mediaSourceFromSettings(useSiteSettings())). Needed only with `path`. */
  source?: MediaSource | null;
  /** Path inside the repository, e.g. images/2026/11/plateia.jpg */
  path?: string;
  /** Or a full jsDelivr URL. */
  src?: string;
  caption?: ReactNode;
  /** Photographer / author / source. Shown under the media. */
  credit?: string;
  className?: string;
};

function resolveSrc({ source, path, src }: Pick<Common, 'source' | 'path' | 'src'>): string | null {
  try {
    if (src) return src;
    if (source && path) return buildMediaUrl(source, path);
  } catch {
    /* fall through */
  }
  return null;
}

function Caption({ caption, credit, kind }: { caption?: ReactNode; credit?: string | undefined; kind: MediaKind }) {
  if (!caption && !credit) return null;
  return (
    <figcaption className="mt-2 border-l-2 border-primary pl-3 font-sans text-sm leading-snug text-muted-foreground">
      {caption}
      {credit && <span className="block italic">{CREDIT_LABEL[kind]}: {credit}</span>}
    </figcaption>
  );
}

/** Responsive image with lazy loading, required alt text and a text fallback when the file cannot load. */
export function MediaImage(props: Common & { alt: string; width?: number; height?: number; priority?: boolean; sizes?: string }) {
  const url = resolveSrc(props);
  const [failed, setFailed] = useState(false);
  if (!url) return null;
  return (
    <figure className={props.className}>
      {failed ? (
        <p className="media-fallback border bg-muted p-4">
          Η εικόνα δεν είναι διαθέσιμη αυτή τη στιγμή{props.alt ? `: ${props.alt}` : ''}. <a className="underline" href={url} rel="noopener noreferrer">Άνοιγμα της εικόνας</a>
        </p>
      ) : (
        <img
          src={url}
          alt={props.alt}
          width={props.width}
          height={props.height}
          sizes={props.sizes ?? '(min-width: 1024px) 720px, 100vw'}
          loading={props.priority ? 'eager' : 'lazy'}
          decoding="async"
          {...(props.priority ? { fetchPriority: 'high' as const } : {})}
          className="block h-auto w-full"
          onError={() => setFailed(true)}
        />
      )}
      <Caption caption={props.caption} credit={props.credit} kind="image" />
    </figure>
  );
}

/** Video with controls, metadata-only preload (no autoplay), optional poster and Greek captions. */
export function MediaVideo(props: Common & { title: string; poster?: string; captionsSrc?: string }) {
  const url = resolveSrc(props);
  if (!url) return null;
  return (
    <figure className={props.className}>
      <video
        controls
        playsInline
        preload="metadata"
        poster={props.poster}
        aria-label={props.title}
        {...(props.captionsSrc ? { crossOrigin: 'anonymous' as const } : {})}
        className="block aspect-video h-auto w-full bg-black"
      >
        <source src={url} type={mimeTypeOfPath(url)} />
        {props.captionsSrc && <track kind="captions" src={props.captionsSrc} srcLang="el" label="Ελληνικά" />}
        <p>Το πρόγραμμα περιήγησής σας δεν μπορεί να αναπαράγει αυτό το βίντεο. <a href={url}>Άνοιγμα ή λήψη του βίντεο</a>.</p>
      </video>
      <Caption caption={props.caption} credit={props.credit} kind="video" />
    </figure>
  );
}

/** Audio player with controls, metadata-only preload and a download link as fallback. */
export function MediaAudio(props: Common & { title: string }) {
  const url = resolveSrc(props);
  if (!url) return null;
  return (
    <figure className={props.className}>
      <audio controls preload="metadata" aria-label={props.title} className="block w-full">
        <source src={url} type={mimeTypeOfPath(url)} />
        <p>Το πρόγραμμα περιήγησής σας δεν μπορεί να αναπαράγει αυτό το ηχητικό. <a href={url}>Άνοιγμα ή λήψη του ηχητικού</a>.</p>
      </audio>
      <Caption caption={props.caption} credit={props.credit} kind="audio" />
    </figure>
  );
}
