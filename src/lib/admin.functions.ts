// Editorial (admin-only) server functions. Every handler checks the admin role on the server.
import { createServerFn } from "@tanstack/react-start";
import { guarded, PublicError } from "./public-error";
import { z } from "zod";

const id = z.string().min(1).max(200);

async function admin() {
  const { requireAdmin } = await import("@/server/session.server");
  return requireAdmin();
}

export const isAdmin = createServerFn({ method: "GET" }).handler(async () => guarded(async () => {
  const { currentUser } = await import("@/server/session.server");
  return Boolean((await currentUser())?.isAdmin);
}));

export const listContent = createServerFn({ method: "GET" }).handler(async () => guarded(async () => {
  await admin();
  const site = await import("@/server/site.server");
  return site.listContent();
}));

export const saveContent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id, kind: z.string().max(40), status: z.string().max(40), data: z.record(z.string(), z.any()) }).parse(d),
  )
  .handler(async ({ data }) => guarded(async () => {
    await admin();
    const site = await import("@/server/site.server");
    await site.saveContent(data);
    return { ok: true };
  }));

export const deleteContent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    await admin();
    const site = await import("@/server/site.server");
    await site.deleteContent(data.id);
    return { ok: true };
  }));

export const listMessages = createServerFn({ method: "GET" }).handler(async () => guarded(async () => {
  await admin();
  const site = await import("@/server/site.server");
  return site.listMessages();
}));

export const setMessageStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id, status: z.enum(["pending", "approved", "archived"]) }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    await admin();
    const site = await import("@/server/site.server");
    await site.setMessageStatus(data.id, data.status);
    return { ok: true };
  }));

export const deleteMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    await admin();
    const site = await import("@/server/site.server");
    await site.deleteMessage(data.id);
    return { ok: true };
  }));

export const getStats = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(0).max(3650) }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    await admin();
    const site = await import("@/server/site.server");
    return site.adminStats(data.days);
  }));

export const listAdmins = createServerFn({ method: "GET" }).handler(async () => guarded(async () => {
  await admin();
  const auth = await import("@/server/auth.server");
  return auth.listAdmins();
}));

export const grantAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().max(255) }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    await admin();
    const auth = await import("@/server/auth.server");
    await auth.grantAdmin(data.email);
    return { ok: true };
  }));

export const revokeAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ userId: id }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    const me = await admin();
    const auth = await import("@/server/auth.server");
    await auth.revokeAdmin(me.id, data.userId);
    return { ok: true };
  }));

export const listMedia = createServerFn({ method: "GET" }).handler(async () => guarded(async () => {
  await admin();
  const site = await import("@/server/site.server");
  const rows = await site.listMedia();
  const urls = await site.signEditorialPaths(rows.map((r) => r.path), 3600);
  return rows.map((r) => ({ ...r, url: urls[r.path] ?? "" }));
}));

export const updateMedia = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id, alt: z.string().max(1000), credit: z.string().max(500) }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    await admin();
    const site = await import("@/server/site.server");
    await site.updateMedia(data.id, data.alt, data.credit);
    return { ok: true };
  }));

export const deleteMedia = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    await admin();
    const site = await import("@/server/site.server");
    await site.deleteMedia(data.id);
    return { ok: true };
  }));

/** Short-lived links to private editorial images, for previews inside the editor. */
export const signMediaPaths = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ paths: z.array(z.string().max(1024)).max(500), seconds: z.number().int().min(60).max(7 * 86400) }).parse(d),
  )
  .handler(async ({ data }) => guarded(async () => {
    await admin();
    const site = await import("@/server/site.server");
    return site.signEditorialPaths(data.paths, data.seconds);
  }));
