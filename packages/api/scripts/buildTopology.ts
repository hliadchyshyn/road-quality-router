import postgres from 'postgres'
import 'dotenv/config'

const DATABASE_URL = process.env.DATABASE_URL!
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const sql = postgres(DATABASE_URL, { max: 1 })

async function buildTopology() {
  const [{ count }] = await sql<[{ count: string }]>`
    SELECT COUNT(*)::text AS count FROM road_segments
  `
  if (Number(count) === 0) {
    console.error('No road segments found — run `make seed` first.')
    process.exit(1)
  }
  console.log(`Building pgRouting topology for ${count} road segments...`)

  // ── Step 1: Node the network ─────────────────────────────────────────────
  // pgr_nodeNetwork splits OSM ways at every intersection point so that
  // road_segments_noded has one row per edge-between-two-nodes.
  // This is required because OSM ways are stored as full linestrings; two
  // roads that cross at a mid-segment point would otherwise be topologically
  // disconnected.
  //
  // Creates table road_segments_noded with columns:
  //   id (new serial), old_id (road_segments.seq_id), sub_id, geom
  console.log('  [1/3] Noding network (splitting at intersections)…')
  console.log('        This may take 10–60 min for Ukraine. Please wait.')
  const t1 = Date.now()

  await sql.unsafe(`DROP TABLE IF EXISTS road_segments_noded CASCADE`)
  await sql.unsafe(`
    SELECT pgr_nodeNetwork(
      'road_segments',
      0.000001,
      'seq_id',
      'geom'
    )
  `)

  const [{ noded_count }] = await sql<[{ noded_count: string }]>`
    SELECT COUNT(*)::text AS noded_count FROM road_segments_noded
  `
  const dt1 = ((Date.now() - t1) / 1000).toFixed(1)
  console.log(`  ✓ Noded edges: ${noded_count}  (${dt1}s)`)

  // ── Step 2: Build topology on noded table ────────────────────────────────
  // pgr_createTopology fills source/target columns and creates
  // road_segments_noded_vertices_pgr.
  console.log('  [2/3] Building pgRouting topology on noded network…')
  const t2 = Date.now()

  await sql.unsafe(`
    SELECT pgr_createTopology(
      'road_segments_noded',
      0.000001,
      'geom',
      'id',
      clean := true
    )
  `)

  const [{ vertices }] = await sql<[{ vertices: string }]>`
    SELECT COUNT(*)::text AS vertices FROM road_segments_noded_vertices_pgr
  `
  const [{ disconnected }] = await sql<[{ disconnected: string }]>`
    SELECT COUNT(*)::text AS disconnected
    FROM road_segments_noded
    WHERE source IS NULL OR target IS NULL
  `
  const dt2 = ((Date.now() - t2) / 1000).toFixed(1)
  console.log(`  ✓ Vertices: ${vertices}  (${dt2}s)`)
  console.log(`  ✓ Connected noded edges: ${Number(noded_count) - Number(disconnected)}`)
  if (Number(disconnected) > 0) {
    console.log(`  ⚠ Disconnected noded edges: ${disconnected}`)
  }

  // ── Step 3: Rebuild routing_edges materialized view ──────────────────────
  // routing_edges is now derived from road_segments_noded (for correct edge IDs
  // and topology) joined to road_segments (for metadata: road_type, name, etc.)
  console.log('  [3/3] Rebuilding routing_edges materialized view…')
  const t3 = Date.now()

  await sql.unsafe(`DROP MATERIALIZED VIEW IF EXISTS routing_edges`)
  await sql.unsafe(`
    CREATE MATERIALIZED VIEW routing_edges AS
    SELECT
      n.id                                    AS id,
      n.source,
      n.target,
      ST_Length(n.geom::geography)            AS length_meters,
      rs.speed_limit,
      COALESCE(qs.final_score,   50)::float   AS quality_score,
      COALESCE(qs.osm_base_score, 50)::float  AS osm_base_score,
      COALESCE(qs.dynamic_penalty, 0)::float  AS dynamic_penalty,
      COALESCE(qs.acc_penalty,     0)::float  AS acc_penalty,
      COALESCE(qs.temporal_penalty,0)::float  AS temporal_penalty,
      ST_Centroid(n.geom)                     AS midpoint,
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
    FROM road_segments_noded n
    JOIN road_segments rs ON rs.seq_id = n.old_id
    LEFT JOIN LATERAL (
      SELECT final_score, osm_base_score, dynamic_penalty, acc_penalty, temporal_penalty
      FROM quality_scores
      WHERE segment_id = rs.id
      ORDER BY computed_at DESC
      LIMIT 1
    ) qs ON true
    WHERE n.source IS NOT NULL
      AND n.target IS NOT NULL
  `)

  await sql.unsafe(`CREATE UNIQUE INDEX routing_edges_id_idx     ON routing_edges (id)`)
  await sql.unsafe(`CREATE INDEX routing_edges_source_idx        ON routing_edges (source)`)
  await sql.unsafe(`CREATE INDEX routing_edges_target_idx        ON routing_edges (target)`)
  await sql.unsafe(`CREATE INDEX routing_edges_midpoint_idx      ON routing_edges USING GIST (midpoint)`)

  const [{ edge_count }] = await sql<[{ edge_count: string }]>`
    SELECT COUNT(*)::text AS edge_count FROM routing_edges
  `
  const dt3 = ((Date.now() - t3) / 1000).toFixed(1)
  console.log(`  ✓ routing_edges rows: ${edge_count}  (${dt3}s)`)

  console.log('Topology build complete.')
  await sql.end()
}

buildTopology().catch((err) => {
  console.error('Topology build failed:', err)
  process.exit(1)
})
