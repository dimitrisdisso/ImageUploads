// Account server functions. Server-only modules are imported inside handlers so they never
// reach the browser bundle.
import { createServerFn } from "@tanstack/react-start";
import { guarded, PublicError } from "./public-error";
import { z } from "zod";
import { emailSchema, passwordSchema, registrationSchema, safeReturnPath } from "./reader";

export type CurrentUser = { id: string; email: string; name: string; isAdmin: boolean };

async function guard(key: string, max: number, windowSeconds: number) {
  const { rateLimit } = await import("@/server/core.server");
  if (!(await rateLimit(key, max, windowSeconds))) throw new PublicError("over_request_rate_limit");
}

/** Two limits on email-sending actions per address: 1 per minute and 5 per hour. */
async function emailGuard(email: string) {
  const address = email.toLowerCase();
  await guard(`email:min:${address}`, 1, 60);
  await guard(`email:hour:${address}`, 5, 3600);
}

/**
 * Rejects passwords found in public breach lists (Have I Been Pwned, k-anonymity: only the first
 * 5 characters of the SHA-1 hash leave the server). If the service is unreachable, allow it.
 */
async function rejectBreachedPassword(password: string) {
  try {
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const response = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, { headers: { "Add-Padding": "true" } });
    if (!response.ok) return;
    const suffix = hex.slice(5);
    const found = (await response.text()).split("\n").some((line) => {
      const [hash, count] = line.trim().split(":");
      return hash === suffix && Number(count) > 0;
    });
    if (found) throw new PublicError("pwned_password");
  } catch (error) {
    if (error instanceof PublicError) throw error;
  }
}

async function ip() {
  const { request } = await import("@/server/session.server");
  const { clientIp } = await import("@/server/core.server");
  return clientIp(request());
}

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async (): Promise<CurrentUser | null> => guarded(async () => {
  const { currentUser } = await import("@/server/session.server");
  return currentUser();
}));

export const signUp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => registrationSchema.extend({ redirect: z.string().max(500) }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    const { requestOrigin } = await import("@/server/session.server");
    const auth = await import("@/server/auth.server");
    await guard(`signup:ip:${await ip()}`, 10, 3600);
    await emailGuard(data.email);
    await rejectBreachedPassword(data.password);
    const outcome = await auth.signUp({ ...data, origin: requestOrigin(), redirect: safeReturnPath(data.redirect) });
    return { outcome };
  }));

export const resendConfirmation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: emailSchema, redirect: z.string().max(500) }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    const { requestOrigin } = await import("@/server/session.server");
    const auth = await import("@/server/auth.server");
    await guard(`email:ip:${await ip()}`, 10, 3600);
    await emailGuard(data.email);
    await auth.resendSignup({ email: data.email, origin: requestOrigin(), redirect: safeReturnPath(data.redirect) });
    return { ok: true };
  }));

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: emailSchema, password: z.string().min(1).max(128) }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    const { startSession } = await import("@/server/session.server");
    const auth = await import("@/server/auth.server");
    const { recordHit, underLimit } = await import("@/server/core.server");
    // Only failed attempts count, so a correct password is never blocked by someone else's guessing
    // for long, while guessing is capped per address and per network.
    const ipKey = `login-fail:ip:${await ip()}`;
    const emailKey = `login-fail:${data.email.toLowerCase()}`;
    if (!(await underLimit(ipKey, 30, 900)) || !(await underLimit(emailKey, 10, 900))) throw new PublicError("over_request_rate_limit");
    let userId: string;
    try {
      userId = await auth.signIn(data.email, data.password);
    } catch (error) {
      if (error instanceof auth.AuthError) await Promise.all([recordHit(ipKey), recordHit(emailKey)]);
      throw error;
    }
    await startSession(userId);
    return { ok: true };
  }));

export const signOut = createServerFn({ method: "POST" }).handler(async () => guarded(async () => {
  const { endSession } = await import("@/server/session.server");
  await endSession();
  return { ok: true };
}));

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: emailSchema }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    const { requestOrigin } = await import("@/server/session.server");
    const auth = await import("@/server/auth.server");
    await guard(`email:ip:${await ip()}`, 10, 3600);
    await emailGuard(data.email);
    await auth.requestPasswordReset({ email: data.email, origin: requestOrigin() });
    return { ok: true };
  }));

export const resetPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10).max(200), password: passwordSchema }).parse(d))
  .handler(async ({ data }) => guarded(async () => {
    const { startSession } = await import("@/server/session.server");
    const auth = await import("@/server/auth.server");
    await guard(`reset:ip:${await ip()}`, 20, 3600);
    await rejectBreachedPassword(data.password);
    const userId = await auth.resetPassword(data.token, data.password);
    if (!userId) throw new PublicError("invalid_token");
    await startSession(userId);
    return { ok: true };
  }));

export const googleEnabled = createServerFn({ method: "GET" }).handler(async () => guarded(async () => {
  const { appEnv } = await import("@/server/core.server");
  const env = appEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}));
