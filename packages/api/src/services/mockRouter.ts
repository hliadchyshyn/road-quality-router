import type { LineString } from 'geojson'
import { sql } from '../db/client.js'
import { qualityScore, edgeWeightMultiplier, qualityLabel } from '../scoring/aggregator.js'
import { config } from '../config.js'

export interface LatLon {
  lat: number
  lon: number
}

export interface RouteSegment {
  id: string
  osmWayId: number | null
  name: string | null
  roadType: string
  surface: string
  lengthMeters: number
  speedLimit: number | null
  qualityScore: number
  qualityLabel: string
  edgeWeight: number
  geometry: LineString
}

export interface RouteResult {
  profile: string
  distanceKm: number
  durationMin: number
  qualityIndex: number
  segments: RouteSegment[]
  geometry: LineString
}

type SegmentRow = {
  id: string
  osmWayId: bigint | null
  name: string | null
  roadType: string
  surface: string
  lengthMeters: number
  speedLimit: number | null
  osmBaseScore: number
  dynamicPenalty: number
  accPenalty: number
  temporalPenalty: number
  finalScore: number
  geomJson: string
}

/**
 * Phase 1 mock router: finds road segments within a bounding box between
 * origin and destination, returns them ordered by the chosen profile.
 * Simulates routing without a real graph engine (Valhalla comes in Phase 3).
 */
export async function mockRoute(
  origin: LatLon,
  destination: LatLon,
  profile: 'quality' | 'fastest' | 'shortest' | 'balanced' = 'quality',
): Promise<RouteResult> {
  const minLat = Math.min(origin.lat, destination.lat)
  const maxLat = Math.max(origin.lat, destination.lat)
  const minLon = Math.min(origin.lon, destination.lon)
  const maxLon = Math.max(origin.lon, destination.lon)
  const padLat = (maxLat - minLat) * 0.3 + 0.01
  const padLon = (maxLon - minLon) * 0.3 + 0.01

  // Build ORDER BY based on profile (cannot use parameterized CASE branch so we select the right query)
  let segments: SegmentRow[]

  const baseQuery = (orderExpr: string) => sql<SegmentRow[]>`
    SELECT
      rs.id,
      rs.osm_way_id,
      rs.name,
      rs.road_type,
      rs.surface,
      rs.length_meters,
      rs.speed_limit,
      qs.osm_base_score,
      qs.dynamic_penalty,
      qs.acc_penalty,
      qs.temporal_penalty,
      qs.final_score,
      ST_AsGeoJSON(rs.geom)::text AS geom_json
    FROM road_segments rs
    JOIN LATERAL (
      SELECT * FROM quality_scores
      WHERE segment_id = rs.id
      ORDER BY computed_at DESC
      LIMIT 1
    ) qs ON true
    WHERE ST_Intersects(
      rs.geom,
      ST_MakeEnvelope(
        ${minLon - padLon},
        ${minLat - padLat},
        ${maxLon + padLon},
        ${maxLat + padLat},
        4326
      )
    )
    ORDER BY ${sql.unsafe(orderExpr)}
    LIMIT 20
  `

  const orderMap: Record<string, string> = {
    quality:  'qs.final_score DESC',
    fastest:  'rs.length_meters / GREATEST(rs.speed_limit::float, 30.0) ASC',
    shortest: 'rs.length_meters ASC',
    balanced: 'rs.length_meters * 0.5 + (100 - qs.final_score) * 10 ASC',
  }

  segments = await baseQuery(orderMap[profile] ?? orderMap.quality)

  if (segments.length === 0) {
    return emptyRoute(profile)
  }

  const routeSegments: RouteSegment[] = segments.map((s) => {
    const score = qualityScore(s.osmBaseScore, s.dynamicPenalty, s.accPenalty, s.temporalPenalty)
    return {
      id: s.id,
      osmWayId: s.osmWayId ? Number(s.osmWayId) : null,
      name: s.name,
      roadType: s.roadType,
      surface: s.surface,
      lengthMeters: s.lengthMeters,
      speedLimit: s.speedLimit,
      qualityScore: Math.round(score * 10) / 10,
      qualityLabel: qualityLabel(score),
      edgeWeight: edgeWeightMultiplier(score, config.ROUTING_ALPHA),
      geometry: JSON.parse(s.geomJson) as LineString,
    }
  })

  const totalDistanceM = routeSegments.reduce((sum, s) => sum + s.lengthMeters, 0)
  const totalDurationMin = routeSegments.reduce((sum, s) => {
    const speedKmh = s.speedLimit ?? 50
    return sum + (s.lengthMeters / 1000) / speedKmh * 60
  }, 0)
  const avgQuality = routeSegments.reduce((sum, s) => sum + s.qualityScore, 0) / routeSegments.length
  const allCoords = routeSegments.flatMap((s) => s.geometry.coordinates)
  const mergedGeometry: LineString = { type: 'LineString', coordinates: allCoords }

  return {
    profile,
    distanceKm: Math.round(totalDistanceM / 100) / 10,
    durationMin: Math.round(totalDurationMin),
    qualityIndex: Math.round(avgQuality * 10) / 10,
    segments: routeSegments,
    geometry: mergedGeometry,
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
