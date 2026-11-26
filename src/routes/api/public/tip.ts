import { createFileRoute } from "@tanstack/react-router";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const text = (form: FormData, name: string, max: number) => String(form.get(name) ?? "").trim().slice(0, max);

// Reader tips with up to 3 photos (≤ 1 MB each). Photos go to the private "tips/" folder in R2.
export const Route = createFileRoute("/api/public/tip")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { bodyTooLarge, bucket, clientIp, rateLimit, sameOrigin, sniffImage } = await import("@/server/core.server");
        const site = await import("@/server/site.server");
        if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
        // 3 photos × 1 MB plus the text fields; refuse bigger bodies before reading them.
        if (bodyTooLarge(request, 3_200_000)) return json({ error: "too_large" }, 413);
        try {
          if (!(await rateLimit(`tip:${clientIp(request)}`, 5, 600))) return json({ error: "rate_limited" }, 429);
          const form = await request.formData();
          const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
          const photoCredit = text(form, "photoCredit", 500);
          if (files.length > 3 || files.some((f) => f.size > 1_000_000)) return json({ error: "photos" }, 400);
          const kinds = await Promise.all(files.map((f) => sniffImage(f)));
          if (kinds.some((k) => !k)) return json({ error: "photos" }, 400);
          if (files.length && !photoCredit) return json({ error: "credit" }, 400);
          const subject = text(form, "subject", 150);
          const description = text(form, "description", 4000);
          if (!subject || !description) return json({ error: "required" }, 400);
          const photos: string[] = [];
          for (const [index, file] of files.entries()) {
            const kind = kinds[index]!;
            const key = `tips/${crypto.randomUUID()}.${kind.ext}`;
            await bucket().put(key, await file.arrayBuffer(), { httpMetadata: { contentType: kind.mime } });
            photos.push(key);
          }
          await site.insertTip({
            type: text(form, "type", 100),
            subject,
            description,
            name: text(form, "name", 80),
            email: text(form, "email", 255),
            anonymous: form.get("anonymous") === "on",
            photos,
            photoCredit,
          });
          return json({ ok: true });
        } catch (error) {
          console.error(error);
          return json({ error: "failed" }, 500);
        }
      },
    },
  },
});
