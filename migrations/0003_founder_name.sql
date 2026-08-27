-- Founder name + soft name confirmation flag

ALTER TABLE startups ADD COLUMN founder_name TEXT;
ALTER TABLE startups ADD COLUMN name_unconfirmed INTEGER NOT NULL DEFAULT 0;
