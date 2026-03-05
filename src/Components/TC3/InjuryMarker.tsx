import { memo } from 'react'
import { X } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import type { TC3Injury, InjuryType } from '../../Types/TC3Types'

const INJURY_TYPES: { value: InjuryType; label: string; color: string }[] = [
  { value: 'GSW', label: 'GSW', color: '#ef4444' },
  { value: 'blast', label: 'Blast', color: '#f97316' },
  { value: 'burn', label: 'Burn', color: '#eab308' },
  { value: 'laceration', label: 'Lac', color: '#3b82f6' },
  { value: 'fracture', label: 'Fx', color: '#8b5cf6' },
  { value: 'amputation', label: 'Amp', color: '#dc2626' },
  { value: 'other', label: 'Other', color: '#6b7280' },
]

interface InjuryMarkerProps {
  injury: TC3Injury
  isEditing: boolean
  onEdit: () => void
  onRemove: () => void
}

export const InjuryMarker = memo(function InjuryMarker({ injury, isEditing, onEdit, onRemove }: InjuryMarkerProps) {
  const updateInjury = useTC3Store((s) => s.updateInjury)
  const typeInfo = INJURY_TYPES.find(t => t.value === injury.type) ?? INJURY_TYPES[6]

  return (
    <div
      className="absolute"
      style={{
        left: `${injury.x}%`,
        top: `${injury.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isEditing ? 20 : 10,
      }}
    >
      {/* Marker dot */}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit() }}
        className="w-5 h-5 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[7px] font-bold text-white"
        style={{ backgroundColor: typeInfo.color }}
      >
        {typeInfo.label.charAt(0)}
      </button>

      {/* Popover editor */}
      {isEditing && (
        <div
          className="absolute left-6 top-0 bg-themewhite rounded-lg shadow-lg border border-tertiary/20 p-2 min-w-[180px] z-30"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Type selector */}
          <div className="flex flex-wrap gap-1 mb-2">
            {INJURY_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => updateInjury(injury.id, { type: t.value })}
                className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full border transition-all
                  ${injury.type === t.value
                    ? 'text-white border-transparent'
                    : 'text-tertiary border-tertiary/20 hover:bg-tertiary/5'
                  }`}
                style={injury.type === t.value ? { backgroundColor: t.color } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* Description */}
          <input
            type="text"
            value={injury.description}
            onChange={(e) => updateInjury(injury.id, { description: e.target.value })}
            placeholder="Description..."
            className="w-full text-xs px-2 py-1 rounded border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary mb-1.5"
            autoFocus
          />
          {/* Actions */}
          <div className="flex justify-between">
            <button onClick={onRemove} className="text-[10px] text-themeredred flex items-center gap-0.5">
              <X size={10} /> Remove
            </button>
            <button onClick={onEdit} className="text-[10px] text-themeblue2">Done</button>
          </div>
        </div>
      )}
    </div>
  )
})
