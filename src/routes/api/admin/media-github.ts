import { createFileRoute } from "@tanstack/react-router";
import { MAX_FILE_BYTES } from "@/lib/media-embed";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

// Admin upload of photos, video, audio and subtitles: committed to the public GitHub media
// repository and returned as a permanent jsDelivr URL (multipart form: file).
export const Route = createFileRoute("/api/admin/media-github")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { userFromRequest } = await import("@/server/auth.server");
        const { githubUploadConfigured } = await import("@/server/github-media.server");
        const user = await userFromRequest(request);
        if (!user?.isAdmin) return json({ error: "forbidden" }, 403);
        return json({ configured: githubUploadConfigured() });
      },
      POST: async ({ request }) => {
        const { bodyTooLarge, rateLimit, sameOrigin } = await import("@/server/core.server");
        const { userFromRequest } = await import("@/server/auth.server");
        const { currentMediaSource } = await import("@/server/site.server");
        const { publishToGithub, repoPathFor, sniffMedia } = await import("@/server/github-media.server");
        if (!sameOrigin(request, true)) return json({ error: "forbidden" }, 403);
        if (bodyTooLarge(request, MAX_FILE_BYTES + 64 * 1024)) return json({ error: "Το αρχείο ξεπερνά τα 20 MB." }, 413);
        const user = await userFromRequest(request);
        if (!user?.isAdmin) return json({ error: "forbidden" }, 403);
        if (!(await rateLimit(`github-media:${user.id}`, 40, 3600))) return json({ error: "Πολλές μεταφορτώσεις. Δοκιμάστε ξανά σε λίγο." }, 429);
        try {
          const source = await currentMediaSource();
          if (!source) return json({ error: "Ορίστε πρώτα το αποθετήριο στις Ρυθμίσεις → Πολυμέσα (GitHub + jsDelivr)." }, 400);
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File)) return json({ error: "Δεν επιλέχθηκε αρχείο." }, 400);
          if (file.size > MAX_FILE_BYTES) return json({ error: "Το αρχείο ξεπερνά τα 20 MB." }, 400);
          const sniffed = await sniffMedia(file);
          if (!sniffed) return json({ error: "Μη υποστηριζόμενος τύπος. Επιτρέπονται JPG, PNG, WebP, GIF, AVIF, MP4, WebM, MP3, M4A, OGG, WAV και .vtt." }, 400);
          const path = repoPathFor(sniffed, String(form.get("filename") ?? file.name ?? "file"));
          const result = await publishToGithub(source, path, file, `Add ${sniffed.kind}: ${path}`);
          return json({ url: result.url, path: result.path, kind: sniffed.kind, bytes: file.size });
        } catch (error) {
          const { PublicError } = await import("@/server/core.server");
          if (error instanceof PublicError) return json({ error: error.message }, 502);
          console.error(error);
          return json({ error: "Η μεταφόρτωση απέτυχε. Δοκιμάστε ξανά." }, 500);
        }
      },
    },
  },
});
