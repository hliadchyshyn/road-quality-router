import type { Route } from '../../types'

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

function qualityBadgeClass(index: number): string {
  if (index >= 70) return 'bg-green-100 text-green-700'
  if (index >= 40) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

function qualityBar(index: number): string {
  if (index >= 70) return 'bg-green-500'
  if (index >= 40) return 'bg-yellow-400'
  return 'bg-red-500'
}

export function RouteStats({ route }: { route: Route }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500">Distance</span>
        <span className="font-semibold text-gray-800">{route.distanceKm} km</span>
      </div>
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500">Duration</span>
        <span className="font-semibold text-gray-800">{formatDuration(route.durationMin)}</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">Road quality</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${qualityBadgeClass(route.qualityIndex)}`}>
            {route.qualityIndex} / 100
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${qualityBar(route.qualityIndex)}`}
            style={{ width: `${route.qualityIndex}%` }}
          />
        </div>
      </div>
    </div>
  )
}
