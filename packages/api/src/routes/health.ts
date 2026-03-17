import type { FastifyInstance } from 'fastify'
import { sql } from '../db/client.js'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_req, reply) => {
    try {
      await sql`SELECT 1`
      return reply.send({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() })
    } catch {
      return reply.status(503).send({ status: 'error', db: 'unreachable' })
    }
  })
}
