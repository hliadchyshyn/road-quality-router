-- Migration 003: pgRouting topology columns
--
-- Adds the integer ID + source/target columns required by pgr_createTopology.
-- The actual topology (source/target values + vertices table) is built
-- separately via `make topology` after data is seeded.

-- Stable integer PK for pgRouting (SERIAL, assigned once on row creation)
ALTER TABLE road_segments ADD COLUMN IF NOT EXISTS seq_id SERIAL;

-- Vertex IDs filled by pgr_createTopology
ALTER TABLE road_segments ADD COLUMN IF NOT EXISTS source INTEGER;
ALTER TABLE road_segments ADD COLUMN IF NOT EXISTS target INTEGER;

CREATE INDEX IF NOT EXISTS road_segments_source_idx ON road_segments (source);
CREATE INDEX IF NOT EXISTS road_segments_target_idx ON road_segments (target);
CREATE INDEX IF NOT EXISTS road_segments_seq_id_idx ON road_segments (seq_id);
