import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Content Security Policy for pages. Scripts may only come from this site (TanStack's
// hydration data is inline, hence 'unsafe-inline'; article HTML is sanitized on the server).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://cdn.jsdelivr.net",
  "media-src 'self' blob: https://cdn.jsdelivr.net",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "connect-src 'self' https://cloudflareinsights.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

function withSecurityHeaders(request: Request, response: Response): Response {
  const secured = new Response(response.body, response);
  const h = secured.headers;
  const set = (name: string, value: string) => {
    if (!h.has(name)) h.set(name, value);
  };
  set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  set("X-Content-Type-Options", "nosniff");
  set("X-Frame-Options", "DENY");
  set("Referrer-Policy", "strict-origin-when-cross-origin");
  set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()");
  set("Cross-Origin-Opener-Policy", "same-origin");
  set("Cross-Origin-Resource-Policy", "same-origin");
  if (import.meta.env.PROD && (h.get("content-type") ?? "").includes("text/html")) {
    set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  }
  // Responses about a specific visitor (server functions, sign-in, uploads) are never cached.
  const path = new URL(request.url).pathname;
  if (path.startsWith("/_serverFn") || path.startsWith("/api/auth") || path.startsWith("/api/admin") || h.has("set-cookie")) {
    h.set("Cache-Control", "no-store");
  }
  return secured;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(
        request,
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
