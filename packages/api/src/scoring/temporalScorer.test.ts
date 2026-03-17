import { describe, it, expect } from 'vitest'
import { getTemporalPenalty } from './temporalScorer.js'

// SEASON_COEFF reference:
//   March=0.70 → penalty 30, April=0.65 → 35
//   July=1.00  → penalty 0,  August=1.00 → 0

describe('getTemporalPenalty', () => {
  it('July (coeff 1.0) → penalty 0', () => {
    expect(getTemporalPenalty(new Date('2025-07-15'))).toBe(0)
  })

  it('August (coeff 1.0) → penalty 0', () => {
    expect(getTemporalPenalty(new Date('2025-08-10'))).toBe(0)
  })

  it('April (coeff 0.65) → penalty 35 — post-thaw worst', () => {
    expect(getTemporalPenalty(new Date('2025-04-01'))).toBe(35)
  })

  it('March (coeff 0.70) → penalty 30 — thaw season', () => {
    expect(getTemporalPenalty(new Date('2025-03-20'))).toBe(30)
  })

  it('February (coeff 0.80) → penalty 20 — peak damage', () => {
    expect(getTemporalPenalty(new Date('2025-02-14'))).toBe(20)
  })

  it('January (coeff 0.85) → penalty 15', () => {
    expect(getTemporalPenalty(new Date('2025-01-01'))).toBe(15)
  })

  it('June (coeff 0.95) → penalty 5 — repair season starts', () => {
    expect(getTemporalPenalty(new Date('2025-06-01'))).toBe(5)
  })

  it('defaults to current date (smoke test — just returns a number 0–35)', () => {
    const penalty = getTemporalPenalty()
    expect(penalty).toBeGreaterThanOrEqual(0)
    expect(penalty).toBeLessThanOrEqual(35)
  })
})
