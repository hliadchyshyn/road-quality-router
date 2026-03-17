import type { Profile } from '../../types'

const PROFILES: { value: Profile; label: string; desc: string }[] = [
  { value: 'quality',  label: 'Best Roads',  desc: 'Avoid potholes'    },
  { value: 'balanced', label: 'Balanced',    desc: 'Quality + speed'   },
  { value: 'fastest',  label: 'Fastest',     desc: 'Minimize time'     },
  { value: 'shortest', label: 'Shortest',    desc: 'Minimize distance' },
]

interface Props {
  value:    Profile
  onChange: (p: Profile) => void
}

export function ProfileSelector({ value, onChange }: Props) {
  return (
    <div className="p-4 border-b border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Route Profile
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PROFILES.map((p) => (
          <button
            key={p.value}
            onClick={() => onChange(p.value)}
            className={`rounded-lg border p-2.5 text-left transition-all ${
              value === p.value
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <div className="text-sm font-semibold leading-tight">{p.label}</div>
            <div className={`text-xs mt-0.5 ${value === p.value ? 'text-blue-100' : 'text-gray-400'}`}>
              {p.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
