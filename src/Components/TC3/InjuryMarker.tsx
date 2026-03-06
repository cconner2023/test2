import { memo } from 'react'
import type { TC3Injury, InjuryType } from '../../Types/TC3Types'
import { InjuryPopover } from './InjuryPopover'

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
  const typeInfo = INJURY_TYPES.find(t => t.value === injury.type) ?? INJURY_TYPES[6]
  const hasLinks = injury.treatmentLinks.length > 0

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
        className="w-5 h-5 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[7px] font-bold text-white relative"
        style={{ backgroundColor: typeInfo.color }}
      >
        {typeInfo.label.charAt(0)}
        {/* Treatment link indicator */}
        {hasLinks && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-500 border border-white" />
        )}
      </button>

      {/* Popover editor */}
      {isEditing && (
        <InjuryPopover
          injury={injury}
          onClose={onEdit}
          onRemove={onRemove}
        />
      )}
    </div>
  )
})
