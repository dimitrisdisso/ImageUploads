-- Cloudflare D1 schema for the publication.
-- Apply with:  npx wrangler d1 migrations apply epitropi --remote
-- All timestamps are ISO-8601 UTC strings (e.g. 2026-11-25T21:30:00.000Z).

-- Accounts ---------------------------------------------------------------

CREATE TABLE users (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name              TEXT NOT NULL DEFAULT 'Αναγνώστης' CHECK (length(trim(name)) BETWEEN 1 AND 80),
  password_hash     TEXT,
  google_sub        TEXT UNIQUE,
  email_verified_at TEXT,
  created_at        TEXT NOT NULL,
  deleted_at        TEXT
);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,            -- SHA-256 of the cookie token
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

-- One-time links sent by email (signup confirmation, password reset).
CREATE TABLE auth_tokens (
  id         TEXT PRIMARY KEY,            -- SHA-256 of the emailed token
  kind       TEXT NOT NULL CHECK (kind IN ('signup', 'reset')),
  email      TEXT NOT NULL COLLATE NOCASE,
  user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  payload    TEXT,                        -- JSON (pending name + password hash for signups)
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);
CREATE INDEX auth_tokens_email_idx ON auth_tokens(email, kind, created_at);

CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role    TEXT NOT NULL CHECK (role IN ('admin')),
  PRIMARY KEY (user_id, role)
);

-- Simple sliding-window counters for login, email and form abuse protection.
CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  at  TEXT NOT NULL
);
CREATE INDEX rate_limits_key_idx ON rate_limits(key, at);

-- Publication -------------------------------------------------------------

CREATE TABLE cms_content (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('post', 'author', 'event', 'announcement', 'settings', 'category')),
  status     TEXT NOT NULL DEFAULT 'draft',
  data       TEXT NOT NULL DEFAULT '{}',  -- JSON
  updated_at TEXT NOT NULL
);
CREATE INDEX cms_content_kind_idx ON cms_content(kind, status);

CREATE TABLE reader_messages (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,               -- comment | tip | subscription
  status     TEXT NOT NULL DEFAULT 'pending',
  data       TEXT NOT NULL DEFAULT '{}',  -- JSON
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX reader_messages_kind_idx ON reader_messages(kind, created_at DESC);
CREATE INDEX reader_messages_user_idx ON reader_messages(user_id, kind);

CREATE TABLE saved_articles (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_slug TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, article_slug)
);

CREATE TABLE article_likes (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_slug TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, article_slug)
);
CREATE INDEX article_likes_slug_idx ON article_likes(article_slug);

CREATE TABLE media_assets (
  id          TEXT PRIMARY KEY,
  path        TEXT NOT NULL UNIQUE,       -- object key inside the R2 bucket's "editorial/" folder
  filename    TEXT NOT NULL,
  mime_type   TEXT,
  size_bytes  INTEGER,
  width       INTEGER,
  height      INTEGER,
  alt         TEXT,
  credit      TEXT NOT NULL CHECK (length(trim(credit)) > 0),
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL
);
