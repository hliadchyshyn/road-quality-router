import { MIN_QUALITY_SCORE } from './constants.js'
import { scoringWeights } from '../config.js'

export interface ScoringWeights {
  dynamic: number
  accelerometer: number
  temporal: number
}

/**
 * Final quality score formula from specification:
 *   score = clamp(osm_base - dynamic_penalty×w_dyn - acc_penalty×w_acc - temporal_penalty×w_temp, 0, 100)
 *
 * @returns float 0–100 (0 = unpassable, 100 = perfect)
 */
export function qualityScore(
  osmBase: number,
  dynamicPenalty = 0,
  accPenalty = 0,
  temporalPenalty = 0,
  weights: ScoringWeights = scoringWeights,
): number {
  const raw =
    osmBase -
    dynamicPenalty * weights.dynamic -
    accPenalty * weights.accelerometer -
    temporalPenalty * weights.temporal

  return Math.min(100, Math.max(0, raw))
}

/**
 * Convert quality score to Valhalla-style edge weight multiplier.
 * edge_weight = base_time × (alpha / quality_score)
 * Lower quality → higher weight → router avoids the segment.
 */
export function edgeWeightMultiplier(qualScore: number, alpha = 1.0): number {
  const clampedScore = Math.max(MIN_QUALITY_SCORE, qualScore)
  return alpha / clampedScore
}

/**
 * Human-readable quality label.
 */
export function qualityLabel(score: number): string {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'fair'
  if (score >= 20) return 'poor'
  return 'critical'
}
