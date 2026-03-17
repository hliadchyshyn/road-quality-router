-- Migration 007: add road_penalty multiplier to routing_edges
--
-- Footways, cycleways and paths are kept in the graph (connectivity),
-- but their cost is multiplied so pgr_bdDijkstra strongly avoids them
-- for car routing unless there is absolutely no other way through.
--
-- penalty = 1.0  → normal car road (motorway … residential)
-- penalty = 50+  → pedestrian / cycle only (effectively impassable for cars)

DROP MATERIALIZED VIEW IF EXISTS routing_edges;

CREATE MATERIALIZED VIEW routing_edges AS
SELECT
  rs.seq_id                               AS id,
  rs.source,
  rs.target,
  rs.length_meters,
  rs.speed_limit,
  COALESCE(qs.final_score,   50)::float   AS quality_score,
  COALESCE(qs.osm_base_score, 50)::float  AS osm_base_score,
  COALESCE(qs.dynamic_penalty, 0)::float  AS dynamic_penalty,
  COALESCE(qs.acc_penalty,     0)::float  AS acc_penalty,
  COALESCE(qs.temporal_penalty,0)::float  AS temporal_penalty,
  ST_Centroid(rs.geom)                    AS midpoint,
  CASE rs.road_type
    WHEN 'footway'     THEN 80.0
    WHEN 'cycleway'    THEN 80.0
    WHEN 'path'        THEN 40.0
    WHEN 'steps'       THEN 200.0
    WHEN 'pedestrian'  THEN 40.0
    WHEN 'track'       THEN 5.0
    WHEN 'service'     THEN 2.0
    ELSE 1.0
  END::float                              AS road_penalty
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

CREATE UNIQUE INDEX routing_edges_id_idx      ON routing_edges (id);
CREATE INDEX routing_edges_source_idx         ON routing_edges (source);
CREATE INDEX routing_edges_target_idx         ON routing_edges (target);
CREATE INDEX routing_edges_midpoint_idx       ON routing_edges USING GIST (midpoint);
