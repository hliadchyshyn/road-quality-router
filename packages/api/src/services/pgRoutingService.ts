import { sql } from '../db/client.js'
import { qualityScore, edgeWeightMultiplier, qualityLabel } from '../scoring/aggregator.js'
import { config } from '../config.js'
import type { LatLon, RouteResult, RouteSegment } from './mockRouter.js'

// ── Cost expressions ──────────────────────────────────────────────────────────
// Each profile maps to a SQL expression embedded in the pgr_dijkstra text query.
// These are hardcoded constants — never derived from user input.

// Cost expressions reference routing_edges — a materialized view that
// pre-joins road_segments with latest quality_scores (no per-row LATERAL join).
// road_penalty multiplier (stored in routing_edges) strongly discourages
// pedestrian/cycle paths so car routing stays on actual roads.
const COST_EXPR: Record<string, string> = {
  quality:  `length_meters * (1.0 / GREATEST(5.0, quality_score)) * road_penalty`,
  shortest: `length_meters * road_penalty`,
  fastest:  `length_meters / GREATEST(10.0, COALESCE(speed_limit::float, 50.0)) * road_penalty`,
  balanced: `(length_meters * 0.5 + length_meters * (0.5 / GREATEST(5.0, quality_score))) * road_penalty`,
}

// ── Bbox helpers ──────────────────────────────────────────────────────────────

/** Axis-aligned bounding box expanded by `bufferDeg` degrees on every side. */
type Bbox = { minLon: number; minLat: number; maxLon: number; maxLat: number }

function routeBbox(origin: LatLon, destination: LatLon): Bbox {
  const minLon = Math.min(origin.lon, destination.lon)
  const maxLon = Math.max(origin.lon, destination.lon)
  const minLat = Math.min(origin.lat, destination.lat)
  const maxLat = Math.max(origin.lat, destination.lat)
  // Buffer: 30% of the larger span, minimum 0.05° (~5 km) on each side.
  // 0.05° keeps short-route bbox small (few edges); long routes get proportional padding.
  const buf = Math.max(0.05, Math.max(maxLon - minLon, maxLat - minLat) * 0.3)
  return { minLon: minLon - buf, minLat: minLat - buf, maxLon: maxLon + buf, maxLat: maxLat + buf }
}

/**
 * Build the SQL string passed to pgr_bdDijkstra.
 *
 * Uses routing_edges materialized view with a midpoint GiST index so only
 * edges whose centroid falls inside the route bounding box are loaded.
 * For a 440 km Kyiv→Sumy query this reduces 2.5 M edges to ~300 k.
 *
 * Low-quality roads are penalised by cost (GREATEST(5, quality_score)) rather
 * than blocked outright — blocking disconnects the graph for long routes.
 */
function buildCostQuery(profile: string, bbox: Bbox): string {
  const cost = COST_EXPR[profile] ?? COST_EXPR.quality
  return `
    SELECT id, source, target, ${cost} AS cost
    FROM routing_edges
    WHERE midpoint && ST_MakeEnvelope(
      ${bbox.minLon}, ${bbox.minLat},
      ${bbox.maxLon}, ${bbox.maxLat},
      4326
    )
  `
}

// ── Types ─────────────────────────────────────────────────────────────────────

type VertexRow = { id: number }

type RouteRow = {
  seq: number
  edge: number
  segmentId: string
  osmWayId: bigint | null
  name: string | null
  roadType: string
  surface: string
  speedLimit: number | null
  lengthMeters: number
  osmBaseScore: number
  dynamicPenalty: number
  accPenalty: number
  temporalPenalty: number
  finalScore: number
  geomJson: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Find the nearest well-connected pgRouting vertex to a lat/lon point.
 *
 * Uses road_segments_noded_vertices_pgr (vertices of the noded topology).
 * Strategy: fetch 200 geometrically-closest candidates via KNN, then keep
 * only vertices that have ≥ 1 car-road edge (road_penalty ≤ 2) in
 * routing_edges.  This avoids landing on isolated cycleway/footway islands
 * that have no path to the car road network.
 */
async function nearestVertex(lat: number, lon: number): Promise<number | null> {
  const rows = await sql<VertexRow[]>`
    WITH candidates AS (
      SELECT id, the_geom
      FROM road_segments_noded_vertices_pgr
      ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)
      LIMIT 200
    )
    SELECT c.id
    FROM candidates c
    WHERE (
      SELECT COUNT(*)
      FROM routing_edges
      WHERE (source = c.id OR target = c.id)
        AND road_penalty <= 2
    ) >= 1
    ORDER BY c.the_geom <-> ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)
    LIMIT 1
  `
  return rows[0]?.id ?? null
}

const ALL_PROFILES = ['quality', 'shortest', 'fastest', 'balanced'] as const

/**
 * Calculate all 4 profiles in parallel — vertices are found once and reused.
 * The frontend uses this to pre-cache all profiles so switching is instant.
 */
export async function pgRouteAll(
  origin:      LatLon,
  destination: LatLon,
): Promise<(RouteResult & { engine: string })[]> {
  // Find vertices once — shared across all 4 profile queries
  const [startId, endId] = await Promise.all([
    nearestVertex(origin.lat, origin.lon),
    nearestVertex(destination.lat, destination.lon),
  ])

  if (startId === null || endId === null || startId === endId) {
    return ALL_PROFILES.map((p) => ({ ...emptyRoute(p), engine: 'pgrouting-v1' }))
  }

  const bbox = routeBbox(origin, destination)

  return Promise.all(
    ALL_PROFILES.map((profile) => runRoute(startId, endId, bbox, profile)),
  )
}

async function runRoute(
  startId: number,
  endId:   number,
  bbox:    Bbox,
  profile: typeof ALL_PROFILES[number],
): Promise<RouteResult & { engine: string }> {
  const costQuery = buildCostQuery(profile, bbox)

  const rows = await sql<RouteRow[]>`
    SELECT
      r.seq,
      r.edge,
      rs.id                        AS segment_id,
      rs.osm_way_id,
      rs.name,
      rs.road_type,
      rs.surface,
      rs.speed_limit,
      re.length_meters,
      re.osm_base_score,
      re.dynamic_penalty,
      re.acc_penalty,
      re.temporal_penalty,
      re.quality_score             AS final_score,
      ST_AsGeoJSON(n.geom)::text   AS geom_json
    FROM pgr_bdDijkstra(
      ${costQuery}::text,
      ${startId}::bigint,
      ${endId}::bigint,
      false
    ) r
    JOIN routing_edges re          ON re.id     = r.edge
    JOIN road_segments_noded n     ON n.id      = r.edge
    JOIN road_segments rs          ON rs.seq_id = n.old_id
    WHERE r.edge != -1
    ORDER BY r.seq
  `

  if (rows.length === 0) return { ...emptyRoute(profile), engine: 'pgrouting-v1' }

  const segments: RouteSegment[] = rows.map((r) => {
    const score = qualityScore(r.osmBaseScore, r.dynamicPenalty, r.accPenalty, r.temporalPenalty)
    return {
      id: r.segmentId,
      osmWayId: r.osmWayId ? Number(r.osmWayId) : null,
      name: r.name,
      roadType: r.roadType,
      surface: r.surface,
      lengthMeters: r.lengthMeters,
      speedLimit: r.speedLimit,
      qualityScore: Math.round(score * 10) / 10,
      qualityLabel: qualityLabel(score),
      edgeWeight: edgeWeightMultiplier(score, config.ROUTING_ALPHA),
      geometry: JSON.parse(r.geomJson),
    }
  })

  const totalDistanceM  = segments.reduce((sum, s) => sum + s.lengthMeters, 0)
  const totalDurationMin = rows.reduce((sum, r) => {
    const speedKmh = r.speedLimit ?? 50
    return sum + (r.lengthMeters / 1000) / speedKmh * 60
  }, 0)
  const avgQuality      = segments.reduce((sum, s) => sum + s.qualityScore, 0) / segments.length
  const allCoords       = segments.flatMap((s) => s.geometry.coordinates)

  return {
    engine: 'pgrouting-v1',
    profile,
    distanceKm:  Math.round(totalDistanceM / 100) / 10,
    durationMin: Math.round(totalDurationMin),
    qualityIndex: Math.round(avgQuality * 10) / 10,
    segments,
    geometry: { type: 'LineString', coordinates: allCoords },
  }
}

function emptyRoute(profile: string): RouteResult {
  return {
    profile,
    distanceKm: 0,
    durationMin: 0,
    qualityIndex: 0,
    segments: [],
    geometry: { type: 'LineString', coordinates: [] },
  }
}
