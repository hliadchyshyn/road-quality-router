import { z } from 'zod'
import 'dotenv/config'

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Scoring weights (penalty layer multipliers)
  WEIGHT_DYNAMIC: z.coerce.number().default(0.30),
  WEIGHT_ACCELEROMETER: z.coerce.number().default(0.20),
  WEIGHT_TEMPORAL: z.coerce.number().default(0.10),

  // Routing — edge_weight = base_time × (alpha / quality_score)
  ROUTING_ALPHA: z.coerce.number().default(1.0),

  // Phase 2: Waze LiveMap polling (job queue backed by PostgreSQL via pg-boss)
  WAZE_FETCH_INTERVAL_MINUTES: z.coerce.number().default(5),
  // bbox format: west,south,east,north (default: Greater Kyiv)
  WAZE_UKRAINE_BBOX: z.string().default('30.2,50.2,30.8,50.7'),
  // Waze LiveMap public API endpoint (row-* = Rest of World server)
  WAZE_API_URL: z.string().default('https://www.waze.com/row-rtserver/web/TGeoRSS'),
  // HTTP request timeout for Waze API calls (ms)
  WAZE_FETCH_TIMEOUT_MS: z.coerce.number().default(15_000),
})

const parsed = configSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment config:', parsed.error.format())
  process.exit(1)
}

export const config = parsed.data

export const scoringWeights = {
  dynamic: config.WEIGHT_DYNAMIC,
  accelerometer: config.WEIGHT_ACCELEROMETER,
  temporal: config.WEIGHT_TEMPORAL,
}
