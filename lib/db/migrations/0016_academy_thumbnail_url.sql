-- Academy lessons thumbnail image URL
-- Supports custom thumbnail previews for academy episodes

ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS thumbnail_url text;
