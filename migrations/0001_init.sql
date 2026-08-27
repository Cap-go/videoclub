-- Video Club initial schema

CREATE TABLE IF NOT EXISTS startups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_url TEXT NOT NULL,
  product_host TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  removed_at TEXT,
  removal_reason TEXT,
  last_notified_rank INTEGER
);

CREATE INDEX IF NOT EXISTS idx_startups_removed ON startups(removed_at);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  startup_id INTEGER NOT NULL REFERENCES startups(id),
  video_url TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  thumbnail TEXT,
  author TEXT,
  product_url_found TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  removed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_videos_startup ON videos(startup_id);
CREATE INDEX IF NOT EXISTS idx_videos_removed ON videos(removed_at);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL REFERENCES videos(id),
  reason TEXT NOT NULL DEFAULT 'ai',
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TEXT NOT NULL
);
