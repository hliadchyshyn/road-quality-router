import { ProfileSelector } from './ProfileSelector'
import { RouteStats }      from './RouteStats'
import { SegmentList }     from './SegmentList'
import type { Profile, Route } from '../../types'
import type { ClickPhase }    from '../../hooks/useMapClick'

const PHASE_HINT: Record<ClickPhase, string> = {
  origin:      '📍 Click the map to set origin',
  destination: '🏁 Click the map to set destination',
  done:        '🔄 Click the map to reset',
}

interface Props {
  profile:   Profile
  onProfile: (p: Profile) => void
  routes:    Route[]
  loading:   boolean
  error:     string | null
  phase:     ClickPhase
}

export function Sidebar({ profile, onProfile, routes, loading, error, phase }: Props) {
  const route = routes[0] ?? null

  return (
    <aside className="w-72 h-full bg-white shadow-xl flex flex-col overflow-hidden z-10 flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h1 className="text-base font-bold text-gray-900 tracking-tight">
          Road Quality Router
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">Ukraine · pgRouting + OSM</p>
      </div>

      {/* Hint */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
        <p className="text-xs text-blue-600">{PHASE_HINT[phase]}</p>
      </div>

      {/* Profile selector */}
      <ProfileSelector value={profile} onChange={onProfile} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <div className="flex items-center gap-2.5 text-blue-600 py-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-sm">Calculating route…</span>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {route && !loading && (
          <>
            <RouteStats route={route} />
            <SegmentList segments={route.segments} />
          </>
        )}

        {!route && !loading && !error && phase === 'origin' && (
          <p className="text-xs text-gray-400 text-center pt-4">
            Click two points on the map to calculate the best route.
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100">
        <p className="text-xs text-gray-300 text-center">
          🟢 Excellent · 🟡 Fair · 🔴 Poor
        </p>
      </div>
    </aside>
  )
}
