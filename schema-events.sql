-- Scan story: the agent's own narrative of a sweep, captured as append-only events.
-- One row per thing the agent said or found while working: a phase starting, a line of
-- reasoning ("triaging the 55 hits — reading the code, not trusting the detector"), a finding
-- with severity + plain English + fix + evidence, a before→after metric, the verdict, a caveat.
-- Rendered as the itemised, severity-tagged report at /story/<session id>.
CREATE TABLE IF NOT EXISTS session_events (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  ts          INTEGER NOT NULL,
  seq         INTEGER,            -- client-side ordinal, keeps order stable when ts ties
  kind        TEXT NOT NULL,      -- phase | say | found | fixed | clean | metric | verdict | caveat | note
  phase       TEXT,               -- the phase this event belongs to (e.g. "Phase 1 — Automated pass")
  severity    TEXT,               -- critical | high | medium | low | info
  status      TEXT,               -- fixed | open | needs-call | false-positive | applied | recommended | wontfix
  category    TEXT,               -- security | accessibility | seo | logic | … (16 bug families + optimiser families)
  confidence  TEXT,               -- high | review   (from the detector, or the agent's own call)
  verified_by TEXT,               -- detector | code-read | test | reasoned | assumed
  title       TEXT,               -- short headline
  detail      TEXT,               -- plain English: what was actually wrong
  impact      TEXT,               -- what it would have done to a real user / why it matters
  fix         TEXT,               -- what was done (or what to do)
  file        TEXT,               -- path:line
  ref         TEXT,               -- for kind=fixed: the id of the found event it resolves
  before_v    TEXT,               -- for kind=metric
  after_v     TEXT,               -- for kind=metric
  meta        TEXT                -- JSON: anything else (tags, counts, urls)
);
CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(session_id, ts);
CREATE TRIGGER IF NOT EXISTS session_events_no_update BEFORE UPDATE ON session_events
  BEGIN SELECT RAISE(ABORT,'story events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS session_events_no_delete BEFORE DELETE ON session_events
  BEGIN SELECT RAISE(ABORT,'story events are append-only'); END;
-- link coverage posts and ledger additions back to the story they came from (additive columns)
ALTER TABLE checks ADD COLUMN session_id TEXT;
ALTER TABLE submitted ADD COLUMN session_id TEXT;
