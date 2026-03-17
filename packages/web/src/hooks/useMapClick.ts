import { useState, useCallback } from 'react'
import type { LatLon } from '../types'

export type ClickPhase = 'origin' | 'destination' | 'done'

export function useMapClick(onBothSet: (origin: LatLon, destination: LatLon) => void) {
  const [origin,      setOrigin]      = useState<LatLon | null>(null)
  const [destination, setDestination] = useState<LatLon | null>(null)
  const [phase,       setPhase]       = useState<ClickPhase>('origin')

  const handleClick = useCallback((latlng: LatLon) => {
    if (phase === 'origin') {
      setOrigin(latlng)
      setPhase('destination')
    } else if (phase === 'destination') {
      setDestination(latlng)
      setPhase('done')
      if (!origin) return
      onBothSet(origin, latlng)
    } else {
      // Third click: full reset
      setOrigin(null)
      setDestination(null)
      setPhase('origin')
    }
  }, [phase, origin, onBothSet])

  const reset = useCallback(() => {
    setOrigin(null)
    setDestination(null)
    setPhase('origin')
  }, [])

  return { origin, destination, phase, handleClick, reset }
}
