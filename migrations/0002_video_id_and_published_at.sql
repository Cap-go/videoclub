-- Canonical platform video id dedup + published_at for honest age display

ALTER TABLE videos ADD COLUMN video_id TEXT;
ALTER TABLE videos ADD COLUMN published_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_platform_video_id ON videos(platform, video_id);
