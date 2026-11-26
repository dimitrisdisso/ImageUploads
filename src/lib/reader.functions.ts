// Reader server functions: profile, saved/liked articles, comments and newsletter sign-up.
import { createServerFn } from "@tanstack/react-start";
import { guarded, PublicError } from "./public-error";
import { z } from "zod";
import { commentSchema, nameSchema } from "./reader";

const slugSchema = z.string().min(1).max(300);

export const getProfile = createServerFn({ method: "GET" }).handler(async () => guarded(async () => {
  const { requireUser } = await import("@/server/session.server");
  const site = await import("@/server/site.server");
  const user = await requireUser();
  return { name: await site.getProfileName(user.id) };
}));

export const updateProfileName = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ name: nameSchema }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    const { requireUser } = await import("@/server/session.server");
    const site = await import("@/server/site.server");
    const user = await requireUser();
    await site.setProfileName(user.id, data.name);
    return { ok: true };
  }));

export const getLibrary = createServerFn({ method: "GET" }).handler(async () => guarded(async () => {
  const { requireUser } = await import("@/server/session.server");
  const site = await import("@/server/site.server");
  return site.getLibrary((await requireUser()).id);
}));

export const getMyComments = createServerFn({ method: "GET" }).handler(async () => guarded(async () => {
  const { requireUser } = await import("@/server/session.server");
  const site = await import("@/server/site.server");
  return site.listUserComments((await requireUser()).id);
}));

export const getArticleActivity = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: slugSchema }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    const { currentUser } = await import("@/server/session.server");
    const site = await import("@/server/site.server");
    const user = await currentUser();
    return user ? site.getActivity(user.id, data.slug) : { saved: false, liked: false };
  }));

export const setArticleFlag = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: slugSchema, kind: z.enum(["saved", "liked"]), active: z.boolean() }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    const { requireUser } = await import("@/server/session.server");
    const site = await import("@/server/site.server");
    await site.setFlag((await requireUser()).id, data.slug, data.kind, data.active);
    return { ok: true };
  }));

export const getLikeCount = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: slugSchema }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    const site = await import("@/server/site.server");
    return site.likeCount(data.slug);
  }));

export const getArticleComments = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: slugSchema }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    const { currentUser } = await import("@/server/session.server");
    const site = await import("@/server/site.server");
    const user = await currentUser();
    return site.listArticleComments(data.slug, user?.id ?? null);
  }));

export const postComment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: slugSchema, text: commentSchema }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    const { requireUser } = await import("@/server/session.server");
    const site = await import("@/server/site.server");
    await site.addComment(await requireUser(), data.slug, data.text);
    return { ok: true };
  }));

export const updateComment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1).max(100), text: commentSchema }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    const { requireUser } = await import("@/server/session.server");
    const site = await import("@/server/site.server");
    await site.editComment(await requireUser(), data.id, data.text);
    return { ok: true };
  }));

export const removeComment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    const { requireUser } = await import("@/server/session.server");
    const site = await import("@/server/site.server");
    await site.deleteComment(await requireUser(), data.id);
    return { ok: true };
  }));

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().max(255), consent: z.literal(true) }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    const { request, requestOrigin } = await import("@/server/session.server");
    const { clientIp, rateLimit } = await import("@/server/core.server");
    const site = await import("@/server/site.server");
    if (!(await rateLimit(`subscribe:${clientIp(request())}`, 10, 3600))) throw new PublicError("over_request_rate_limit");
    await site.subscribe(requestOrigin(), data.email, data.consent);
    return { ok: true };
  }));
