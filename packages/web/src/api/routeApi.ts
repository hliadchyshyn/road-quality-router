import type { LatLon, Profile, RouteResponse } from '../types'

export interface RouteRequest {
  origin:       LatLon
  destination:  LatLon
  profile:      Profile
  alternatives?: 1 | 2 | 3
}

export async function fetchRoute(req: RouteRequest): Promise<RouteResponse> {
  const res = await fetch('/api/v1/route', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(req),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<RouteResponse>
}
