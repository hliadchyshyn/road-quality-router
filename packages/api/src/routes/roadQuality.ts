import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sql } from '../db/client.js'
import { qualityLabel } from '../scoring/aggregator.js'

const RoadQualityQuerySchema = z.object({
  // bbox=west,south,east,north  (same as Mapbox convention)
  bbox: z
    .string()
    .regex(/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/, 'Format: west,south,east,north')
    .optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(50).max(50000).default(500),
  min_score: z.coerce.number().min(0).max(100).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

export async function roadQualityRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/road-quality
   * Returns road segment quality as GeoJSON FeatureCollection.
   * Supports two modes:
   *   - ?bbox=W,S,E,N            — bounding box query
   *   - ?lat=X&lon=Y&radius=500  — radius query (meters)
   */
  app.get<{ Querystring: z.infer<typeof RoadQualityQuerySchema> }>(
    '/api/v1/road-quality',
    async (req, reply) => {
      const parsed = RoadQualityQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error.format() })
      }

      const { bbox, lat, lon, radius, min_score, limit } = parsed.data

      if (!bbox && (lat === undefined || lon === undefined)) {
        return reply
          .status(400)
          .send({ error: 'Provide either bbox= or lat=&lon= parameters' })
      }

      type SegmentRow = {
        id: string
        osmWayId: bigint | null
        name: string | null
        roadType: string
        surface: string
        lengthMeters: number
        finalScore: number
        osmBaseScore: number
        dynamicPenalty: number
        computedAt: string
        geomJson: string
      }

      let segments: SegmentRow[]

      if (bbox) {
        const [west, south, east, north] = bbox.split(',').map(Number)
        segments = await sql<SegmentRow[]>`
          SELECT
            rs.id,
            rs.osm_way_id,
            rs.name,
            rs.road_type,
            rs.surface,
            rs.length_meters,
            qs.final_score,
            qs.osm_base_score,
            qs.dynamic_penalty,
            qs.computed_at,
            ST_AsGeoJSON(rs.geom)::text AS geom_json
          FROM road_segments rs
          JOIN LATERAL (
            SELECT * FROM quality_scores
            WHERE segment_id = rs.id
            ORDER BY computed_at DESC
            LIMIT 1
          ) qs ON true
          WHERE ST_Intersects(rs.geom, ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326))
            AND qs.final_score >= ${min_score}
          LIMIT ${limit}
        `
      } else {
        segments = await sql<SegmentRow[]>`
          SELECT
            rs.id,
            rs.osm_way_id,
            rs.name,
            rs.road_type,
            rs.surface,
            rs.length_meters,
            qs.final_score,
            qs.osm_base_score,
            qs.dynamic_penalty,
            qs.computed_at,
            ST_AsGeoJSON(rs.geom)::text AS geom_json
          FROM road_segments rs
          JOIN LATERAL (
            SELECT * FROM quality_scores
            WHERE segment_id = rs.id
            ORDER BY computed_at DESC
            LIMIT 1
          ) qs ON true
          WHERE ST_DWithin(
            rs.geom::geography,
            ST_SetSRID(ST_MakePoint(${lon!}, ${lat!}), 4326)::geography,
            ${radius}
          )
            AND qs.final_score >= ${min_score}
          ORDER BY rs.geom::geography <-> ST_SetSRID(ST_MakePoint(${lon!}, ${lat!}), 4326)::geography
          LIMIT ${limit}
        `
      }

      const geojson = {
        type: 'FeatureCollection' as const,
        features: segments.map((s) => ({
          type: 'Feature' as const,
          properties: {
            id: s.id,
            osmWayId: s.osmWayId ? Number(s.osmWayId) : null,
            name: s.name,
            roadType: s.roadType,
            surface: s.surface,
            lengthMeters: s.lengthMeters,
            qualityScore: Math.round(s.finalScore * 10) / 10,
            qualityLabel: qualityLabel(s.finalScore),
            osmBaseScore: Math.round(s.osmBaseScore * 10) / 10,
            dynamicPenalty: Math.round(s.dynamicPenalty * 10) / 10,
            lastUpdated: s.computedAt,
          },
          geometry: JSON.parse(s.geomJson),
        })),
      }

      return reply.send(geojson)
    },
  )
}
