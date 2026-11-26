// Publication data in D1 and media in R2. These functions hold the rules that used to live in
// database policies and triggers, so every write is validated on the server.
import type { ContentBundle } from "@/lib/cms";
import { bundledImages } from "@/lib/cms";
import type { Article, Author, Event } from "@/lib/content";
import { replaceStorageRefs, storagePaths } from "@/lib/article-html";
import { sanitizeArticleHtml } from "@/lib/sanitize-article";
import type { PublicationCategory } from "@/lib/editorial";
import { publicImageUrl, validEditorialPath } from "@/lib/public-images";
import { resolveSettings } from "@/lib/site-settings";
import { auditMediaField, auditMediaHtml, mediaSourceFromSettings, validateMediaSettings, type MediaSource } from "@/lib/media-embed";
import { all, appEnv, bucket, db, first, hmac, nowIso, PublicError, run, safeEqual, stmt, withData } from "./core.server";
import { actionEmail, sendMail } from "./mail.server";
import type { SessionUser } from "./auth.server";

type ContentRow = { id: string; kind: string; status: string; data: Record<string, any>; updated_at: string };
type MessageRow = { id: string; kind: string; status: string; data: Record<string, any>; user_id: string | null; created_at: string };

const CONTENT_KINDS = ["post", "author", "event", "announcement", "settings", "category"] as const;
const MAX_DATA_BYTES = 900_000;

// ---------------------------------------------------------------- public bundle

// Short per-instance cache so a flood of page views doesn't re-read and re-sanitize everything
// on each request. Editor saves clear it immediately on the instance that handled the save.
const BUNDLE_TTL_MS = 15_000;
let bundleCache: { origin: string; at: number; bundle: ContentBundle } | null = null;

export async function loadPublicBundle(origin: string): Promise<ContentBundle> {
  if (bundleCache && bundleCache.origin === origin && Date.now() - bundleCache.at < BUNDLE_TTL_MS) {
    return structuredClone(bundleCache.bundle);
  }
  const bundle = await buildPublicBundle(origin);
  bundleCache = { origin, at: Date.now(), bundle };
  return structuredClone(bundle);
}

async function buildPublicBundle(origin: string): Promise<ContentBundle> {
  const rows = (await all<{ id: string; kind: string; data: string }>(
    "SELECT id, kind, data FROM cms_content WHERE status = 'published'",
  )).map(withData);
  const settingsRow = rows.find((r) => r.kind === "settings");
  const media = mediaSourceFromSettings(resolveSettings((settingsRow?.data ?? {}) as Record<string, string>));
  const bundle: ContentBundle = { articles: [], authors: {}, events: [], announcements: [], settings: {}, categories: [] };
  for (const row of rows) {
    if (["post", "event", "announcement", "author"].includes(row.kind)) {
      const a = row.data as Article & Event;
      const paths = [...(a.image?.startsWith("storage:") ? [a.image.slice(8)] : []), ...(a.html ? storagePaths(a.html) : [])];
      const urls: Record<string, string> = {};
      for (const path of paths) if (validEditorialPath(path)) urls[path] = new URL(publicImageUrl(row.id, path), origin).href;
      if (a.image?.startsWith("storage:")) a.image = urls[a.image.slice(8)] ?? "";
      else if (a.image) {
        const image = bundledImages[a.image] ?? a.image;
        if (image.startsWith("/")) a.image = new URL(image, origin).href;
        // Remote cover images are only accepted from the configured GitHub repository via jsDelivr.
        else if (auditMediaField(image, media)) a.image = "";
      }
      if (a.html) a.html = sanitizeArticleHtml(replaceStorageRefs(a.html, urls), { origin, media });
      if (row.kind === "post") bundle.articles.push(a);
      else if (row.kind === "event") bundle.events.push({ ...a, id: row.id });
      else if (row.kind === "announcement")
        bundle.announcements.push({
          ...a,
          id: row.id,
          title: a.title || row.data["text"] || "",
          slug: a.slug || row.id,
          subtitle: a.subtitle || "",
          date: a.date || "",
          body: a.body || [],
        });
      else bundle.authors[row.id] = a as unknown as Author;
    }
    if (row.kind === "category") bundle.categories?.push(row.data as PublicationCategory);
    if (row.kind === "settings") {
      // Internal settings (e.g. where subscriber alerts go) are never sent to visitors.
      const { newsletterAdminEmail: _private, ...publicSettings } = row.data;
      bundle.settings = publicSettings;
    }
  }
  bundle.articles.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  bundle.announcements.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return bundle;
}

/** True when a published entry references this editorial image (gate for public image requests). */
export async function publishedEntryUsesImage(entryId: string, path: string): Promise<boolean> {
  const row = await first<{ data: string }>(
    "SELECT data FROM cms_content WHERE id = ? AND status = 'published' AND kind IN ('post','event','announcement','author')",
    entryId,
  );
  if (!row) return false;
  const data = withData(row).data;
  return data["image"] === `storage:${path}` || storagePaths(String(data["html"] ?? "")).includes(path);
}

// ---------------------------------------------------------------- editorial content

const blank = (v: unknown) => String(v ?? "").trim() === "";
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The media repository currently configured in the site settings (null when not set up). */
export async function currentMediaSource(): Promise<MediaSource | null> {
  const row = await first<{ data: string }>("SELECT data FROM cms_content WHERE kind = 'settings' AND status = 'published' LIMIT 1");
  return mediaSourceFromSettings(resolveSettings(row ? (withData(row).data as Record<string, string>) : {}));
}

/** Images, video and audio in an entry must come from our storage or our GitHub repository. */
async function assertMediaAllowed(data: Record<string, any>) {
  const source = await currentMediaSource();
  const problems: string[] = [];
  if (typeof data["html"] === "string") problems.push(...auditMediaHtml(data["html"], source));
  for (const key of ["image", "photo"]) {
    if (typeof data[key] === "string") {
      const problem = auditMediaField(data[key], source);
      if (problem) problems.push(problem);
    }
  }
  if (problems.length) throw new PublicError(`Πολυμέσα που δεν επιτρέπονται: ${problems[0]}`);
}

async function validateContent(id: string, kind: string, status: string, data: Record<string, any>) {
  if (!(CONTENT_KINDS as readonly string[]).includes(kind)) throw new PublicError("Unknown content kind");
  if (!["draft", "published"].includes(status)) throw new PublicError("Invalid status");
  if (JSON.stringify(data).length > MAX_DATA_BYTES) throw new PublicError("Το περιεχόμενο είναι πολύ μεγάλο.");
  const published = status === "published";
  if (["post", "announcement", "event", "author"].includes(kind)) await assertMediaAllowed(data);
  if (kind === "settings") {
    const problem = validateMediaSettings(data as Record<string, string>);
    if (problem) throw new PublicError(problem);
  }
  const slug = String(data["slug"] ?? "");
  const slugTaken = async () =>
    Boolean(await first("SELECT 1 FROM cms_content WHERE kind = ? AND id <> ? AND json_extract(data, '$.slug') = ?", kind, id, slug));

  if (kind === "post" || kind === "announcement") {
    const html = String(data["html"] ?? "");
    const hasText = html.replace(/<[^>]*>/g, "").trim() !== "" || (Array.isArray(data["body"]) && data["body"].length > 0) || html.includes("<img");
    if (published && (blank(data["slug"]) || blank(data["title"]) || blank(data["date"]) || !hasText))
      throw new PublicError("Publishing requires title, slug, date and content");
    if (slug && (await slugTaken())) throw new PublicError("Duplicate slug");
  } else if (kind === "event" && published) {
    if (["title", "date", "time", "place", "type"].some((k) => blank(data[k])))
      throw new PublicError("Publishing an event requires title, date, time, place and type");
  } else if (kind === "author" && published && blank(data["name"])) {
    throw new PublicError("Writer name is required");
  } else if (kind === "category" && published) {
    if (blank(data["name"]) || !SLUG.test(slug)) throw new PublicError("Category needs a name and valid slug");
    if (await slugTaken()) throw new PublicError("Duplicate category");
  }
}

export async function listContent(): Promise<ContentRow[]> {
  return (await all<ContentRow & { data: string }>("SELECT * FROM cms_content ORDER BY updated_at DESC")).map(withData) as ContentRow[];
}

export async function saveContent(input: { id: string; kind: string; status: string; data: Record<string, any> }) {
  await validateContent(input.id, input.kind, input.status, input.data);
  await run(
    `INSERT INTO cms_content (id, kind, status, data, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, status = excluded.status, data = excluded.data, updated_at = excluded.updated_at`,
    input.id,
    input.kind,
    input.status,
    JSON.stringify(input.data),
    nowIso(),
  );
  bundleCache = null;
}

export async function deleteContent(id: string) {
  await run("DELETE FROM cms_content WHERE id = ?", id);
  bundleCache = null;
}

// ---------------------------------------------------------------- reader messages (admin)

export async function listMessages(): Promise<MessageRow[]> {
  const rows = (await all<MessageRow & { data: string }>("SELECT * FROM reader_messages ORDER BY created_at DESC")).map(withData) as MessageRow[];
  // Reader photos live in private storage: hand admins short-lived links.
  for (const row of rows) {
    const photos = row.data["photos"];
    // Only our own signed links are handed to the admin page; anything else is dropped.
    row.data["photos"] = Array.isArray(photos)
      ? await Promise.all(
          photos
            .filter((p: unknown): p is string => typeof p === "string" && /^tips\/[A-Za-z0-9._-]+$/.test(p))
            .map((p) => signedMediaUrl(p, 3600)),
        )
      : [];
  }
  return rows;
}

export async function setMessageStatus(id: string, status: string) {
  if (!["pending", "approved", "archived"].includes(status)) throw new PublicError("Invalid status");
  await run("UPDATE reader_messages SET status = ? WHERE id = ?", status, id);
}

export async function deleteMessage(id: string) {
  const row = await first<{ data: string }>("SELECT data FROM reader_messages WHERE id = ?", id);
  if (!row) return;
  const photos = withData(row).data["photos"];
  const keys = Array.isArray(photos) ? photos.filter((p): p is string => typeof p === "string" && p.startsWith("tips/")) : [];
  if (keys.length) await bucket().delete(keys);
  await run("DELETE FROM reader_messages WHERE id = ?", id);
}

// ---------------------------------------------------------------- comments

/** Other readers' account ids are never revealed; only the viewer's own id is returned. */
function commentRow(row: MessageRow, viewerId: string | null) {
  return {
    id: row.id,
    user_id: viewerId && row.user_id === viewerId ? viewerId : null,
    created_at: row.created_at,
    status: row.status,
    data: { article: row.data["article"], text: row.data["text"], name: row.data["name"] },
  };
}

export async function listArticleComments(slug: string, userId: string | null) {
  const rows = (await all<MessageRow & { data: string }>(
    `SELECT id, user_id, data, status, created_at, kind FROM reader_messages
      WHERE kind = 'comment' AND json_extract(data, '$.article') = ? AND (status = 'approved' OR user_id = ?)
      ORDER BY created_at ASC`,
    slug,
    userId ?? "",
  )).map(withData) as MessageRow[];
  return rows.map((row) => commentRow(row, userId));
}

export async function listUserComments(userId: string) {
  const rows = (await all<MessageRow & { data: string }>(
    "SELECT id, user_id, data, status, created_at, kind FROM reader_messages WHERE kind = 'comment' AND user_id = ? ORDER BY created_at DESC",
    userId,
  )).map(withData) as MessageRow[];
  return rows.map((row) => commentRow(row, userId));
}

async function assertCommentable(slug: string) {
  const post = await first<{ data: string }>(
    "SELECT data FROM cms_content WHERE kind = 'post' AND status = 'published' AND json_extract(data, '$.slug') = ?",
    slug,
  );
  if (!post) throw new PublicError("Το άρθρο δεν είναι διαθέσιμο.");
  const enabled = withData(post).data["commentsEnabled"];
  if (enabled === false || enabled === "false") throw new PublicError("Comments are disabled for this article");
}

function cleanComment(text: string) {
  const trimmed = text.trim();
  if (trimmed.length < 1 || trimmed.length > 1500) throw new PublicError("Το σχόλιο πρέπει να έχει από 1 έως 1500 χαρακτήρες.");
  return trimmed;
}

export async function addComment(user: SessionUser, slug: string, text: string) {
  const body = cleanComment(text);
  await assertCommentable(slug);
  const recent = await first(
    "SELECT 1 FROM reader_messages WHERE kind = 'comment' AND user_id = ? AND created_at > ?",
    user.id,
    new Date(Date.now() - 30_000).toISOString(),
  );
  if (recent) throw new PublicError("Περιμένετε 30 δευτερόλεπτα πριν στείλετε νέο σχόλιο.");
  await run(
    "INSERT INTO reader_messages (id, kind, status, data, user_id, created_at) VALUES (?, 'comment', 'approved', ?, ?, ?)",
    crypto.randomUUID(),
    JSON.stringify({ article: slug, text: body, name: user.name || "Αναγνώστης" }),
    user.id,
    nowIso(),
  );
}

export async function editComment(user: SessionUser, id: string, text: string) {
  const body = cleanComment(text);
  const row = await first<{ data: string }>("SELECT data FROM reader_messages WHERE id = ? AND kind = 'comment' AND user_id = ?", id, user.id);
  if (!row) throw new PublicError("Not allowed");
  const article = String(withData(row).data["article"] ?? "");
  await assertCommentable(article);
  await run(
    "UPDATE reader_messages SET data = ?, status = 'approved' WHERE id = ? AND user_id = ?",
    JSON.stringify({ article, text: body, name: user.name || "Αναγνώστης" }),
    id,
    user.id,
  );
}

export async function deleteComment(user: SessionUser, id: string) {
  const changed = user.isAdmin
    ? await run("DELETE FROM reader_messages WHERE id = ? AND kind = 'comment'", id)
    : await run("DELETE FROM reader_messages WHERE id = ? AND kind = 'comment' AND user_id = ?", id, user.id);
  if (!changed) throw new PublicError("Not allowed");
}

// ---------------------------------------------------------------- newsletter + tips

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribe(origin: string, emailInput: string, consent: boolean) {
  const email = emailInput.trim().toLowerCase();
  if (!consent || !EMAIL.test(email) || email.length > 255) throw new PublicError("Email and explicit consent are required");
  const now = nowIso();
  const already = await first(
    "SELECT 1 FROM reader_messages WHERE kind = 'subscription' AND status <> 'archived' AND json_extract(data, '$.email') = ?",
    email,
  );
  if (already) return; // same response either way: no way to probe who is subscribed
  await run(
    "INSERT INTO reader_messages (id, kind, status, data, created_at) VALUES (?, 'subscription', 'pending', ?, ?)",
    crypto.randomUUID(),
    JSON.stringify({ email, consent: true, consentAt: now, consentVersion: "newsletter-v1" }),
    now,
  );
  // Notify the address set in Settings → «Email ειδοποιήσεων συνδρομητών», if any.
  try {
    const row = await first<{ data: string }>("SELECT data FROM cms_content WHERE kind = 'settings' LIMIT 1");
    const settings = resolveSettings(row ? (withData(row).data as Record<string, string>) : {});
    const notify = settings["newsletterAdminEmail"]?.trim();
    if (notify && EMAIL.test(notify)) {
      const site = settings["companyName"] ?? "";
      const body = actionEmail({
        site,
        heading: "Νέος συνδρομητής",
        intro: `Το ${email} εγγράφηκε στο ενημερωτικό δελτίο.`,
        action: "Άνοιγμα γραφείου σύνταξης",
        url: `${origin}/admin`,
        footer: "Μπορείτε να εξαγάγετε τη λίστα από την καρτέλα «Συνδρομητές».",
      });
      await sendMail({ to: notify, subject: `${site}: νέος συνδρομητής`, ...body });
    }
  } catch (error) {
    console.error(error);
  }
}

export async function insertTip(data: Record<string, unknown>) {
  await run(
    "INSERT INTO reader_messages (id, kind, status, data, created_at) VALUES (?, 'tip', 'pending', ?, ?)",
    crypto.randomUUID(),
    JSON.stringify(data),
    nowIso(),
  );
}

// ---------------------------------------------------------------- reader library

export async function getProfileName(userId: string) {
  return (await first<{ name: string }>("SELECT name FROM users WHERE id = ?", userId))?.name ?? "Αναγνώστης";
}

export async function setProfileName(userId: string, name: string) {
  await run("UPDATE users SET name = ? WHERE id = ?", name.trim().slice(0, 80), userId);
}

export async function getLibrary(userId: string) {
  const [saved, liked] = await Promise.all([
    all<{ article_slug: string; created_at: string }>(
      "SELECT article_slug, created_at FROM saved_articles WHERE user_id = ? ORDER BY created_at DESC",
      userId,
    ),
    all<{ article_slug: string; created_at: string }>(
      "SELECT article_slug, created_at FROM article_likes WHERE user_id = ? ORDER BY created_at DESC",
      userId,
    ),
  ]);
  return { saved, liked };
}

export async function getActivity(userId: string, slug: string) {
  const [saved, liked] = await Promise.all([
    first("SELECT 1 FROM saved_articles WHERE user_id = ? AND article_slug = ?", userId, slug),
    first("SELECT 1 FROM article_likes WHERE user_id = ? AND article_slug = ?", userId, slug),
  ]);
  return { saved: Boolean(saved), liked: Boolean(liked) };
}

export async function setFlag(userId: string, slug: string, kind: "saved" | "liked", active: boolean) {
  const table = kind === "saved" ? "saved_articles" : "article_likes";
  if (active) {
    const exists = await first(
      "SELECT 1 FROM cms_content WHERE kind = 'post' AND status = 'published' AND json_extract(data, '$.slug') = ?",
      slug,
    );
    if (!exists) throw new PublicError("Το άρθρο δεν είναι διαθέσιμο.");
  }
  if (active) await run(`INSERT OR IGNORE INTO ${table} (user_id, article_slug, created_at) VALUES (?, ?, ?)`, userId, slug, nowIso());
  else await run(`DELETE FROM ${table} WHERE user_id = ? AND article_slug = ?`, userId, slug);
}

export async function likeCount(slug: string) {
  return (await first<{ n: number }>("SELECT count(*) AS n FROM article_likes WHERE article_slug = ?", slug))?.n ?? 0;
}

// ---------------------------------------------------------------- statistics

type Counts = { published: number; users: number; comments: number; likes: number; saves: number };

export async function adminStats(days: number) {
  const now = Date.now();
  const since = days > 0 ? new Date(now - days * 86_400_000).toISOString() : "0000";
  const prev = days > 0 ? new Date(now - days * 2 * 86_400_000).toISOString() : "0000";
  const count = async (sql: string, ...args: unknown[]) => (await first<{ n: number }>(sql, ...args))?.n ?? 0;

  const counts = async (from: string, to: string): Promise<Counts> => ({
    published: await count("SELECT count(*) AS n FROM cms_content WHERE kind='post' AND status='published' AND updated_at >= ? AND updated_at < ?", from, to),
    users: await count("SELECT count(*) AS n FROM users WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ?", from, to),
    comments: await count("SELECT count(*) AS n FROM reader_messages WHERE kind='comment' AND created_at >= ? AND created_at < ?", from, to),
    likes: await count("SELECT count(*) AS n FROM article_likes WHERE created_at >= ? AND created_at < ?", from, to),
    saves: await count("SELECT count(*) AS n FROM saved_articles WHERE created_at >= ? AND created_at < ?", from, to),
  });
  const far = "9999";
  const totals = {
    ...(await counts("0000", far)),
    drafts: await count("SELECT count(*) AS n FROM cms_content WHERE kind='post' AND status <> 'published'"),
  };
  const period = await counts(since, far);
  const previous = days > 0 ? await counts(prev, since) : { published: 0, users: 0, comments: 0, likes: 0, saves: 0 };

  const articles_series = await all<{ day: string; count: number }>(
    "SELECT substr(updated_at,1,10) AS day, count(*) AS count FROM cms_content WHERE kind='post' AND status='published' AND updated_at >= ? GROUP BY 1 ORDER BY 1",
    since,
  );
  const users_series = await all<{ day: string; count: number }>(
    "SELECT substr(created_at,1,10) AS day, count(*) AS count FROM users WHERE deleted_at IS NULL AND created_at >= ? GROUP BY 1 ORDER BY 1",
    since,
  );
  const top_articles = await all<{ slug: string; title: string; likes: number; saves: number; comments: number }>(
    `SELECT json_extract(p.data,'$.slug') AS slug, json_extract(p.data,'$.title') AS title,
            (SELECT count(*) FROM article_likes l WHERE l.article_slug = json_extract(p.data,'$.slug')) AS likes,
            (SELECT count(*) FROM saved_articles s WHERE s.article_slug = json_extract(p.data,'$.slug')) AS saves,
            (SELECT count(*) FROM reader_messages m WHERE m.kind='comment' AND json_extract(m.data,'$.article') = json_extract(p.data,'$.slug')) AS comments
       FROM cms_content p WHERE p.kind='post' AND p.status='published'
      ORDER BY likes DESC, saves DESC, comments DESC LIMIT 5`,
  );
  const recent_articles = await all<{ slug: string; title: string; date: string; status: string }>(
    `SELECT json_extract(data,'$.slug') AS slug, json_extract(data,'$.title') AS title,
            coalesce(json_extract(data,'$.date'),'') AS date, status
       FROM cms_content WHERE kind='post' ORDER BY updated_at DESC LIMIT 5`,
  );
  const activity = await all<{ type: string; at: string; article: string | null }>(
    `SELECT * FROM (
        SELECT 'comment' AS type, created_at AS at, json_extract(data,'$.article') AS article FROM reader_messages WHERE kind='comment'
        UNION ALL SELECT 'like', created_at, article_slug FROM article_likes
        UNION ALL SELECT 'save', created_at, article_slug FROM saved_articles
        UNION ALL SELECT 'signup', created_at, NULL FROM users WHERE deleted_at IS NULL
     ) ORDER BY at DESC LIMIT 10`,
  );
  const recent_activity = activity.map((a) => ({ type: a.type, at: a.at, ...(a.article ? { article: a.article } : {}) }));

  return { totals, period, previous, articles_series, users_series, top_articles, recent_articles, recent_activity };
}

// ---------------------------------------------------------------- media (R2)

export type MediaAssetRow = {
  id: string;
  path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  alt: string | null;
  credit: string | null;
  created_at: string;
};

export const editorialKey = (path: string) => `editorial/${path}`;

/** A link to a private R2 object that works until it expires (used for admin previews and reader photos). */
export async function signedMediaUrl(key: string, seconds: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + seconds;
  const sig = await hmac(`${key}:${exp}`);
  return `/api/media/file?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
}

export async function verifyMediaSignature(key: string, exp: string, sig: string): Promise<boolean> {
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires < Date.now() / 1000) return false;
  return safeEqual(await hmac(`${key}:${expires}`), sig);
}

export async function signEditorialPaths(paths: string[], seconds: number): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const path of [...new Set(paths)]) if (validEditorialPath(path)) out[path] = await signedMediaUrl(editorialKey(path), seconds);
  return out;
}

export async function listMedia(): Promise<MediaAssetRow[]> {
  return all<MediaAssetRow>("SELECT * FROM media_assets ORDER BY created_at DESC");
}

export async function createMediaAsset(input: {
  file: File;
  mime: string;
  ext: string;
  filename: string;
  alt: string;
  credit: string;
  width: number | null;
  height: number | null;
  userId: string;
}): Promise<MediaAssetRow> {
  const path = `${crypto.randomUUID()}.${input.ext}`;
  await bucket().put(editorialKey(path), await input.file.arrayBuffer(), {
    httpMetadata: { contentType: input.mime, cacheControl: "private, max-age=31536000, immutable" },
  });
  const id = crypto.randomUUID();
  try {
    await run(
      `INSERT INTO media_assets (id, path, filename, mime_type, size_bytes, width, height, alt, credit, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      path,
      input.filename.replace(/[\u0000-\u001f]/g, "").slice(0, 255) || "image",
      input.mime,
      input.file.size,
      input.width,
      input.height,
      input.alt || null,
      input.credit,
      input.userId,
      nowIso(),
    );
  } catch (error) {
    await bucket().delete(editorialKey(path));
    throw error;
  }
  const row = await first<MediaAssetRow>("SELECT * FROM media_assets WHERE id = ?", id);
  if (!row) throw new Error("Media row missing");
  return row;
}

export async function updateMedia(id: string, alt: string, credit: string) {
  if (!credit.trim()) throw new PublicError("Photo source or credit is required");
  await run("UPDATE media_assets SET alt = ?, credit = ? WHERE id = ?", alt.trim() || null, credit.trim(), id);
}

export async function deleteMedia(id: string) {
  const row = await first<{ path: string }>("SELECT path FROM media_assets WHERE id = ?", id);
  if (!row) return;
  await bucket().delete(editorialKey(row.path));
  await db().batch([stmt("DELETE FROM media_assets WHERE id = ?", id)]);
}

export function mediaConfigured() {
  return Boolean(appEnv().MEDIA);
}
