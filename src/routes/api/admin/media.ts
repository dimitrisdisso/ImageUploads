import { createFileRoute } from "@tanstack/react-router";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

// Admin image upload into the R2 bucket (multipart form: file, credit, alt, filename, width, height).
export const Route = createFileRoute("/api/admin/media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { bodyTooLarge, sameOrigin, sniffImage } = await import("@/server/core.server");
        const { userFromRequest } = await import("@/server/auth.server");
        const site = await import("@/server/site.server");
        if (!sameOrigin(request, true)) return json({ error: "forbidden" }, 403);
        if (bodyTooLarge(request, MAX_UPLOAD_BYTES + 64 * 1024)) return json({ error: "Η εικόνα ξεπερνά τα 10 MB." }, 413);
        const user = await userFromRequest(request);
        if (!user?.isAdmin) return json({ error: "forbidden" }, 403);
        try {
          const form = await request.formData();
          const file = form.get("file");
          const credit = String(form.get("credit") ?? "").trim();
          if (!(file instanceof File)) return json({ error: "Επιτρέπονται μόνο εικόνες." }, 400);
          if (file.size > MAX_UPLOAD_BYTES) return json({ error: "Η εικόνα ξεπερνά τα 10 MB." }, 400);
          const kind = await sniffImage(file);
          if (!kind) return json({ error: "Επιτρέπονται μόνο εικόνες JPG, PNG, WebP, GIF ή AVIF." }, 400);
          if (!credit) return json({ error: "Συμπληρώστε την πηγή / δημιουργό της φωτογραφίας." }, 400);
          const dim = (name: string) => {
            const n = Number(form.get(name));
            return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
          };
          const asset = await site.createMediaAsset({
            file,
            mime: kind.mime,
            ext: kind.ext,
            filename: String(form.get("filename") ?? file.name ?? "image"),
            alt: String(form.get("alt") ?? "").trim().slice(0, 1000),
            credit: credit.slice(0, 500),
            width: dim("width"),
            height: dim("height"),
            userId: user.id,
          });
          return json(asset);
        } catch (error) {
          console.error(error);
          return json({ error: "Η εικόνα δεν ανέβηκε. Δοκιμάστε ξανά." }, 500);
        }
      },
    },
  },
});
