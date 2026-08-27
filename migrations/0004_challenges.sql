-- Public community challenges (replaces one-click reports)

DROP TABLE IF EXISTS reports;

CREATE TABLE IF NOT EXISTS challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL REFERENCES videos(id),
  reason TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(video_id, ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_challenges_video ON challenges(video_id);
