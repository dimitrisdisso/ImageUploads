import { createFileRoute } from "@tanstack/react-router";
import { safeReturnPath } from "@/lib/reader";

type GoogleClaims = { iss?: string; aud?: string; exp?: number; sub?: string; email?: string; email_verified?: boolean | string; name?: string };

// Google sends the reader back here; we exchange the code directly with Google, then sign them in.
export const Route = createFileRoute("/api/auth/google-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import("@/server/core.server");
        const auth = await import("@/server/auth.server");
        const env = core.appEnv();
        const url = new URL(request.url);
        const headers = new Headers({ "Cache-Control": "no-store" });
        headers.append("Set-Cookie", core.serializeCookie("g_oauth", "", 0, "/api/auth"));
        const [state, verifier, encodedRedirect] = (core.readCookie(request, "g_oauth") ?? "").split(".");
        let redirect = "/profile";
        try {
          if (encodedRedirect) redirect = safeReturnPath(new TextDecoder().decode(core.fromBase64url(encodedRedirect)));
        } catch {
          /* keep default */
        }
        const fail = () => {
          headers.set("Location", `/auth?mode=login&error=google&redirect=${encodeURIComponent(redirect)}`);
          return new Response(null, { status: 302, headers });
        };
        try {
          const code = url.searchParams.get("code");
          const returnedState = url.searchParams.get("state") ?? "";
          if (!code || !state || !verifier || !core.safeEqual(state, returnedState)) return fail();
          if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return fail();

          const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: env.GOOGLE_CLIENT_ID,
              client_secret: env.GOOGLE_CLIENT_SECRET,
              redirect_uri: `${core.publicOrigin(request)}/api/auth/google-callback`,
              grant_type: "authorization_code",
              code_verifier: verifier,
            }),
          });
          if (!tokenResponse.ok) {
            console.error("Google token exchange failed", tokenResponse.status, await tokenResponse.text());
            return fail();
          }
          const { id_token: idToken } = (await tokenResponse.json()) as { id_token?: string };
          const payload = idToken?.split(".")[1];
          if (!payload) return fail();
          // The ID token came straight from Google's token endpoint over TLS, authenticated with our
          // client secret, so its claims can be trusted without re-checking the signature.
          const claims = JSON.parse(new TextDecoder().decode(core.fromBase64url(payload))) as GoogleClaims;
          const verified = claims.email_verified === true || claims.email_verified === "true";
          if (
            !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss ?? "") ||
            claims.aud !== env.GOOGLE_CLIENT_ID ||
            !claims.exp || claims.exp * 1000 < Date.now() ||
            !claims.sub || !claims.email || !verified
          )
            return fail();

          const userId = await auth.upsertGoogleUser({ sub: claims.sub, email: claims.email.toLowerCase(), ...(claims.name ? { name: claims.name } : {}) });
          headers.append("Set-Cookie", auth.sessionCookie(await auth.createSession(userId)));
          headers.set("Location", redirect);
          return new Response(null, { status: 302, headers });
        } catch (error) {
          console.error(error);
          return fail();
        }
      },
    },
  },
});
