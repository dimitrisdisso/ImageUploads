// Session helpers for server functions (they run inside TanStack Start's request context).
import { deleteCookie, getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { createSession, destroySession, SESSION_COOKIE, SESSION_MAX_AGE, userFromToken, type SessionUser } from "./auth.server";
import { PublicError, publicOrigin } from "./core.server";

export function currentUser(): Promise<SessionUser | null> {
  return userFromToken(getCookie(SESSION_COOKIE));
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new PublicError("Συνδεθείτε για να συνεχίσετε.");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) throw new PublicError("Not allowed");
  return user;
}

export async function startSession(userId: string): Promise<void> {
  const token = await createSession(userId);
  setCookie(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE });
}

export async function endSession(): Promise<void> {
  await destroySession(getCookie(SESSION_COOKIE));
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

export function requestOrigin(): string {
  return publicOrigin(getRequest());
}

export function request(): Request {
  return getRequest();
}
