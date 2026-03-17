-- Migration 006: add midpoint geometry to routing_edges for bbox filtering
--
-- Recreates the materialized view with ST_Centroid(geom) as midpoint.
-- A GiST index on midpoint lets pgr_bdDijkstra cost queries filter edges
-- to a bounding box around origin+destination instead of scanning all 2.5M rows.
--
-- Expected speedup: 5–10× for long-distance routes (Kyiv → Sumy etc.)

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
  ST_Centroid(rs.geom)                    AS midpoint
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
CREATE UNIQUE INDEX routing_edges_id_idx     ON routing_edges (id);
-- Indexes used by pgr_bdDijkstra internal graph builder
CREATE INDEX routing_edges_source_idx        ON routing_edges (source);
CREATE INDEX routing_edges_target_idx        ON routing_edges (target);
-- GiST index for bbox filtering in cost query
CREATE INDEX routing_edges_midpoint_idx      ON routing_edges USING GIST (midpoint);
