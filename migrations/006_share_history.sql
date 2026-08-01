-- Local-only share publish history (plaintext password for lookup; server stores hash only).
CREATE TABLE IF NOT EXISTS share_history (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  workspace_name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  password TEXT,
  password_set INTEGER NOT NULL DEFAULT 0,
  receipt_markdown TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_share_history_workspace
  ON share_history (workspace_id);

CREATE INDEX IF NOT EXISTS idx_share_history_published
  ON share_history (published_at DESC);
