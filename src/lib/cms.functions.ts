import { createServerFn } from "@tanstack/react-start";
import { guarded, PublicError } from "./public-error";
import type { ContentBundle } from "./cms";

/** Everything published, with image references turned into publication-checked public URLs. */
export const publicContent = createServerFn({ method: "GET" }).handler(async (): Promise<ContentBundle> => guarded(async () => {
  const { requestOrigin } = await import("@/server/session.server");
  const site = await import("@/server/site.server");
  return site.loadPublicBundle(requestOrigin());
}));
