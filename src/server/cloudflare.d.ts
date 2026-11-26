// Minimal typings for the Cloudflare bindings this app uses (see wrangler.jsonc).
// Kept local so the browser DOM types and Workers types don't clash.

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: { changes?: number; last_row_id?: number };
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface R2ObjectBody {
  body: ReadableStream;
  httpMetadata?: { contentType?: string; cacheControl?: string };
  size: number;
}
interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | Blob | string,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
}

interface AppEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
  /** Long random string used to sign media links. */
  SESSION_SECRET?: string;
  /** Comma-separated emails that automatically become admins once signed in. */
  ADMIN_EMAILS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** "resend" or "brevo" */
  EMAIL_PROVIDER?: string;
  EMAIL_API_KEY?: string;
  /** e.g. "Επιτροπή Άνω Πόλης <no-reply@yourdomain.gr>" */
  EMAIL_FROM?: string;
  /** Optional public URL, e.g. https://yourdomain.gr (defaults to the request origin). */
  APP_URL?: string;
  /** GitHub fine-grained token with Contents: read/write on the media repository only. */
  GITHUB_TOKEN?: string;
  /** Branch that receives uploaded media (default "main"). */
  GITHUB_MEDIA_BRANCH?: string;
}

declare module "cloudflare:workers" {
  export const env: AppEnv;
  export function waitUntil(promise: Promise<unknown>): void;
}
