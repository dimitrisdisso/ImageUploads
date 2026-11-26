// Publishes editor uploads (photos, short video, audio, subtitles) to the public GitHub media
// repository, so editors never have to use GitHub themselves. The file is committed through the
// GitHub API and the returned jsDelivr URL points at that exact commit: it can never change.
import { MAX_FILE_BYTES, type MediaFileKind, type MediaSource } from "@/lib/media-embed";
import { appEnv, PublicError, randomToken, sniffImage } from "./core.server";

const FOLDER: Record<MediaFileKind, string> = { image: "images", video: "video", audio: "audio", captions: "captions" };

export type SniffedMedia = { kind: MediaFileKind; ext: string };

/** Identify a file from its first bytes; the browser's file type and the file name are never trusted. */
export async function sniffMedia(file: Blob): Promise<SniffedMedia | null> {
  const image = await sniffImage(file);
  if (image) return { kind: "image", ext: image.ext };
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(4, 8) === "ftyp") return ascii(8, 12) === "M4A " ? { kind: "audio", ext: "m4a" } : { kind: "video", ext: "mp4" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: "video", ext: "webm" };
  if (ascii(0, 4) === "OggS") return { kind: "audio", ext: "ogg" };
  if (ascii(0, 3) === "ID3" || (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0)) return { kind: "audio", ext: "mp3" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return { kind: "audio", ext: "wav" };
  const head = new TextDecoder().decode(new Uint8Array(await file.slice(0, 8).arrayBuffer())).replace(/^﻿/, "");
  if (head.startsWith("WEBVTT") && file.size <= 1024 * 1024) return { kind: "captions", ext: "vtt" };
  return null;
}

const GREEK: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p",
  ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};

/** "Πλατεία Αριστοτέλους 2.jpg" -> "plateia-aristotelous-2" (Latin letters, digits and hyphens only). */
export function slugifyFilename(name: string): string {
  const base = name.replace(/\.[^.]*$/, "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const slug = [...base.replace(/ου/g, "ou")].map((c) => GREEK[c] ?? c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return slug || "file";
}

/** images/2026/11/plateia-aristotelous-2-a1b2c3.jpg: a random suffix means nothing is ever overwritten. */
export function repoPathFor(sniffed: SniffedMedia, filename: string, now = new Date()): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const suffix = randomToken(4).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 6) || "x";
  return `${FOLDER[sniffed.kind]}/${yyyy}/${mm}/${slugifyFilename(filename)}-${suffix}.${sniffed.ext}`;
}

function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

export function githubUploadConfigured(): boolean {
  return Boolean(appEnv().GITHUB_TOKEN);
}

/** Commits the file to the configured repository and returns the permanent jsDelivr URL. */
export async function publishToGithub(source: MediaSource, path: string, file: Blob, message: string): Promise<{ url: string; path: string; sha: string }> {
  const token = appEnv().GITHUB_TOKEN;
  if (!token) throw new PublicError("Η αυτόματη μεταφόρτωση στο GitHub δεν έχει ρυθμιστεί (λείπει το GITHUB_TOKEN). Δείτε τον οδηγό πολυμέσων.");
  if (file.size > MAX_FILE_BYTES) throw new PublicError("Το αρχείο ξεπερνά τα 20 MB που σερβίρει το jsDelivr.");
  const branch = appEnv().GITHUB_MEDIA_BRANCH?.trim() || "main";
  const content = toBase64(new Uint8Array(await file.arrayBuffer()));
  let response: Response;
  try {
    response = await fetch(`https://api.github.com/repos/${source.user}/${source.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "epitropi-media-uploader",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, content, branch }),
    });
  } catch {
    throw new PublicError("Δεν ήταν δυνατή η επικοινωνία με το GitHub. Δοκιμάστε ξανά.");
  }
  if (!response.ok) {
    console.error("GitHub upload failed", response.status);
    if (response.status === 401) throw new PublicError("Το GITHUB_TOKEN δεν είναι έγκυρο ή έχει λήξει.");
    if (response.status === 403) throw new PublicError("Το GitHub αρνήθηκε την αποθήκευση (δικαιώματα του token ή όριο αιτημάτων).");
    if (response.status === 404) throw new PublicError("Δεν βρέθηκε το αποθετήριο ή το branch, ή το token δεν έχει πρόσβαση σε αυτό.");
    if (response.status === 409 || response.status === 422) throw new PublicError("Το GitHub δεν δέχτηκε το αρχείο. Δοκιμάστε ξανά.");
    throw new PublicError("Η μεταφόρτωση στο GitHub απέτυχε. Δοκιμάστε ξανά.");
  }
  const result = (await response.json().catch(() => null)) as { commit?: { sha?: string } } | null;
  const sha = result?.commit?.sha;
  if (!sha || !/^[0-9a-f]{40}$/i.test(sha)) throw new PublicError("Η μεταφόρτωση στο GitHub απέτυχε. Δοκιμάστε ξανά.");
  // Pinned to the commit: permanent caching and no 12-hour branch delay.
  return { url: `https://cdn.jsdelivr.net/gh/${source.user}/${source.repo}@${sha}/${path}`, path, sha };
}
