-- Stable platform account identity per video (one account per platform per domain)

ALTER TABLE videos ADD COLUMN platform_account TEXT;

CREATE INDEX IF NOT EXISTS idx_videos_startup_platform ON videos(startup_id, platform);
