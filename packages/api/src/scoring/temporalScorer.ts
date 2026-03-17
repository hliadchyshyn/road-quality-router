import { SEASON_COEFF } from './constants.js'

/**
 * Layer 4: Temporal/seasonal penalty (0–35).
 *
 * Uses Ukraine seasonal road quality coefficients (SEASON_COEFF).
 * coeff = 1.0 (July/August) → penalty 0
 * coeff = 0.65 (April, worst post-thaw) → penalty 35
 *
 * Formula: penalty = round((1 - coeff) * 100)
 */
export function getTemporalPenalty(date = new Date()): number {
  const month = date.getMonth() + 1 // 1–12
  const coeff = SEASON_COEFF[month] ?? 1.0
  return Math.round((1 - coeff) * 100)
}
