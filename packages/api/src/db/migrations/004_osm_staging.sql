-- Migration 004: OSM staging table
--
-- osm2pgsql (flex output) writes raw OSM way data here.
-- scripts/calcScores.ts then transforms this into road_segments + quality_scores.

CREATE TABLE IF NOT EXISTS osm_ways (
  osm_way_id  BIGINT        PRIMARY KEY,
  geom        GEOMETRY(LINESTRING, 4326) NOT NULL,
  highway     VARCHAR(50)   NOT NULL,
  surface     VARCHAR(50),
  name        VARCHAR(200),
  maxspeed    SMALLINT,
  lanes       SMALLINT
);

CREATE INDEX IF NOT EXISTS osm_ways_geom_idx    ON osm_ways USING GIST (geom);
CREATE INDEX IF NOT EXISTS osm_ways_highway_idx ON osm_ways (highway);
