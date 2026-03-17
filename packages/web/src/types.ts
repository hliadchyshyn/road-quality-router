import type { LineString } from 'geojson'

export type Profile = 'quality' | 'shortest' | 'fastest' | 'balanced'
export type QualityLabel = 'excellent' | 'good' | 'fair' | 'poor' | 'critical'

export interface LatLon {
  lat: number
  lon: number
}

export interface RouteSegment {
  id: string
  name: string | null
  roadType: string
  surface: string
  lengthMeters: number
  qualityScore: number
  qualityLabel: QualityLabel
  geometry: LineString
}

export interface Route {
  profile: Profile
  distanceKm: number
  durationMin: number
  qualityIndex: number
  segments: RouteSegment[]
  geometry: LineString
}

export interface RouteResponse {
  routes: Route[]
  meta: {
    engine: string
    edgeWeightFormula?: string
    alpha?: number
  }
}
