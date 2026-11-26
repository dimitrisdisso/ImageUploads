// Shared server-only helpers: Cloudflare bindings, D1 queries, crypto, cookies, rate limits.
import { env, waitUntil } from "cloudflare:workers";
import { PublicError } from "@/lib/public-error";

export { PublicError } from "@/lib/public-error";

export function appEnv(): AppEnv {
  return env;
}

/**
 * Finish work (e.g. sending an email) after the response is sent. Responses then take the same
 * time whether or not an email went out, so timing does not reveal which addresses have accounts.
 */
export function background(task: () => Promise<unknown>): void {
  waitUntil(task().catch((error) => console.error(error)));
}

export function db(): D1Database {
  if (!env.DB) throw new Error("Database binding DB is not configured");
  return env.DB;
}

export function bucket(): R2Bucket {
  if (!env.MEDIA) throw new Error("R2 binding MEDIA is not configured");
  return env.MEDIA;
}

export const nowIso = () => new Date().toISOString();

export async function all<T>(sql: string, ...args: unknown[]): Promise<T[]> {
  const { results } = await db().prepare(sql).bind(...args).all<T>();
  return results ?? [];
}

export function first<T>(sql: string, ...args: unknown[]): Promise<T | null> {
  return db().prepare(sql).bind(...args).first<T>();
}

export async function run(sql: string, ...args: unknown[]): Promise<number> {
  const result = await db().prepare(sql).bind(...args).run();
  return result.meta?.changes ?? 0;
}

export function stmt(sql: string, ...args: unknown[]): D1PreparedStatement {
  return db().prepare(sql).bind(...args);
}

/** Parse the JSON `data` column of a row. */
export function withData<T extends { data: string | unknown }>(row: T): Omit<T, "data"> & { data: Record<string, any> } {
  let data: Record<string, any> = {};
  if (typeof row.data === "string") {
    try {
      data = JSON.parse(row.data) ?? {};
    } catch {
      data = {};
    }
  } else if (row.data && typeof row.data === "object") data = row.data as Record<string, any>;
  return { ...row, data };
}

// ---------------------------------------------------------------- crypto

const encoder = new TextEncoder();

export function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of array) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64url(value: string): Uint8Array<ArrayBuffer> {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(value: string): Promise<string> {
  return base64url(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Cloudflare Workers allow at most 100,000 PBKDF2 iterations.
const PBKDF2_ITERATIONS = 100_000;

async function pbkdf2(password: string, salt: BufferSource, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return base64url(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITERATIONS}$${base64url(salt)}$${await pbkdf2(password, salt, PBKDF2_ITERATIONS)}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [scheme, iterations, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterations || !salt || !hash) return false;
  return safeEqual(await pbkdf2(password, fromBase64url(salt), Number(iterations)), hash);
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (at least 32 characters)");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function hmac(value: string): Promise<string> {
  return base64url(await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(value)));
}

// ---------------------------------------------------------------- cookies

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function serializeCookie(name: string, value: string, maxAgeSeconds: number, path = "/"): string {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error("Invalid cookie name");
  return `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

// ---------------------------------------------------------------- request helpers

export function clientIp(request: Request): string {
  // Set by Cloudflare and not spoofable by the visitor (unlike X-Forwarded-For).
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

/**
 * Base URL used in emailed links and the Google redirect. Set APP_URL in production so these
 * never depend on the incoming Host header.
 */
export function publicOrigin(request: Request): string {
  const configured = env.APP_URL?.trim();
  if (configured && !configured.includes("YOUR-DOMAIN")) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.hostname === "localhost") return url.origin;
    } catch {
      /* fall through */
    }
  }
  return new URL(request.url).origin;
}

/**
 * Reject cross-site posts to API routes (server functions have their own CSRF check).
 * With `strict`, a request must positively prove it is same-origin.
 */
export function sameOrigin(request: Request, strict = false): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    const site = request.headers.get("sec-fetch-site");
    return strict ? site === "same-origin" : site !== "cross-site";
  }
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- rate limiting

/** True when fewer than `max` events were recorded for `key` in the window (does not record). */
export async function underLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const row = await first<{ n: number }>("SELECT count(*) AS n FROM rate_limits WHERE key = ? AND at > ?", key, since);
  return (row?.n ?? 0) < max;
}

/** Records one event for `key` (e.g. a failed login). */
export async function recordHit(key: string): Promise<void> {
  await db().batch([
    stmt("INSERT INTO rate_limits (key, at) VALUES (?, ?)", key, nowIso()),
    // Opportunistic cleanup of entries older than a day.
    stmt("DELETE FROM rate_limits WHERE at < ?", new Date(Date.now() - 86_400_000).toISOString()),
  ]);
}

/** Returns true when the action is allowed (and records it). */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  if (!(await underLimit(key, max, windowSeconds))) return false;
  await recordHit(key);
  return true;
}

/** Reject request bodies larger than `maxBytes` before reading them. */
export function bodyTooLarge(request: Request, maxBytes: number): boolean {
  const length = Number(request.headers.get("content-length") ?? "NaN");
  return !Number.isFinite(length) || length > maxBytes;
}

/** Identify an uploaded image from its first bytes; never trust the browser's file type. */
export async function sniffImage(file: Blob): Promise<{ mime: string; ext: string } | null> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return { mime: "image/png", ext: "png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (ascii(0, 4) === "GIF8") return { mime: "image/gif", ext: "gif" };
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return { mime: "image/avif", ext: "avif" };
  return null;
}

