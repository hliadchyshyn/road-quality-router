import { describe, it, expect } from 'vitest'
import { osmBaseScore } from './osmScorer.js'

describe('osmBaseScore', () => {
  it('motorway + asphalt = 95 (no penalty, no bonus for 1 lane)', () => {
    expect(osmBaseScore({ roadType: 'motorway', surface: 'asphalt', lanes: 1 })).toBe(95)
  })

  it('motorway + asphalt + 4 lanes = 100 (capped)', () => {
    expect(osmBaseScore({ roadType: 'motorway', surface: 'asphalt', lanes: 4 })).toBe(100)
  })

  it('residential + cobblestone = 52 - 18 = 34', () => {
    expect(osmBaseScore({ roadType: 'residential', surface: 'cobblestone' })).toBe(34)
  })

  it('track + unpaved = 30 - 30 = 0 (clamped to 0)', () => {
    expect(osmBaseScore({ roadType: 'track', surface: 'unpaved' })).toBe(0)
  })

  it('unknown road type falls back to base 50', () => {
    const score = osmBaseScore({ roadType: 'unknown_type', surface: 'asphalt' })
    expect(score).toBe(50)
  })

  it('unknown surface adds 10-point penalty (default)', () => {
    const score = osmBaseScore({ roadType: 'primary', surface: 'mystery_surface' })
    expect(score).toBe(82 - 10) // 72
  })

  it('null lanes treated as 1 (no bonus)', () => {
    const withNull = osmBaseScore({ roadType: 'secondary', surface: 'asphalt', lanes: null })
    const withOne  = osmBaseScore({ roadType: 'secondary', surface: 'asphalt', lanes: 1 })
    expect(withNull).toBe(withOne)
  })

  it('secondary + gravel = 74 - 25 = 49', () => {
    expect(osmBaseScore({ roadType: 'secondary', surface: 'gravel' })).toBe(49)
  })

  it('footway + sand is clamped to 0', () => {
    expect(osmBaseScore({ roadType: 'footway', surface: 'sand' })).toBe(0)
  })

  it('primary + concrete + 2 lanes = 82 - 2 + 2 = 82', () => {
    expect(osmBaseScore({ roadType: 'primary', surface: 'concrete', lanes: 2 })).toBe(82)
  })
})
