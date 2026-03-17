import { describe, it, expect } from 'vitest'
import { qualityScore, edgeWeightMultiplier, qualityLabel } from './aggregator.js'

// Default weights from config: dynamic=0.30, accelerometer=0.20, temporal=0.10

describe('qualityScore', () => {
  const w = { dynamic: 0.30, accelerometer: 0.20, temporal: 0.10 }

  it('perfect road — no penalties → returns osm_base unchanged', () => {
    expect(qualityScore(82, 0, 0, 0, w)).toBe(82)
  })

  it('applies weighted penalties correctly', () => {
    // 80 - 20×0.30 - 10×0.20 - 30×0.10 = 80 - 6 - 2 - 3 = 69
    expect(qualityScore(80, 20, 10, 30, w)).toBeCloseTo(69)
  })

  it('clamps to 0 when penalties exceed base', () => {
    expect(qualityScore(10, 100, 100, 100, w)).toBe(0)
  })

  it('clamps to 100 (osm_base cannot exceed 100)', () => {
    expect(qualityScore(100, 0, 0, 0, w)).toBe(100)
  })

  it('uses DEFAULT_WEIGHTS when not provided', () => {
    // Same as above but without explicit weights arg
    const score = qualityScore(80, 20, 10, 30)
    expect(score).toBeCloseTo(69)
  })

  it('fractional result is preserved (no premature rounding)', () => {
    // 75 - 10×0.30 = 75 - 3 = 72
    const score = qualityScore(75, 10, 0, 0, w)
    expect(score).toBe(72)
  })
})

describe('edgeWeightMultiplier', () => {
  it('quality 100 → weight 0.01 (alpha=1.0)', () => {
    expect(edgeWeightMultiplier(100, 1.0)).toBeCloseTo(0.01)
  })

  it('quality 50 → weight 0.02', () => {
    expect(edgeWeightMultiplier(50, 1.0)).toBeCloseTo(0.02)
  })

  it('quality 0 is clamped to MIN_QUALITY_SCORE=5, weight = 0.2', () => {
    expect(edgeWeightMultiplier(0, 1.0)).toBeCloseTo(0.2)
  })

  it('quality 3 (below MIN) → same as quality 5', () => {
    expect(edgeWeightMultiplier(3)).toBe(edgeWeightMultiplier(5))
  })

  it('higher alpha → proportionally higher weight', () => {
    const w1 = edgeWeightMultiplier(50, 1.0)
    const w2 = edgeWeightMultiplier(50, 2.0)
    expect(w2).toBeCloseTo(w1 * 2)
  })

  it('bad road has higher weight than good road → router avoids it', () => {
    const goodRoad = edgeWeightMultiplier(90)
    const badRoad  = edgeWeightMultiplier(20)
    expect(badRoad).toBeGreaterThan(goodRoad)
  })
})

describe('qualityLabel', () => {
  it.each([
    [100, 'excellent'],
    [80,  'excellent'],
    [79,  'good'],
    [60,  'good'],
    [59,  'fair'],
    [40,  'fair'],
    [39,  'poor'],
    [20,  'poor'],
    [19,  'critical'],
    [0,   'critical'],
  ])('score %i → "%s"', (score, label) => {
    expect(qualityLabel(score)).toBe(label)
  })
})
