-- Append-only integrity: agents (and anyone) can ADD but never modify/delete the record.
-- Check-logs are a permanent audit trail — fully immutable.
CREATE TRIGGER IF NOT EXISTS checks_no_update BEFORE UPDATE ON checks
  BEGIN SELECT RAISE(ABORT,'checks are append-only'); END;
CREATE TRIGGER IF NOT EXISTS checks_no_delete BEFORE DELETE ON checks
  BEGIN SELECT RAISE(ABORT,'checks are append-only'); END;
-- Live sessions may update their own progress but can never be deleted,
-- and a finished session is frozen (history can't be rewritten).
CREATE TRIGGER IF NOT EXISTS sessions_no_delete BEFORE DELETE ON sessions
  BEGIN SELECT RAISE(ABORT,'sessions cannot be deleted'); END;
CREATE TRIGGER IF NOT EXISTS sessions_done_frozen BEFORE UPDATE ON sessions
  WHEN OLD.status='done'
  BEGIN SELECT RAISE(ABORT,'finished session is immutable'); END;
