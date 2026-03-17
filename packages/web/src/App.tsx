import { useState, useCallback } from 'react'
import { MapView }    from './components/MapView/MapView'
import { Sidebar }    from './components/Sidebar/Sidebar'
import { useRoute }   from './hooks/useRoute'
import { useMapClick } from './hooks/useMapClick'
import type { Profile, LatLon, Route } from './types'

export default function App() {
  const [profile, setProfile] = useState<Profile>('quality')
  const { state, request, reset: resetRoute } = useRoute()

  const handleBothSet = useCallback((origin: LatLon, destination: LatLon) => {
    request(origin, destination)
  }, [request])

  const { origin, destination, phase, handleClick, reset: resetClick } = useMapClick(handleBothSet)

  const handleMapClick = useCallback((latlng: LatLon) => {
    if (phase === 'done') {
      resetRoute()
      resetClick()
    } else {
      handleClick(latlng)
    }
  }, [phase, handleClick, resetRoute, resetClick])

  // All 4 routes pre-calculated; pick the current profile instantly (no API call)
  const routesByProfile = state.status === 'success' ? state.routesByProfile : {}
  const currentRoute: Route | null = routesByProfile[profile] ?? null
  const routes = currentRoute ? [currentRoute] : []

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        profile={profile}
        onProfile={setProfile}   // instant — no re-fetch
        routes={routes}
        loading={state.status === 'loading'}
        error={state.status === 'error' ? state.message : null}
        phase={phase}
      />
      <MapView
        origin={origin}
        destination={destination}
        routes={routes}
        onClick={handleMapClick}
      />
    </div>
  )
}
