-- Migration 005: routing_edges materialized view
--
-- Pre-joins road_segments with their latest quality_score so pgr_dijkstra
-- cost queries are a simple table scan instead of a per-row LATERAL join.
-- Refresh after: make calc-scores, Waze score update, or any quality change.

CREATE MATERIALIZED VIEW IF NOT EXISTS routing_edges AS
SELECT
  rs.seq_id                               AS id,
  rs.source,
  rs.target,
  rs.length_meters,
  rs.speed_limit,
  COALESCE(qs.final_score,  50)::float    AS quality_score,
  COALESCE(qs.osm_base_score, 50)::float  AS osm_base_score,
  COALESCE(qs.dynamic_penalty, 0)::float  AS dynamic_penalty,
  COALESCE(qs.acc_penalty,     0)::float  AS acc_penalty,
  COALESCE(qs.temporal_penalty,0)::float  AS temporal_penalty
FROM road_segments rs
LEFT JOIN LATERAL (
  SELECT final_score, osm_base_score, dynamic_penalty, acc_penalty, temporal_penalty
  FROM quality_scores
  WHERE segment_id = rs.id
  ORDER BY computed_at DESC
  LIMIT 1
) qs ON true
WHERE rs.source IS NOT NULL
  AND rs.target IS NOT NULL;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS routing_edges_id_idx ON routing_edges (id);
-- Non-unique indexes used by pgr_dijkstra internal graph builder
CREATE INDEX IF NOT EXISTS routing_edges_source_idx ON routing_edges (source);
CREATE INDEX IF NOT EXISTS routing_edges_target_idx ON routing_edges (target);
