import { useRef, useEffect, useState } from 'react'
import maplibregl                        from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { syncRouteLayers, clearRouteLayers } from './RouteLayer'
import { syncMarkers }                        from './Markers'
import type { LatLon, Route } from '../../types'

interface Props {
  origin:      LatLon | null
  destination: LatLon | null
  routes:      Route[]
  onClick:     (latlng: LatLon) => void
}

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type:        'raster',
      tiles:       ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize:    256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxzoom:     19,
    },
  },
  layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm' }],
}

export function MapView({ origin, destination, routes, onClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<maplibregl.Map | null>(null)
  const onClickRef   = useRef(onClick)
  // Track whether the map style is fully loaded
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => { onClickRef.current = onClick }, [onClick])

  // Mount map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style:     OSM_STYLE,
      center:    [30.5234, 50.4501],
      zoom:      11,
      attributionControl: false,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    map.on('click', (e) => {
      onClickRef.current({ lat: e.lngLat.lat, lon: e.lngLat.lng })
    })

    map.getCanvas().style.cursor = 'crosshair'

    // Mark ready after the style finishes loading — this is the reliable moment
    // to start adding sources/layers. Using 'load' (fires once) + 'styledata'
    // (fires on subsequent style reloads) covers all cases.
    map.once('load', () => setMapReady(true))

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Sync route layers — only runs after mapReady is true
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (routes.length > 0) syncRouteLayers(map, routes)
    else clearRouteLayers(map)
  }, [routes, mapReady])

  // Sync markers — safe to call before style is loaded (markers are DOM elements)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    syncMarkers(map, origin, destination)
  }, [origin, destination])

  return <div ref={containerRef} className="flex-1 h-full" />
}
