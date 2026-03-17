import { ROAD_TYPE_BASE, SURFACE_PENALTY, LANES_BONUS } from './constants.js'

export interface OsmSegmentInput {
  roadType: string
  surface: string
  lanes?: number | null
}

/**
 * Layer 1: compute OSM-based quality score (0–100).
 * Formula: base_by_road_type - surface_penalty + lanes_bonus
 */
export function osmBaseScore(segment: OsmSegmentInput): number {
  const base = ROAD_TYPE_BASE[segment.roadType] ?? 50
  const surfacePen = SURFACE_PENALTY[segment.surface] ?? 10
  const laneBonus = LANES_BONUS[segment.lanes ?? 1] ?? 0

  return Math.min(100, Math.max(0, base - surfacePen + laneBonus))
}
