import { createFileRoute } from "@tanstack/react-router";
import { safeReturnPath } from "@/lib/reader";

// Link from the signup email: creates the account, signs the reader in and continues to where they were.
export const Route = createFileRoute("/api/auth/verify")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await import("@/server/auth.server");
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        const redirect = safeReturnPath(url.searchParams.get("redirect"));
        const headers = new Headers({ "Cache-Control": "no-store" });
        try {
          const userId = token.length > 10 && token.length < 200 ? await auth.confirmSignup(token) : null;
          if (!userId) {
            headers.set("Location", `/auth?mode=login&error=link&redirect=${encodeURIComponent(redirect)}`);
            return new Response(null, { status: 302, headers });
          }
          headers.append("Set-Cookie", auth.sessionCookie(await auth.createSession(userId)));
          headers.set("Location", redirect);
          return new Response(null, { status: 302, headers });
        } catch (error) {
          console.error(error);
          headers.set("Location", `/auth?mode=login&error=link&redirect=${encodeURIComponent(redirect)}`);
          return new Response(null, { status: 302, headers });
        }
      },
    },
  },
});
