CREATE TABLE IF NOT EXISTS sync_state (
  sync_id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
