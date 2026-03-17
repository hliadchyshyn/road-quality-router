import type PgBoss from 'pg-boss'
import { fetchWazeEvents, storeWazeEvents } from '../services/wazeService.js'
import { updateAllQualityScores } from '../services/qualityUpdater.js'
import { sql } from '../db/client.js'
import { getBoss, JOB_NAME } from '../queue/index.js'

type Logger = {
  info(msg: string, ...args: unknown[]): void
  warn(msg: string, ...args: unknown[]): void
  error(msg: string, ...args: unknown[]): void
}

type WazeJobData = { bbox: string }

async function handleFetchWaze(job: PgBoss.Job<WazeJobData>): Promise<number> {
  const bbox = job.data.bbox
  let status: 'success' | 'error' | 'empty' = 'empty'
  let eventsStored = 0
  let segmentsUpdated = 0
  let errorMessage: string | undefined

  try {
    const events = await fetchWazeEvents(bbox)

    if (events.length > 0) {
      eventsStored = await storeWazeEvents(events)
      segmentsUpdated = await updateAllQualityScores()
      status = 'success'
    }
  } catch (err) {
    status = 'error'
    errorMessage = err instanceof Error ? err.message : String(err)
    throw err // rethrow so pg-boss marks the job as failed and retries
  } finally {
    await sql`
      INSERT INTO waze_fetch_log (status, events_stored, segments_updated, error_message, bbox)
      VALUES (${status}, ${eventsStored}, ${segmentsUpdated}, ${errorMessage ?? null}, ${bbox})
    `.catch(() => {
      // Non-fatal — don't mask the original error
    })
  }
  return eventsStored
}

/**
 * Register the Waze fetch worker with pg-boss.
 * Must be called after initQueue().
 */
export function startWazeWorker(logger?: Logger): void {
  const boss = getBoss()
  if (!boss) {
    logger?.warn('[waze] pg-boss not initialised — worker not started')
    return
  }

  // v10: handler receives Job[] (batch). batchSize:1 keeps one-at-a-time semantics.
  boss.work<WazeJobData>(JOB_NAME, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      const count = await handleFetchWaze(job)
      logger?.info(`[waze] fetch OK — ${count} events — job ${job.id}`)
    }
  })
}
