import { useState, useCallback } from 'react'
import { fetchRoute }            from '../api/routeApi'
import type { LatLon, Profile, Route } from '../types'

type RouteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; routesByProfile: Partial<Record<Profile, Route>> }
  | { status: 'error';   message: string }

export function useRoute() {
  const [state, setState] = useState<RouteState>({ status: 'idle' })

  const request = useCallback(async (origin: LatLon, destination: LatLon) => {
    setState({ status: 'loading' })
    try {
      // API always returns all 4 profiles in one call
      const data = await fetchRoute({ origin, destination, profile: 'quality' })
      const routesByProfile: Partial<Record<Profile, Route>> = {}
      for (const route of data.routes) {
        routesByProfile[route.profile as Profile] = route
      }
      setState({ status: 'success', routesByProfile })
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }, [])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, request, reset }
}
