import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { pgRouteAll } from '../services/pgRoutingService.js'
import { mockRoute }  from '../services/mockRouter.js'
import { config }     from '../config.js'

const RouteRequestSchema = z.object({
  origin: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  destination: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  // profile is accepted for API compatibility but all 4 are always calculated
  profile: z.enum(['quality', 'fastest', 'shortest', 'balanced']).default('quality'),
})

export async function routeRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/route
   *
   * Always calculates all 4 profiles in parallel (vertices found once, 4 queries
   * run concurrently).  The client receives all routes and can switch profiles
   * instantly without a second request.
   */
  app.post<{ Body: z.infer<typeof RouteRequestSchema> }>('/api/v1/route', async (req, reply) => {
    const parsed = RouteRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.format() })
    }

    const { origin, destination } = parsed.data

    try {
      const results = await pgRouteAll(origin, destination)
      const routes  = results.filter((r) => r.segments.length > 0)
      const engine  = routes[0]?.engine ?? 'pgrouting-v1'

      if (routes.length === 0) {
        app.log.warn('pgRouting found no path — falling back to mock router')
        const mock = await mockRoute(origin, destination, 'quality')
        return reply.send({
          routes: mock.segments.length > 0 ? [mock] : [],
          meta: { engine: 'mock-router-v1', alpha: config.ROUTING_ALPHA },
        })
      }

      return reply.send({
        routes,
        meta: { engine, alpha: config.ROUTING_ALPHA },
      })
    } catch (err) {
      const isTopologyMissing =
        err instanceof Error && (
          err.message.includes('road_segments_vertices_pgr') ||
          err.message.includes('road_segments_noded')
        )

      if (isTopologyMissing) {
        app.log.warn('pgRouting topology not built — using mock router')
        const mock = await mockRoute(origin, destination, 'quality')
        return reply.send({
          routes: mock.segments.length > 0 ? [mock] : [],
          meta: { engine: 'mock-router-v1', alpha: config.ROUTING_ALPHA },
        })
      }
      throw err
    }
  })
}
