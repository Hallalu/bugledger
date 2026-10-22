-- Prompt ledgers: every prompt in a session with its status — add-only
CREATE TABLE IF NOT EXISTS prompt_ledgers (id TEXT PRIMARY KEY, project TEXT, title TEXT, body TEXT NOT NULL, at INTEGER NOT NULL);
