# Επιτροπή Άνω Πόλης — website

Neighbourhood news site with an editorial back office (`/admin`), reader accounts, comments,
likes/saves, events, announcements, a newsletter sign-up and a tip form.

It runs entirely on **Cloudflare**:

| Piece | Cloudflare product |
| --- | --- |
| Website + server code | Workers |
| Database (articles, accounts, comments…) | D1 |
| Photos and uploads | R2 (private bucket) |

Sign-in supports email + password (with email confirmation and password reset) and
**Continue with Google**. Emails are sent from your own address through your own
[Resend](https://resend.com) or [Brevo](https://www.brevo.com) account.

---

## Deploying (one-time setup, ~20 minutes)

You need: a Cloudflare account, Node.js 20.19 or newer, and this folder.
Run every command from inside this folder.

### 1. Install and log in

```sh
npm install
npx wrangler login
```

### 2. Create the database

```sh
npx wrangler d1 create epitropi
```

Copy the `database_id` it prints into `wrangler.jsonc` (replace `PASTE-D1-DATABASE-ID-HERE`), then create the tables:

```sh
npm run db:migrate
```

### 3. Create the photo storage

```sh
npx wrangler r2 bucket create epitropi-media
```

The bucket stays private. Do not enable public access.

### 4. Set up email (confirmation and password-reset messages)

**Resend** (default):
1. Create an account at resend.com, add your domain under **Domains**, and add the DNS records it shows.
2. Create an API key.
3. In `wrangler.jsonc`, set `EMAIL_FROM` to an address on that domain, e.g.
   `"Επιτροπή Άνω Πόλης <no-reply@yourdomain.gr>"`.
4. Store the key as a secret:
   ```sh
   npx wrangler secret put EMAIL_API_KEY
   ```

**Brevo** instead: set `"EMAIL_PROVIDER": "brevo"` in `wrangler.jsonc`, verify your sender/domain in
Brevo, and store a Brevo API key (v3) with the same `wrangler secret put EMAIL_API_KEY` command.

### 5. Set up "Continue with Google"

1. Go to <https://console.cloud.google.com/> → create (or choose) a project.
2. **APIs & Services → OAuth consent screen**: choose *External*, fill in the app name and
   support email, add your domain, then **Publish app** so any Google user can sign in.
   The site only asks for name and email, so Google's review is not required.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorised JavaScript origins: `https://yourdomain.gr`
   - Authorised redirect URIs: `https://yourdomain.gr/api/auth/google-callback`
   - Also add the `https://epitropi.<your-subdomain>.workers.dev` versions if you want to test there first.
4. Put the **Client ID** in `wrangler.jsonc` → `GOOGLE_CLIENT_ID`.
5. Store the **Client secret**:
   ```sh
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```

### 6. Security key and first admin

Create a long random secret (used to sign private image links):

```sh
openssl rand -base64 48 | npx wrangler secret put SESSION_SECRET
```

In `wrangler.jsonc`, set `APP_URL` to the site's address (e.g. `https://yourdomain.gr`). Links in
emails and the Google sign-in always use this address, never whatever host a request claims.

Set `ADMIN_EMAILS` to the email(s) of the site owner(s), comma-separated.
Those accounts get admin access automatically the first time they sign in. Further admins can be
added from **/admin → Διαχειριστές**.

### 7. Deploy

```sh
npm run deploy
```

Then, in the Cloudflare dashboard → **Workers & Pages → epitropi → Settings → Domains & Routes**,
add your custom domain (e.g. `yourdomain.gr`).

Open the site, register (or continue with Google) using an `ADMIN_EMAILS` address, and go to `/admin`.

> **Plan:** the Workers **Paid** plan ($5/month) is recommended. Secure password hashing needs
> more CPU time per sign-in than the free plan's 10 ms limit allows. D1 and R2 fit comfortably
> in their free allowances for a site of this size.

### Updating later

After code changes: `npm run deploy`. If a new file appears in `migrations/`, run `npm run db:migrate` first.

---

## Media from GitHub + jsDelivr (free, no credit card)

Editors can host photos, short videos and audio in a public GitHub repository and embed them through jsDelivr. Admins just pick a file in the editor and the site saves it to GitHub automatically (needs the `GITHUB_TOKEN` secret, set once). Set the repository in **Settings → Πολυμέσα (GitHub + jsDelivr)**, then use the film icon in the article editor (or the GitHub button next to the cover photo). The site only accepts files from that exact repository (a tag or commit is recommended over `main`), requires alt text, credit and a permission confirmation, and blocks all other external media. Read `docs/MEDIA-GUIDE.md` for the step-by-step guide, limits (20 MB per file; keep long videos on YouTube) and the `docs/media-repo-template/` starter repository.

## Settings reference

| Name | Where | Purpose |
| --- | --- | --- |
| `EMAIL_PROVIDER` | `wrangler.jsonc` | `resend` or `brevo` |
| `EMAIL_FROM` | `wrangler.jsonc` | Sender, e.g. `Name <no-reply@yourdomain.gr>` |
| `ADMIN_EMAILS` | `wrangler.jsonc` | Emails that become admins automatically |
| `GOOGLE_CLIENT_ID` | `wrangler.jsonc` | Google OAuth client ID |
| `APP_URL` | `wrangler.jsonc` | Public URL of the site, used in emails and Google sign-in |
| `EMAIL_API_KEY` | secret | Resend/Brevo API key |
| `GOOGLE_CLIENT_SECRET` | secret | Google OAuth client secret |
| `SESSION_SECRET` | secret | Random string, at least 32 characters |
| `GITHUB_TOKEN` | secret | GitHub token that lets the site save uploaded media to the media repository (see `docs/MEDIA-GUIDE.md`) |
| `GITHUB_MEDIA_BRANCH` | `wrangler.jsonc` | Branch that receives uploads (default `main`) |

## Security

Built in:

- **Accounts:** passwords hashed with PBKDF2-SHA256 (100,000 rounds, per-user salt). Passwords found in
  public breach lists are refused (Have I Been Pwned, k-anonymity — the password never leaves the server).
  Sessions are random 256-bit tokens in a `__Host-` cookie (HttpOnly, Secure, SameSite=Lax); only their
  hash is stored. A password reset signs out every other device.
- **No account discovery:** sign-up, sign-in, resend and password-reset answer identically (and with the
  same timing) whether or not an email is registered.
- **Brute force and abuse:** failed logins are capped per address and per network; emails are capped
  per address (1/minute, 5/hour) and per network; sign-ups, tips and newsletter sign-ups are rate limited.
- **Google sign-in:** authorization code flow with PKCE and a state check; only Google-verified emails accepted.
- **Permissions:** every read and write is checked on the server. Admin-only actions check the role on
  each request. The last admin cannot be removed.
- **Content:** article HTML is sanitized on the server (no scripts, event handlers, `javascript:` links,
  foreign CSS classes or non-HTTPS embeds; embeds are sandboxed). Comments and names are shown as plain text.
- **Uploads:** file type is detected from the file's bytes (JPG, PNG, WebP, GIF, AVIF only); size is
  checked before the upload is read. Files are stored privately and served with `nosniff` and a sandbox policy.
  Images of unpublished articles are not served.
- **Browser protections:** Content-Security-Policy, HSTS, `X-Frame-Options: DENY` (no clickjacking),
  strict referrer policy, CSRF checks on all state-changing requests, no caching of personal responses.
- **Errors:** visitors only ever see generic errors; details go to the Cloudflare logs.
- **Privacy:** other readers' account IDs and the internal notification email are never sent to the browser.
  Reset links keep their token after `#`, so it never reaches a server log or another site.

Recommended in the Cloudflare dashboard (no code needed):

1. **Security → Bots:** turn on *Bot Fight Mode*.
2. **Security → WAF → Rate limiting rules:** e.g. 100 requests / 10 s per IP on `/*`, and
   20 requests / minute per IP on paths starting with `/_serverFn` and `/api/`.
3. **SSL/TLS:** mode *Full (strict)*, *Always Use HTTPS* on, minimum TLS 1.2.
4. **DNS:** enable DNSSEC.
5. After the custom domain works, set `"workers_dev": false` in `wrangler.jsonc` and deploy again, so the site
   is only reachable at your domain.

Also: turn on two-factor authentication for the Cloudflare, Google Cloud and Resend/Brevo accounts, and run
`npm audit` when updating dependencies. Admins should use strong, unique passwords (or Google sign-in with 2FA).

## Local development

```sh
cp .dev.vars.example .dev.vars   # fill in values
npm run db:migrate:local
npm run dev                      # http://localhost:3000
```

For Google sign-in locally, add `http://localhost:3000` and
`http://localhost:3000/api/auth/google-callback` to the OAuth client.

## How it's built

- **TanStack Start** (React, server rendering) built with Vite and the Cloudflare Vite plugin.
- `src/server/` — server-only code: D1 queries, sessions, password hashing (PBKDF2), Google OAuth,
  email, R2 media. All permission checks happen here; the browser never talks to the database.
- `src/lib/*.functions.ts` — server functions the pages call.
- `src/routes/api/` — HTTP endpoints: image serving, uploads, tip form, email confirmation, Google sign-in.
- `migrations/` — D1 database schema.
- Published article images are served through `/api/public/editorial-image`, which rechecks on every
  request that the article is still published. Admin previews and reader-submitted photos use
  expiring signed links.
