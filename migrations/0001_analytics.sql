-- CineMap remote analytics (Cloudflare D1)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ts INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  props TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_events_session_ts ON events (session_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_name ON events (name);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events (ts);
