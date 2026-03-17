/**
 * Refresh the routing_edges materialized view.
 * Run after: make calc-scores, or when Waze/accelerometer scores change.
 *
 * Uses CONCURRENTLY so the view remains queryable during refresh.
 * Requires a unique index — added automatically (routing_edges_id_idx).
 */
import postgres from 'postgres'
import 'dotenv/config'

const DATABASE_URL = process.env.DATABASE_URL!
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const sql = postgres(DATABASE_URL, { max: 1 })

async function refresh() {
  console.log('Refreshing routing_edges materialized view...')
  const t = Date.now()
  await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY routing_edges`
  const [{ count }] = await sql<[{ count: string }]>`
    SELECT COUNT(*)::text AS count FROM routing_edges
  `
  console.log(`  ✓ ${Number(count).toLocaleString()} edges ready (${Date.now() - t}ms)`)
  await sql.end()
}

refresh().catch((err) => {
  console.error('Refresh failed:', err)
  process.exit(1)
})
