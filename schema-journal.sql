-- Prompt Journal: every prompt the owner sends to a coding agent, stored word-for-word (never a paraphrase),
-- time-stamped, filed under its project, with the photos that go with it. Three tables, all append-only:
--   journal        one row per prompt (text is the exact string as sent; sha = SHA-256 of that text)
--   journal_photos one row per picture attached to a prompt (pasted screenshots, before/after shots) — R2 key under pj/
--   journal_refile a later filing of a prompt under a different project/app (rows are never edited, so a
--                  prompt captured before its project was known is re-filed by appending; latest filing wins)
CREATE TABLE IF NOT EXISTS journal (
  id          TEXT PRIMARY KEY,          -- jr + 18 hex
  ts          INTEGER NOT NULL,          -- when the prompt was sent (unix ms)
  received    INTEGER NOT NULL,          -- when the ledger stored it (unix ms)
  project     TEXT,                      -- repo / folder name
  app         TEXT,                      -- display name of the app when known
  session_id  TEXT,                      -- the agent session the prompt belongs to
  seq         INTEGER,                   -- nth prompt in that session, when known
  agent       TEXT,                      -- claude-code | codex | cursor | …
  source      TEXT,                      -- hook | transcript | cli | api
  arrival     TEXT,                      -- typed | mid-turn | command | api
  text        TEXT NOT NULL,             -- the prompt, verbatim
  sha         TEXT NOT NULL,             -- sha256 hex of text exactly as stored
  key_sha     TEXT NOT NULL,             -- sha256 hex of text.trim() — used only to pair hook + transcript copies
  chars       INTEGER, words INTEGER,
  redactions  INTEGER NOT NULL DEFAULT 0,-- secrets removed before storage (0 = untouched)
  truncated   INTEGER NOT NULL DEFAULT 0,-- 1 if the text hit the size cap
  uuid        TEXT,                      -- transcript message id when known (idempotency)
  cwd         TEXT,
  meta        TEXT                       -- JSON: anything else (model, branch, images, …)
);
CREATE INDEX IF NOT EXISTS idx_journal_ts       ON journal(ts DESC);
CREATE INDEX IF NOT EXISTS idx_journal_project  ON journal(project, ts DESC);
CREATE INDEX IF NOT EXISTS idx_journal_session  ON journal(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_journal_keysha   ON journal(session_id, key_sha);
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_uuid ON journal(uuid) WHERE uuid IS NOT NULL;
CREATE TRIGGER IF NOT EXISTS journal_no_update BEFORE UPDATE ON journal BEGIN SELECT RAISE(ABORT,'the prompt journal is append-only'); END;
CREATE TRIGGER IF NOT EXISTS journal_no_delete BEFORE DELETE ON journal BEGIN SELECT RAISE(ABORT,'the prompt journal is append-only'); END;

CREATE TABLE IF NOT EXISTS journal_photos (
  id          TEXT PRIMARY KEY,
  prompt_id   TEXT NOT NULL,
  ts          INTEGER NOT NULL,
  key         TEXT NOT NULL,             -- R2 object key, always under pj/
  kind        TEXT,                      -- pasted | before | after | shot
  caption     TEXT,
  width       INTEGER, height INTEGER, bytes INTEGER,
  type        TEXT,                      -- image/png …
  by          TEXT                       -- who attached it (hook, sweep, agent name)
);
CREATE INDEX IF NOT EXISTS idx_journal_photos_prompt ON journal_photos(prompt_id, ts);
CREATE TRIGGER IF NOT EXISTS journal_photos_no_update BEFORE UPDATE ON journal_photos BEGIN SELECT RAISE(ABORT,'the prompt journal is append-only'); END;
CREATE TRIGGER IF NOT EXISTS journal_photos_no_delete BEFORE DELETE ON journal_photos BEGIN SELECT RAISE(ABORT,'the prompt journal is append-only'); END;

CREATE TABLE IF NOT EXISTS journal_refile (
  id          TEXT PRIMARY KEY,
  prompt_id   TEXT NOT NULL,
  ts          INTEGER NOT NULL,
  project     TEXT,
  app         TEXT,
  by          TEXT
);
CREATE INDEX IF NOT EXISTS idx_journal_refile_prompt ON journal_refile(prompt_id, ts DESC);
CREATE TRIGGER IF NOT EXISTS journal_refile_no_update BEFORE UPDATE ON journal_refile BEGIN SELECT RAISE(ABORT,'the prompt journal is append-only'); END;
CREATE TRIGGER IF NOT EXISTS journal_refile_no_delete BEFORE DELETE ON journal_refile BEGIN SELECT RAISE(ABORT,'the prompt journal is append-only'); END;

-- which live-hook row a transcript message was matched to — so a second identical prompt in the same minutes is never swallowed
CREATE TABLE IF NOT EXISTS journal_pairs (
  uuid      TEXT PRIMARY KEY,        -- the transcript message uuid
  prompt_id TEXT NOT NULL,           -- the hook row it stands for
  ts        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_journal_pairs_prompt ON journal_pairs(prompt_id);
CREATE TRIGGER IF NOT EXISTS journal_pairs_no_update BEFORE UPDATE ON journal_pairs BEGIN SELECT RAISE(ABORT,'the prompt journal is append-only'); END;
CREATE TRIGGER IF NOT EXISTS journal_pairs_no_delete BEFORE DELETE ON journal_pairs BEGIN SELECT RAISE(ABORT,'the prompt journal is append-only'); END;
