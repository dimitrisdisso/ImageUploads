// Accounts and sessions stored in D1. Sessions are opaque random tokens in an HttpOnly cookie;
// only their SHA-256 hash is stored in the database.
import { resolveSettings } from "@/lib/site-settings";
import {
  PublicError,
  all,
  background,
  appEnv,
  db,
  first,
  hashPassword,
  nowIso,
  randomToken,
  readCookie,
  run,
  serializeCookie,
  sha256,
  stmt,
  verifyPassword,
  withData,
} from "./core.server";
import { actionEmail, sendMail } from "./mail.server";

// "__Host-" makes browsers refuse the cookie unless it is Secure, host-only and Path=/.
export const SESSION_COOKIE = "__Host-sid";
const SESSION_DAYS = 30;
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

export type SessionUser = { id: string; email: string; name: string; isAdmin: boolean };

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  google_sub: string | null;
  email_verified_at: string | null;
};

export class AuthError extends PublicError {
  constructor(public code: string) {
    super(code);
  }
}

// ---------------------------------------------------------------- sessions

export async function createSession(userId: string): Promise<string> {
  const token = randomToken();
  const now = Date.now();
  await run(
    "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    await sha256(token),
    userId,
    new Date(now).toISOString(),
    new Date(now + SESSION_MAX_AGE * 1000).toISOString(),
  );
  // Housekeeping: drop expired sessions.
  await run("DELETE FROM sessions WHERE expires_at < ?", new Date(now).toISOString());
  return token;
}

export function sessionCookie(token: string): string {
  return serializeCookie(SESSION_COOKIE, token, SESSION_MAX_AGE);
}

export function clearedSessionCookie(): string {
  return serializeCookie(SESSION_COOKIE, "", 0);
}

export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const row = await first<{ id: string; email: string; name: string; is_admin: number }>(
    `SELECT u.id, u.email, u.name,
            EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin') AS is_admin
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ? AND u.deleted_at IS NULL`,
    await sha256(token),
    nowIso(),
  );
  return row ? { id: row.id, email: row.email, name: row.name, isAdmin: Boolean(row.is_admin) } : null;
}

export function userFromRequest(request: Request): Promise<SessionUser | null> {
  return userFromToken(readCookie(request, SESSION_COOKIE));
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (token) await run("DELETE FROM sessions WHERE id = ?", await sha256(token));
}

// ---------------------------------------------------------------- users

function adminEmails(): string[] {
  return (appEnv().ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Emails listed in ADMIN_EMAILS become admins once they have a verified account. */
export async function ensureBootstrapAdmin(user: { id: string; email: string }): Promise<void> {
  if (adminEmails().includes(user.email.toLowerCase())) {
    await run("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'admin')", user.id);
  }
}

function findUserByEmail(email: string) {
  return first<UserRow>("SELECT * FROM users WHERE email = ? AND deleted_at IS NULL", email);
}

function cleanName(name: string | undefined | null): string {
  const trimmed = (name ?? "").trim().slice(0, 80);
  return trimmed || "Αναγνώστης";
}

async function insertUser(input: {
  email: string;
  name: string;
  passwordHash?: string | null;
  googleSub?: string | null;
}): Promise<UserRow> {
  const id = crypto.randomUUID();
  const now = nowIso();
  await run(
    "INSERT INTO users (id, email, name, password_hash, google_sub, email_verified_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    id,
    input.email.toLowerCase(),
    cleanName(input.name),
    input.passwordHash ?? null,
    input.googleSub ?? null,
    now,
    now,
  );
  const user = await first<UserRow>("SELECT * FROM users WHERE id = ?", id);
  if (!user) throw new Error("User was not created");
  await ensureBootstrapAdmin(user);
  return user;
}

async function siteName(): Promise<string> {
  const row = await first<{ data: string }>("SELECT data FROM cms_content WHERE kind = 'settings' LIMIT 1");
  const saved = row ? (withData(row).data as Record<string, string>) : {};
  return resolveSettings(saved)["companyName"] ?? "";
}

// ---------------------------------------------------------------- email + password

const SIGNUP_TOKEN_HOURS = 24;
const RESET_TOKEN_HOURS = 2;

async function issueToken(
  kind: "signup" | "reset",
  email: string,
  hours: number,
  extra: { userId?: string; payload?: unknown } = {},
): Promise<string> {
  const token = randomToken();
  const now = Date.now();
  await run(
    "INSERT INTO auth_tokens (id, kind, email, user_id, payload, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    await sha256(token),
    kind,
    email.toLowerCase(),
    extra.userId ?? null,
    extra.payload === undefined ? null : JSON.stringify(extra.payload),
    new Date(now).toISOString(),
    new Date(now + hours * 3600_000).toISOString(),
  );
  return token;
}

async function sendSignupEmail(origin: string, email: string, token: string, redirect: string) {
  const url = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(redirect)}`;
  const site = await siteName();
  const body = actionEmail({
    site,
    heading: "Επιβεβαιώστε το email σας",
    intro: "Πατήστε το κουμπί για να ενεργοποιήσετε τον λογαριασμό σας.",
    action: "Επιβεβαίωση email",
    url,
    footer: `Ο σύνδεσμος ισχύει για ${SIGNUP_TOKEN_HOURS} ώρες. Αν δεν κάνατε εσείς εγγραφή, αγνοήστε αυτό το μήνυμα.`,
  });
  await sendMail({ to: email, subject: `${site}: επιβεβαίωση λογαριασμού`, ...body });
}

type SignupPayload = { name: string; passwordHash: string };

async function sendAlreadyRegisteredEmail(origin: string, email: string) {
  const site = await siteName();
  const body = actionEmail({
    site,
    heading: "Έχετε ήδη λογαριασμό",
    intro: "Κάποιος (πιθανότατα εσείς) προσπάθησε να εγγραφεί με αυτό το email, αλλά υπάρχει ήδη λογαριασμός. Συνδεθείτε ή, αν ξεχάσατε τον κωδικό, ζητήστε νέο από τη σελίδα σύνδεσης.",
    action: "Σύνδεση",
    url: `${origin}/auth?mode=login`,
    footer: "Αν δεν το ζητήσατε εσείς, αγνοήστε αυτό το μήνυμα· ο λογαριασμός σας δεν άλλαξε.",
  });
  await sendMail({ to: email, subject: `${site}: έχετε ήδη λογαριασμό`, ...body });
}

/**
 * Starts a registration. The account is created only when the emailed link is opened.
 * The response is identical whether or not the email is already registered, so the form
 * cannot be used to discover who has an account.
 */
export async function signUp(input: { name: string; email: string; password: string; origin: string; redirect: string }) {
  const email = input.email.toLowerCase();
  if (await findUserByEmail(email)) {
    background(() => sendAlreadyRegisteredEmail(input.origin, email));
    return "confirmation" as const;
  }
  const payload: SignupPayload = { name: cleanName(input.name), passwordHash: await hashPassword(input.password) };
  const token = await issueToken("signup", email, SIGNUP_TOKEN_HOURS, { payload });
  background(() => sendSignupEmail(input.origin, email, token, input.redirect));
  return "confirmation" as const;
}

export async function resendSignup(input: { email: string; origin: string; redirect: string }) {
  const email = input.email.toLowerCase();
  if (await findUserByEmail(email)) return; // already confirmed; respond the same way
  const pending = await first<{ payload: string }>(
    "SELECT payload FROM auth_tokens WHERE kind = 'signup' AND email = ? AND used_at IS NULL AND payload IS NOT NULL ORDER BY created_at DESC LIMIT 1",
    email,
  );
  if (!pending) return;
  const token = await issueToken("signup", email, SIGNUP_TOKEN_HOURS, { payload: JSON.parse(pending.payload) });
  background(() => sendSignupEmail(input.origin, email, token, input.redirect));
}

async function consumeToken(kind: "signup" | "reset", token: string) {
  const id = await sha256(token);
  const row = await first<{ id: string; email: string; user_id: string | null; payload: string | null }>(
    "SELECT id, email, user_id, payload FROM auth_tokens WHERE id = ? AND kind = ? AND used_at IS NULL AND expires_at > ?",
    id,
    kind,
    nowIso(),
  );
  if (!row) return null;
  const changed = await run("UPDATE auth_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL", nowIso(), id);
  return changed ? row : null;
}

/** Completes a registration from the emailed link and returns the signed-in user id. */
export async function confirmSignup(token: string): Promise<string | null> {
  const row = await consumeToken("signup", token);
  if (!row?.payload) return null;
  const payload = JSON.parse(row.payload) as SignupPayload;
  const existing = await findUserByEmail(row.email);
  let userId: string;
  if (existing) {
    // e.g. the person signed in with Google meanwhile: keep the account, add the password.
    await run(
      "UPDATE users SET password_hash = COALESCE(password_hash, ?), email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?",
      payload.passwordHash,
      nowIso(),
      existing.id,
    );
    userId = existing.id;
    await ensureBootstrapAdmin(existing);
  } else {
    userId = (await insertUser({ email: row.email, name: payload.name, passwordHash: payload.passwordHash })).id;
  }
  // Older pending links for this address are no longer needed.
  await run("UPDATE auth_tokens SET used_at = ? WHERE kind = 'signup' AND email = ? AND used_at IS NULL", nowIso(), row.email);
  return userId;
}

export async function signIn(emailInput: string, password: string): Promise<string> {
  const email = emailInput.toLowerCase();
  const user = await findUserByEmail(email);
  if (!user) {
    // Only say "confirm your email" to someone who knows the password of the pending signup;
    // everyone else gets the same answer as for an unknown address (and similar timing).
    const pending = await first<{ payload: string }>(
      "SELECT payload FROM auth_tokens WHERE kind = 'signup' AND email = ? AND used_at IS NULL AND expires_at > ? AND payload IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      email,
      nowIso(),
    );
    const pendingHash = pending ? (JSON.parse(pending.payload) as SignupPayload).passwordHash : null;
    const matches = await verifyPassword(password, pendingHash ?? "pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    throw new AuthError(pendingHash && matches ? "email_not_confirmed" : "invalid_credentials");
  }
  // Accounts created with Google have no password; still spend the same time hashing.
  const ok = await verifyPassword(password, user.password_hash ?? "pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  if (!ok || !user.password_hash) throw new AuthError("invalid_credentials");
  await ensureBootstrapAdmin(user);
  return user.id;
}

export async function requestPasswordReset(input: { email: string; origin: string }) {
  const user = await findUserByEmail(input.email.toLowerCase());
  if (!user) return;
  const token = await issueToken("reset", user.email, RESET_TOKEN_HOURS, { userId: user.id });
  const url = `${input.origin}/reset-password#token=${encodeURIComponent(token)}`;
  background(async () => {
    const site = await siteName();
    const body = actionEmail({
      site,
      heading: "Επαναφορά κωδικού",
      intro: "Λάβαμε αίτημα για νέο κωδικό. Πατήστε το κουμπί για να ορίσετε νέο κωδικό πρόσβασης.",
      action: "Ορισμός νέου κωδικού",
      url,
      footer: `Ο σύνδεσμος ισχύει για ${RESET_TOKEN_HOURS} ώρες και μία μόνο χρήση. Αν δεν το ζητήσατε εσείς, αγνοήστε αυτό το μήνυμα.`,
    });
    await sendMail({ to: user.email, subject: `${site}: επαναφορά κωδικού`, ...body });
  });
}

/** Sets a new password from a reset link, signs out other devices and returns the user id. */
export async function resetPassword(token: string, password: string): Promise<string | null> {
  const row = await consumeToken("reset", token);
  if (!row?.user_id) return null;
  await db().batch([
    stmt(
      "UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?",
      await hashPassword(password),
      nowIso(),
      row.user_id,
    ),
    stmt("DELETE FROM sessions WHERE user_id = ?", row.user_id),
  ]);
  return row.user_id;
}

// ---------------------------------------------------------------- Google

/** Find or create the account for a verified Google identity. */
export async function upsertGoogleUser(profile: { sub: string; email: string; name?: string }): Promise<string> {
  const bySub = await first<UserRow>("SELECT * FROM users WHERE google_sub = ? AND deleted_at IS NULL", profile.sub);
  if (bySub) {
    await ensureBootstrapAdmin(bySub);
    return bySub.id;
  }
  const byEmail = await findUserByEmail(profile.email);
  if (byEmail) {
    await run(
      "UPDATE users SET google_sub = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?",
      profile.sub,
      nowIso(),
      byEmail.id,
    );
    await ensureBootstrapAdmin(byEmail);
    return byEmail.id;
  }
  return (await insertUser({ email: profile.email, name: profile.name ?? "", googleSub: profile.sub })).id;
}

// ---------------------------------------------------------------- admins

export async function listAdmins() {
  return all<{ user_id: string; email: string }>(
    "SELECT r.user_id, u.email FROM user_roles r JOIN users u ON u.id = r.user_id WHERE r.role = 'admin' ORDER BY u.email",
  );
}

export async function grantAdmin(email: string) {
  const user = await first<{ id: string }>(
    "SELECT id FROM users WHERE email = ? AND email_verified_at IS NOT NULL AND deleted_at IS NULL",
    email.trim().toLowerCase(),
  );
  if (!user) throw new PublicError("Δεν βρέθηκε επιβεβαιωμένος λογαριασμός με αυτό το email.");
  await run("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'admin')", user.id);
}

export async function revokeAdmin(currentUserId: string, userId: string) {
  if (userId === currentUserId) throw new PublicError("Δεν μπορείτε να αφαιρέσετε τον εαυτό σας.");
  const count = await first<{ n: number }>("SELECT count(*) AS n FROM user_roles WHERE role = 'admin'");
  if ((count?.n ?? 0) <= 1) throw new PublicError("Πρέπει να υπάρχει τουλάχιστον ένας διαχειριστής.");
  await run("DELETE FROM user_roles WHERE user_id = ? AND role = 'admin'", userId);
}
