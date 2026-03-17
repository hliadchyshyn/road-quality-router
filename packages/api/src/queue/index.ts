import PgBoss from 'pg-boss'
import { config } from '../config.js'

export const JOB_NAME = 'fetch-waze'

let boss: PgBoss | null = null

export function getBoss(): PgBoss | null {
  return boss
}

/**
 * Initialise pg-boss and schedule the recurring Waze fetch job.
 *
 * pg-boss auto-creates the `pgboss` schema on first start — no manual
 * migration needed. Jobs survive API restarts and are visible via:
 *   SELECT * FROM pgboss.job WHERE name = 'fetch-waze';
 */
export async function initQueue(): Promise<void> {
  boss = new PgBoss({
    connectionString: config.DATABASE_URL,
    // Retain completed jobs for 3 days, failed jobs for 7 days
    archiveCompletedAfterSeconds: 3 * 24 * 3600,
    deleteAfterDays: 7,
  })

  boss.on('error', (err: unknown) => console.error('[pg-boss] error:', err))

  await boss.start()

  // pg-boss v10: queue must exist before schedule() or work()
  await boss.createQueue(JOB_NAME)

  // Schedule recurring cron job — pg-boss deduplicates by name
  const cronExpr = `*/${config.WAZE_FETCH_INTERVAL_MINUTES} * * * *`
  await boss.schedule(JOB_NAME, cronExpr, { bbox: config.WAZE_UKRAINE_BBOX })

  // Also send an immediate one-off job on startup
  await boss.send(JOB_NAME, { bbox: config.WAZE_UKRAINE_BBOX }, { singletonKey: 'boot' })
}

export async function closeQueue(): Promise<void> {
  await boss?.stop()
  boss = null
}
