-- Agent check-log: one row per "I checked app X against the ledger" report.
CREATE TABLE IF NOT EXISTS checks (
  id                TEXT PRIMARY KEY,
  ts                INTEGER NOT NULL,        -- unix ms
  app               TEXT NOT NULL,
  project           TEXT,                    -- repo path / name the agent scanned
  checked_by        TEXT,                    -- e.g. "claude-code"
  scanned           INTEGER,                 -- files scanned
  checked_count     INTEGER,                 -- how many known bugs were checked for
  found_count       INTEGER,                 -- how many were actually present
  security_status   TEXT,                    -- "clean" | "issues" | "n/a"
  not_found         TEXT,                    -- JSON array of bug titles checked & NOT present
  found             TEXT,                    -- JSON array of {title,file,note}
  security_checked  TEXT,                    -- JSON array of security checks performed
  security_findings TEXT,                    -- JSON array of {severity,title,file}
  notes             TEXT
);
CREATE INDEX IF NOT EXISTS idx_checks_app ON checks(app);
CREATE INDEX IF NOT EXISTS idx_checks_ts  ON checks(ts DESC);
