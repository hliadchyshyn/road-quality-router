import maplibregl from 'maplibre-gl'
import type { LatLon } from '../../types'

let originMarker:      maplibregl.Marker | null = null
let destinationMarker: maplibregl.Marker | null = null

function makeMarkerEl(color: string, label: string): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = `
    width: 22px; height: 22px; border-radius: 50%;
    background: ${color}; border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; color: white; font-family: sans-serif;
  `
  el.textContent = label
  return el
}

export function syncMarkers(
  map:         maplibregl.Map,
  origin:      LatLon | null,
  destination: LatLon | null,
): void {
  originMarker?.remove()
  originMarker = null
  if (origin) {
    originMarker = new maplibregl.Marker({ element: makeMarkerEl('#22c55e', 'A') })
      .setLngLat([origin.lon, origin.lat])
      .addTo(map)
  }

  destinationMarker?.remove()
  destinationMarker = null
  if (destination) {
    destinationMarker = new maplibregl.Marker({ element: makeMarkerEl('#ef4444', 'B') })
      .setLngLat([destination.lon, destination.lat])
      .addTo(map)
  }
}
