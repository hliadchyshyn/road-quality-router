/**
 * Phase 3: Bulk OSM scoring
 *
 * Transforms raw osm_ways (written by osm2pgsql) into:
 *   1. road_segments  — processed geometry + metadata
 *   2. quality_scores — initial osm_base_score for every segment
 *
 * Uses pure SQL with VALUES-based lookup tables that mirror the TypeScript
 * constants in scoring/constants.ts. Processing 2.1M rows takes ~2-5 min.
 *
 * Run: make calc-scores   (after make osm-import)
 */

import postgres from 'postgres'
import 'dotenv/config'

const DATABASE_URL = process.env.DATABASE_URL!
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const sql = postgres(DATABASE_URL, { max: 1 })

async function calcScores() {
  // ── Step 1: count source rows ────────────────────────────────────────────
  const [{ total }] = await sql<[{ total: string }]>`
    SELECT COUNT(*)::text AS total FROM osm_ways
  `
  if (Number(total) === 0) {
    console.error('osm_ways is empty — run `make osm-import` first.')
    process.exit(1)
  }
  console.log(`Processing ${Number(total).toLocaleString()} OSM road segments...`)

  // ── Step 2: upsert road_segments from osm_ways ───────────────────────────
  // ST_Length(geom::geography) returns metres — no Haversine needed.
  console.log('  [1/2] Upserting road_segments...')
  const t1 = Date.now()

  const { count: segCount } = await sql`
    INSERT INTO road_segments
      (osm_way_id, geom, road_type, surface, name, length_meters, speed_limit)
    SELECT
      osm_way_id,
      geom,
      highway                          AS road_type,
      COALESCE(surface, 'unknown')     AS surface,
      name,
      ST_Length(geom::geography)       AS length_meters,
      maxspeed                         AS speed_limit
    FROM osm_ways
    ON CONFLICT (osm_way_id) DO UPDATE SET
      geom          = EXCLUDED.geom,
      road_type     = EXCLUDED.road_type,
      surface       = EXCLUDED.surface,
      name          = EXCLUDED.name,
      length_meters = EXCLUDED.length_meters,
      speed_limit   = EXCLUDED.speed_limit
  `
  console.log(`  ✓ road_segments: ${Number(segCount).toLocaleString()} rows (${Date.now() - t1}ms)`)

  // ── Step 3: insert initial quality_scores (skip already-scored segments) ─
  // SQL VALUES mirrors ROAD_TYPE_BASE, SURFACE_PENALTY, LANES_BONUS constants.
  console.log('  [2/2] Calculating osm_base_score...')
  const t2 = Date.now()

  const { count: scoreCount } = await sql`
    WITH
      road_type_base (road_type, base) AS (VALUES
        ('motorway',       95),
        ('motorway_link',  90),
        ('trunk',          88),
        ('trunk_link',     84),
        ('primary',        82),
        ('primary_link',   78),
        ('secondary',      74),
        ('secondary_link', 70),
        ('tertiary',       65),
        ('tertiary_link',  62),
        ('unclassified',   58),
        ('residential',    52),
        ('living_street',  45),
        ('service',        42),
        ('track',          30),
        ('path',           20),
        ('footway',        15)
      ),
      surface_penalty (surface, penalty) AS (VALUES
        ('asphalt',        0),
        ('concrete',       2),
        ('paving_stones',  8),
        ('sett',          10),
        ('cobblestone',   18),
        ('compacted',     12),
        ('gravel',        25),
        ('fine_gravel',   20),
        ('unpaved',       30),
        ('dirt',          35),
        ('ground',        38),
        ('grass',         45),
        ('sand',          50),
        ('unknown',       10)
      ),
      lanes_bonus (lanes, bonus) AS (VALUES
        (1, 0),
        (2, 2),
        (3, 4),
        (4, 6)
      )
    INSERT INTO quality_scores
      (segment_id, osm_base_score, dynamic_penalty, acc_penalty, temporal_penalty)
    SELECT
      rs.id,
      LEAST(100, GREATEST(0,
        COALESCE(rt.base,    50)
        - COALESCE(sp.penalty, 10)
        + COALESCE(lb.bonus,   0)
      )) AS osm_base_score,
      0, 0, 0
    FROM road_segments rs
    JOIN osm_ways ow ON ow.osm_way_id = rs.osm_way_id
    LEFT JOIN road_type_base  rt ON rt.road_type = ow.highway
    LEFT JOIN surface_penalty sp ON sp.surface   = ow.surface
    LEFT JOIN lanes_bonus     lb ON lb.lanes      = LEAST(4, COALESCE(ow.lanes, 1))
    WHERE NOT EXISTS (
      SELECT 1 FROM quality_scores qs WHERE qs.segment_id = rs.id
    )
  `
  console.log(`  ✓ quality_scores: ${Number(scoreCount).toLocaleString()} rows (${Date.now() - t2}ms)`)

  console.log('Done. Run `make topology` to build the pgRouting graph.')
  await sql.end()
}

calcScores().catch((err) => {
  console.error('calcScores failed:', err)
  process.exit(1)
})
