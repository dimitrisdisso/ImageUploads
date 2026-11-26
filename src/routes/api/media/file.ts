import { createFileRoute } from "@tanstack/react-router";

const SAFE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

// Private media (editor previews, reader-submitted photos) through expiring signed links.
export const Route = createFileRoute("/api/media/file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const headers = {
          "Cache-Control": "private, max-age=300",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        };
        const deny = () => new Response("Not found", { status: 404, headers });
        const params = new URL(request.url).searchParams;
        const key = params.get("key") ?? "";
        const exp = params.get("exp") ?? "";
        const sig = params.get("sig") ?? "";
        if (!/^(editorial|tips)\/[A-Za-z0-9._-]+$/.test(key)) return deny();
        try {
          const site = await import("@/server/site.server");
          const { bucket } = await import("@/server/core.server");
          if (!(await site.verifyMediaSignature(key, exp, sig))) return deny();
          const object = await bucket().get(key);
          if (!object) return deny();
          const type = object.httpMetadata?.contentType ?? "";
          // Anything that is not a plain raster image (e.g. older SVG uploads) is downloaded, never rendered.
          const typeHeaders = SAFE_IMAGE_TYPES.includes(type)
            ? { "Content-Type": type }
            : { "Content-Type": "application/octet-stream", "Content-Disposition": "attachment" };
          return new Response(object.body, { headers: { ...headers, ...typeHeaders } });
        } catch (error) {
          console.error(error);
          return deny();
        }
      },
    },
  },
});
