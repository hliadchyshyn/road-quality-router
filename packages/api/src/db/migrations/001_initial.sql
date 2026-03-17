-- Migration 001: Initial schema — road_segments + quality_scores

CREATE TABLE IF NOT EXISTS road_segments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  osm_way_id    BIGINT UNIQUE,
  geom          GEOMETRY(LINESTRING, 4326) NOT NULL,
  road_type     VARCHAR(50)  NOT NULL DEFAULT 'residential',
  surface       VARCHAR(50)  NOT NULL DEFAULT 'unknown',
  name          VARCHAR(200),
  length_meters FLOAT        NOT NULL DEFAULT 0,
  speed_limit   SMALLINT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS road_segments_geom_idx ON road_segments USING GIST (geom);
CREATE INDEX IF NOT EXISTS road_segments_road_type_idx ON road_segments (road_type);

CREATE TABLE IF NOT EXISTS quality_scores (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  segment_id       UUID NOT NULL REFERENCES road_segments(id) ON DELETE CASCADE,
  osm_base_score   FLOAT NOT NULL CHECK (osm_base_score BETWEEN 0 AND 100),
  dynamic_penalty  FLOAT NOT NULL DEFAULT 0 CHECK (dynamic_penalty >= 0),
  acc_penalty      FLOAT NOT NULL DEFAULT 0 CHECK (acc_penalty >= 0),
  temporal_penalty FLOAT NOT NULL DEFAULT 0 CHECK (temporal_penalty >= 0),
  final_score      FLOAT GENERATED ALWAYS AS (
    GREATEST(0, LEAST(100,
      osm_base_score
      - dynamic_penalty  * 0.30
      - acc_penalty      * 0.20
      - temporal_penalty * 0.10
    ))
  ) STORED,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quality_scores_segment_computed_idx
  ON quality_scores (segment_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS quality_scores_final_score_idx
  ON quality_scores (final_score);

-- Waze events table (pre-created for Phase 2 readiness)
CREATE TABLE IF NOT EXISTS waze_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        VARCHAR(50) NOT NULL,
  geom        GEOMETRY(POINT, 4326) NOT NULL,
  severity    SMALLINT    NOT NULL DEFAULT 1,
  reported_at TIMESTAMPTZ NOT NULL,
  expires_at  TIMESTAMPTZ,
  waze_uuid   VARCHAR(100) UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS waze_events_geom_idx ON waze_events USING GIST (geom);
CREATE INDEX IF NOT EXISTS waze_events_type_idx ON waze_events (type);
CREATE INDEX IF NOT EXISTS waze_events_expires_idx ON waze_events (expires_at);
