import Fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from './config.js'
import { checkDbConnection } from './db/client.js'
import { healthRoutes } from './routes/health.js'
import { routeRoutes } from './routes/route.js'
import { roadQualityRoutes } from './routes/roadQuality.js'
import { initQueue, closeQueue } from './queue/index.js'
import { startWazeWorker } from './workers/wazeWorker.js'

const app = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    ...(config.NODE_ENV === 'development' && {
      transport: { target: 'pino-pretty', options: { colorize: true } },
    }),
  },
})

async function start() {
  await app.register(cors, {
    origin: true,  // API is behind reverse proxy in production; let the proxy handle CORS
  })

  await app.register(healthRoutes)
  await app.register(routeRoutes)
  await app.register(roadQualityRoutes)

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ error: 'Not found' })
  })

  try {
    await checkDbConnection()
    app.log.info('Database connection OK')
  } catch (err) {
    app.log.error({ err }, 'Cannot connect to database')
    process.exit(1)
  }

  // Phase 2: Waze job queue (backed by PostgreSQL — no Redis needed)
  await initQueue()
  startWazeWorker(app.log)
  app.log.info(
    `Waze update queue started (interval: ${config.WAZE_FETCH_INTERVAL_MINUTES}m, bbox: ${config.WAZE_UKRAINE_BBOX})`,
  )

  await app.listen({ port: config.PORT, host: '0.0.0.0' })
  app.log.info(`Road Quality Router API listening on port ${config.PORT}`)
}

async function shutdown() {
  app.log.info('Shutting down...')
  await closeQueue()
  await app.close()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
