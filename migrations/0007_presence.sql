CREATE TABLE IF NOT EXISTS presence (
  visitor_id TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence(last_seen);
