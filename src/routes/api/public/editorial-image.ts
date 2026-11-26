import { createFileRoute } from "@tanstack/react-router";

const SAFE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
import { validEditorialPath } from "@/lib/public-images";

// Public images: every request rechecks that the exact entry is published and uses this image,
// so withdrawing an article immediately stops serving its photos.
export const Route = createFileRoute("/api/public/editorial-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const headers = {
          "Cache-Control": "no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        };
        const deny = () => new Response("Image unavailable", { status: 404, headers });
        const params = new URL(request.url).searchParams;
        const article = params.get("article") ?? "";
        const path = params.get("path") ?? "";
        if (!article || article.length > 500 || !validEditorialPath(path)) return deny();
        try {
          const site = await import("@/server/site.server");
          const { bucket } = await import("@/server/core.server");
          if (!(await site.publishedEntryUsesImage(article, path))) return deny();
          const object = await bucket().get(site.editorialKey(path));
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
