// ── Layer 1: OSM static scoring ───────────────────────────────────────────────

/** Base score (0-100) per highway type. Higher = better road quality. */
export const ROAD_TYPE_BASE: Record<string, number> = {
  motorway:     95,
  motorway_link:90,
  trunk:        88,
  trunk_link:   84,
  primary:      82,
  primary_link: 78,
  secondary:    74,
  secondary_link:70,
  tertiary:     65,
  tertiary_link: 62,
  unclassified:  58,
  residential:   52,
  living_street: 45,
  service:       42,
  track:         30,
  path:          20,
  footway:       15,
}

/** Points subtracted from base score based on surface type. */
export const SURFACE_PENALTY: Record<string, number> = {
  asphalt:       0,
  concrete:      2,
  paving_stones: 8,
  sett:         10,
  cobblestone:  18,
  compacted:    12,
  gravel:       25,
  fine_gravel:  20,
  unpaved:      30,
  dirt:         35,
  ground:       38,
  grass:        45,
  sand:         50,
  unknown:      10,
}

/** Bonus points for multiple lanes (better maintained roads tend to have more lanes). */
export const LANES_BONUS: Record<number, number> = {
  1: 0,
  2: 2,
  3: 4,
  4: 6,
}

// ── Layer 2: Waze dynamic penalties ───────────────────────────────────────────

export const WAZE_EVENT_PENALTY: Record<string, number> = {
  POTHOLE:     15,
  ACCIDENT:    20,
  ROAD_CLOSED: 25,
  HAZARD:      12,
  JAM:          5,
}

export const WAZE_EVENT_TTL_HOURS: Record<string, number> = {
  POTHOLE:     720,  // 30 days
  ACCIDENT:    -1,   // until removed
  ROAD_CLOSED: -1,   // until removed
  HAZARD:      168,  // 7 days
  JAM:           1,
}

// ── Layer 4: Temporal/seasonal coefficients ────────────────────────────────────
// Ukraine seasonal road quality (1=best, lower=worse due to freeze/thaw cycles)

export const SEASON_COEFF: Record<number, number> = {
  1:  0.85,  // January   — post-winter, potholes common
  2:  0.80,  // February  — peak damage
  3:  0.70,  // March     — thaw, worst condition
  4:  0.65,  // April     — post-winter season
  5:  0.85,  // May       — repairs start
  6:  0.95,  // June      — repair season
  7:  1.00,  // July      — best condition
  8:  1.00,  // August
  9:  0.95,  // September
  10: 0.90,  // October
  11: 0.85,  // November  — weather worsening
  12: 0.85,  // December
}

// ── Scoring weights ────────────────────────────────────────────────────────────

export const DEFAULT_WEIGHTS = {
  dynamic:      0.30,
  accelerometer:0.20,
  temporal:     0.10,
}

/** Road segments with score below this are avoided by the router. */
export const MIN_ROUTABLE_SCORE = 10

/** Minimum quality_score to prevent division-by-zero in edge weight formula. */
export const MIN_QUALITY_SCORE = 5
