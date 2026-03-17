import maplibregl from 'maplibre-gl'
import type { Map, GeoJSONSource } from 'maplibre-gl'
import type { Route } from '../../types'
import type { Feature, LineString, FeatureCollection } from 'geojson'

const SOURCE_ID = 'route-source'
const LAYER_ID  = 'route-layer'

/** Map qualityScore 0–100 → green / yellow / red */
export function qualityColor(score: number): string {
  if (score >= 70) return '#22c55e'  // green-500
  if (score >= 40) return '#eab308'  // yellow-500
  return '#ef4444'                    // red-500
}

export function syncRouteLayers(map: Map, routes: Route[]): void {
  const features: Feature<LineString>[] = routes.flatMap((route) =>
    route.segments.map((seg) => ({
      type:     'Feature' as const,
      geometry: seg.geometry,
      properties: {
        color:        qualityColor(seg.qualityScore),
        qualityScore: seg.qualityScore,
        name:         seg.name,
      },
    }))
  )

  const geojson: FeatureCollection = { type: 'FeatureCollection', features }
  const existing = map.getSource(SOURCE_ID) as GeoJSONSource | undefined

  if (existing) {
    existing.setData(geojson)
  } else {
    map.addSource(SOURCE_ID, { type: 'geojson', data: geojson })
    map.addLayer({
      id:     LAYER_ID,
      type:   'line',
      source: SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 5,
        'line-opacity': 0.85,
      },
    })
  }

  // Fit map to route bounds
  if (features.length > 0) {
    const allCoords = features.flatMap(
      (f) => (f.geometry as LineString).coordinates
    )
    const bounds = allCoords.reduce(
      (b, [lng, lat]) => b.extend([lng, lat] as [number, number]),
      new maplibregl.LngLatBounds(),
    )
    map.fitBounds(bounds, { padding: 60, duration: 800 })
  }
}

export function clearRouteLayers(map: Map): void {
  if (map.getLayer(LAYER_ID))  map.removeLayer(LAYER_ID)
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
}
