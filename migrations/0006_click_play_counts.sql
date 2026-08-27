-- Track outbound product clicks and on-site embed plays

ALTER TABLE startups ADD COLUMN click_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE startups ADD COLUMN play_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE videos ADD COLUMN play_count INTEGER NOT NULL DEFAULT 0;
