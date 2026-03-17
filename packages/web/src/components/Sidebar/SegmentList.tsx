import { qualityColor } from '../MapView/RouteLayer'
import type { RouteSegment } from '../../types'

const ROAD_TYPE_LABEL: Record<string, string> = {
  motorway:       'Motorway',
  trunk:          'Trunk road',
  primary:        'Primary',
  secondary:      'Secondary',
  tertiary:       'Tertiary',
  residential:    'Residential',
  unclassified:   'Unclassified',
  service:        'Service',
  footway:        'Footway',
  cycleway:       'Cycleway',
  primary_link:   'Primary link',
  secondary_link: 'Secondary link',
  trunk_link:     'Trunk link',
  motorway_link:  'Motorway link',
}

export function SegmentList({ segments }: { segments: RouteSegment[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Route segments ({segments.length})
      </p>
      <ul className="space-y-0.5">
        {segments.map((seg) => (
          <li
            key={seg.id}
            className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: qualityColor(seg.qualityScore) }}
            />
            <div className="flex-1 min-w-0">
              <div className="truncate text-gray-800 font-medium leading-tight">
                {seg.name ?? ROAD_TYPE_LABEL[seg.roadType] ?? seg.roadType}
              </div>
              <div className="text-xs text-gray-400 leading-tight">
                {seg.surface} · {Math.round(seg.lengthMeters)} m
              </div>
            </div>
            <span className="text-xs font-semibold text-gray-500 flex-shrink-0 tabular-nums">
              {seg.qualityScore}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
