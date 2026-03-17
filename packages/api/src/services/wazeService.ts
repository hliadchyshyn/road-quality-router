import { sql } from '../db/client.js'
import { WAZE_EVENT_PENALTY, WAZE_EVENT_TTL_HOURS } from '../scoring/constants.js'
import { config } from '../config.js'

// ── Waze LiveMap API types ────────────────────────────────────────────────────

interface WazeLocation {
  x: number // longitude
  y: number // latitude
}

interface WazeAlert {
  uuid: string
  type: string
  subtype?: string
  location: WazeLocation
  pubMillis: number
  severity?: number
}

interface WazeJam {
  uuid: string
  level?: number
  severity?: number
  line: WazeLocation[]
}

interface WazeApiResponse {
  alerts?: WazeAlert[]
  jams?: WazeJam[]
}

// ── Normalise Waze type to our event taxonomy ─────────────────────────────────

function normalizeType(type: string, subtype?: string): string | null {
  if (type === 'HAZARD' && subtype?.includes('POT_HOLE')) return 'POTHOLE'
  if (type === 'HAZARD') return 'HAZARD'
  if (type === 'ACCIDENT') return 'ACCIDENT'
  if (type === 'JAM') return 'JAM'
  if (type === 'ROAD_CLOSED') return 'ROAD_CLOSED'
  return null // unknown type — skip
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface WazeEventInsert {
  type: string
  lon: number
  lat: number
  severity: number
  reportedAt: Date
  expiresAt: Date | null
  wazeUuid: string
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Fetch active alerts and jams from the Waze LiveMap public API
 * for the given bounding box (west,south,east,north).
 */
export async function fetchWazeEvents(bbox: string): Promise<WazeEventInsert[]> {
  const [west, south, east, north] = bbox.split(',').map(Number)

  const url = new URL(config.WAZE_API_URL)
  url.searchParams.set('tk', 'community')
  url.searchParams.set('format', 'JSON')
  url.searchParams.set('types', 'alerts,traffic')
  url.searchParams.set('left', String(west))
  url.searchParams.set('right', String(east))
  url.searchParams.set('top', String(north))
  url.searchParams.set('bottom', String(south))
  url.searchParams.set('zoom', '6')

  const resp = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'RoadQualityRouter/2.0',
      Accept: 'application/json',
      Referer: 'https://www.waze.com/live-map',
    },
    signal: AbortSignal.timeout(config.WAZE_FETCH_TIMEOUT_MS),
  })

  if (!resp.ok) {
    throw new Error(`Waze API HTTP ${resp.status}: ${resp.statusText}`)
  }

  const contentType = resp.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(`Waze returned non-JSON response (content-type: ${contentType})`)
  }

  const data = await resp.json() as WazeApiResponse
  const events: WazeEventInsert[] = []

  // ── Alerts (potholes, accidents, hazards, road closures) ──────────────────
  for (const alert of data.alerts ?? []) {
    const type = normalizeType(alert.type, alert.subtype)
    if (!type || !(type in WAZE_EVENT_PENALTY)) continue

    const reportedAt = new Date(alert.pubMillis)
    const ttlHours = WAZE_EVENT_TTL_HOURS[type] ?? 24
    const expiresAt =
      ttlHours === -1 ? null : new Date(reportedAt.getTime() + ttlHours * 3_600_000)

    events.push({
      type,
      lon: alert.location.x,
      lat: alert.location.y,
      severity: alert.severity ?? 1,
      reportedAt,
      expiresAt,
      wazeUuid: alert.uuid,
    })
  }

  // ── Jams (traffic congestion) — use midpoint of jam polyline ──────────────
  for (const jam of data.jams ?? []) {
    if (!jam.line?.length || !jam.uuid) continue

    const mid = jam.line[Math.floor(jam.line.length / 2)]
    const now = new Date()
    const ttlHours = WAZE_EVENT_TTL_HOURS['JAM']
    const expiresAt = new Date(now.getTime() + ttlHours * 3_600_000)

    events.push({
      type: 'JAM',
      lon: mid.x,
      lat: mid.y,
      severity: jam.severity ?? jam.level ?? 1,
      reportedAt: now,
      expiresAt,
      wazeUuid: jam.uuid,
    })
  }

  return events
}

// ── Store ─────────────────────────────────────────────────────────────────────

/**
 * Upsert waze events into the database.
 * Removes expired events first, then inserts/updates by waze_uuid.
 *
 * @returns number of rows inserted or updated
 */
export async function storeWazeEvents(events: WazeEventInsert[]): Promise<number> {
  await sql`DELETE FROM waze_events WHERE expires_at IS NOT NULL AND expires_at < NOW()`

  if (events.length === 0) return 0

  const types       = events.map(e => e.type)
  const lons        = events.map(e => e.lon)
  const lats        = events.map(e => e.lat)
  const severities  = events.map(e => e.severity)
  const reportedAts = events.map(e => e.reportedAt)
  const expiresAts  = events.map(e => e.expiresAt)
  const uuids       = events.map(e => e.wazeUuid)

  await sql`
    INSERT INTO waze_events (type, geom, severity, reported_at, expires_at, waze_uuid)
    SELECT
      unnest(${types}::text[]),
      ST_SetSRID(ST_MakePoint(
        unnest(${lons}::float8[]),
        unnest(${lats}::float8[])
      ), 4326),
      unnest(${severities}::int[]),
      unnest(${reportedAts}::timestamptz[]),
      unnest(${expiresAts}::timestamptz[]),
      unnest(${uuids}::text[])
    ON CONFLICT (waze_uuid) DO UPDATE SET
      type       = EXCLUDED.type,
      severity   = EXCLUDED.severity,
      expires_at = EXCLUDED.expires_at
  `

  return events.length
}
