-- Migration 002: Waze fetch audit log

CREATE TABLE IF NOT EXISTS waze_fetch_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status           VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'empty')),
  events_stored    INTEGER NOT NULL DEFAULT 0,
  segments_updated INTEGER NOT NULL DEFAULT 0,
  error_message    TEXT,
  bbox             VARCHAR(200)
);

CREATE INDEX IF NOT EXISTS waze_fetch_log_fetched_at_idx
  ON waze_fetch_log (fetched_at DESC);
