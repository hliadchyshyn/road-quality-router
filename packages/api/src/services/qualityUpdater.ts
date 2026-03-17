import { sql } from '../db/client.js'
import { getTemporalPenalty } from '../scoring/temporalScorer.js'
import { WAZE_EVENT_PENALTY } from '../scoring/constants.js'

/**
 * Recalculate quality_scores for ALL road segments using:
 *   - Layer 2: dynamic_penalty from active Waze events within 250 m
 *     (sum of max penalty per distinct event type)
 *   - Layer 4: temporal_penalty from current seasonal coefficient
 *   - Layer 1: osm_base_score carried forward from latest existing row
 *   - Layer 3: acc_penalty carried forward (accelerometer data, Phase 3+)
 *
 * Inserts new quality_scores rows (append-only history).
 *
 * @returns number of segments updated
 */
export async function updateAllQualityScores(): Promise<number> {
  const temporalPenalty = getTemporalPenalty()

  // Build CASE expression dynamically from the shared WAZE_EVENT_PENALTY constant
  const penaltyCaseExpr = Object.entries(WAZE_EVENT_PENALTY)
    .map(([type, penalty]) => `WHEN '${type}' THEN ${penalty}`)
    .join('\n          ')

  const result = await sql.unsafe(`
    INSERT INTO quality_scores
      (segment_id, osm_base_score, dynamic_penalty, acc_penalty, temporal_penalty)
    SELECT
      rs.id                                   AS segment_id,
      COALESCE(latest.osm_base_score, 50)     AS osm_base_score,
      COALESCE(waze_agg.dynamic_penalty, 0)   AS dynamic_penalty,
      COALESCE(latest.acc_penalty, 0)         AS acc_penalty,
      $1::float                               AS temporal_penalty
    FROM road_segments rs

    LEFT JOIN LATERAL (
      SELECT osm_base_score, acc_penalty
      FROM quality_scores qs
      WHERE qs.segment_id = rs.id
      ORDER BY computed_at DESC
      LIMIT 1
    ) latest ON true

    LEFT JOIN LATERAL (
      SELECT SUM(max_penalty) AS dynamic_penalty
      FROM (
        SELECT MAX(
          CASE we.type
          ${penaltyCaseExpr}
          ELSE 0
          END
        ) AS max_penalty
        FROM waze_events we
        WHERE ST_DWithin(we.geom::geography, rs.geom::geography, 250)
          AND (we.expires_at IS NULL OR we.expires_at > NOW())
        GROUP BY we.type
      ) per_type
    ) waze_agg ON true

    WHERE latest.osm_base_score IS NOT NULL
  `, [temporalPenalty])

  return result.count
}
