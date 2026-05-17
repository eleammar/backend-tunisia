-- Migration: make tourist guide multi-city
-- Run once against the database

ALTER TABLE circuits
  ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE;

ALTER TABLE live_guides
  ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE;

ALTER TABLE hero_section
  ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE;

ALTER TABLE hero_categories
  ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE;
