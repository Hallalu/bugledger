-- coverage columns on the check-log (server-computed vs the app catalog)
ALTER TABLE checks ADD COLUMN cov_total INTEGER;
ALTER TABLE checks ADD COLUMN cov_matched INTEGER;
ALTER TABLE checks ADD COLUMN cov_missed TEXT;
-- append-only tier for NEW bugs an agent discovers during a scan (proposals to promote)
CREATE TABLE IF NOT EXISTS submitted (
  id            TEXT PRIMARY KEY,
  ts            INTEGER NOT NULL,
  app           TEXT,
  project       TEXT,
  kind          TEXT,      -- 'bug' | 'security'
  title         TEXT,
  category      TEXT,
  severity      TEXT,
  symptom       TEXT,
  fix           TEXT,
  file          TEXT,
  submitted_by  TEXT
);
CREATE INDEX IF NOT EXISTS idx_submitted_ts ON submitted(ts DESC);
CREATE TRIGGER IF NOT EXISTS submitted_no_update BEFORE UPDATE ON submitted
  BEGIN SELECT RAISE(ABORT,'submitted bugs are append-only'); END;
CREATE TRIGGER IF NOT EXISTS submitted_no_delete BEFORE DELETE ON submitted
  BEGIN SELECT RAISE(ABORT,'submitted bugs are append-only'); END;
