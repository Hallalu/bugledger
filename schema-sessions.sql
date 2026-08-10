-- Live agent worklog: one row per "show your work" session.
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  started     INTEGER NOT NULL,
  updated     INTEGER NOT NULL,
  app         TEXT,
  project     TEXT,
  title       TEXT,
  agent       TEXT,
  status      TEXT,      -- 'active' | 'done'
  current     TEXT,      -- the bold "doing now" line
  tasks       TEXT,      -- JSON array of {text,status:'pending'|'active'|'done'}
  done_count  INTEGER,
  total_count INTEGER,
  note        TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated DESC);
