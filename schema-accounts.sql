-- Workspaces: one row per sign-up from the front page. The write key is shown once at sign-up
-- and only its SHA-256 is stored; it is accepted as x-ledger-key wherever the owner token is.
-- Append-only like the rest of the ledger: rows are never edited or deleted.
CREATE TABLE IF NOT EXISTS accounts (
  id          TEXT PRIMARY KEY,
  ts          INTEGER NOT NULL,        -- unix ms
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,
  plan        TEXT NOT NULL DEFAULT 'free',   -- 'free' | 'team' | 'business' (billing is a follow-up)
  key_hash    TEXT NOT NULL UNIQUE,    -- sha256 hex of the write key
  key_prefix  TEXT NOT NULL            -- first 10 chars, so support can identify a key without seeing it
);
CREATE INDEX IF NOT EXISTS idx_accounts_ts ON accounts(ts DESC);
