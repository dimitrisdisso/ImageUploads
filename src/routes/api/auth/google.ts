import { createFileRoute } from "@tanstack/react-router";
import { safeReturnPath } from "@/lib/reader";

// Starts "Continue with Google" using your own Google Cloud OAuth client (authorization code + PKCE).
export const Route = createFileRoute("/api/auth/google")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import("@/server/core.server");
        const env = core.appEnv();
        const url = new URL(request.url);
        const redirect = safeReturnPath(url.searchParams.get("redirect"));
        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
          return Response.redirect(new URL(`/auth?mode=login&error=google&redirect=${encodeURIComponent(redirect)}`, url).href, 302);
        }
        const state = core.randomToken(24);
        const verifier = core.randomToken(48);
        const challenge = core.base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
        const callback = `${core.publicOrigin(request)}/api/auth/google-callback`;
        const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        google.search = new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          redirect_uri: callback,
          response_type: "code",
          scope: "openid email profile",
          state,
          code_challenge: challenge,
          code_challenge_method: "S256",
          prompt: "select_account",
        }).toString();
        const headers = new Headers({ Location: google.href, "Cache-Control": "no-store" });
        const cookieValue = [state, verifier, core.base64url(new TextEncoder().encode(redirect))].join(".");
        headers.append("Set-Cookie", core.serializeCookie("g_oauth", cookieValue, 600, "/api/auth"));
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
