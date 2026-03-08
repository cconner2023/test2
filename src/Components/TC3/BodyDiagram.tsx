import { memo, useState, useCallback } from 'react'
import { useTC3Store } from '../../stores/useTC3Store'
import { InjuryMarker } from './InjuryMarker'
import { BodySilhouette } from './BodySilhouette'
import type { BodySide } from '../../Types/TC3Types'

/** A clickable body panel — one side (front or back). */
function BodyPanel({ side, label, editingInjury, setEditingInjury }: {
  side: BodySide
  label: string
  editingInjury: string | null
  setEditingInjury: (id: string | null) => void
}) {
  const injuries = useTC3Store((s) => s.card.injuries)
  const addInjury = useTC3Store((s) => s.addInjury)
  const removeInjury = useTC3Store((s) => s.removeInjury)

  const sideInjuries = injuries.filter(inj => inj.side === side)

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const id = crypto.randomUUID()
    addInjury({ id, x, y, side, type: 'GSW', description: '' })
    setEditingInjury(id)
  }, [side, addInjury, setEditingInjury])

  return (
    <div className="flex-1 min-w-0">
      <p className="text-[9px] font-semibold text-tertiary/40 tracking-widest uppercase text-center mb-0.5">{label}</p>
      <div
        className="relative cursor-crosshair text-tertiary/25 mx-auto"
        style={{ maxWidth: '140px', aspectRatio: '200/400' }}
        onClick={handleClick}
      >
        <BodySilhouette side={side} />
        {sideInjuries.map(inj => (
          <InjuryMarker
            key={inj.id}
            injury={inj}
            isEditing={editingInjury === inj.id}
            onEdit={() => setEditingInjury(editingInjury === inj.id ? null : inj.id)}
            onRemove={() => { removeInjury(inj.id); setEditingInjury(null) }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Body diagram — always shows front + back side by side (desktop layout).
 * Tap on body to mark injuries; each marker opens an InjuryPopover with
 * type selection, description, and treatment quick-add.
 */
export const BodyDiagram = memo(function BodyDiagram() {
  const injuries = useTC3Store((s) => s.card.injuries)
  const [editingInjury, setEditingInjury] = useState<string | null>(null)

  const injuryCount = injuries.length

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Injury Locations</h3>
        <p className="text-[11px] text-tertiary/70">DD 1380 Section 3 — Tap on the body to mark injuries</p>
      </div>

      {/* Front + Back side by side */}
      <div className="flex gap-1 px-1 py-2">
        <BodyPanel side="front" label="Front" editingInjury={editingInjury} setEditingInjury={setEditingInjury} />
        <BodyPanel side="back" label="Back" editingInjury={editingInjury} setEditingInjury={setEditingInjury} />
      </div>

      {injuryCount > 0 && (
        <p className="text-[9px] text-tertiary/50 text-center">
          {injuryCount} injur{injuryCount === 1 ? 'y' : 'ies'} marked — tap body to add
        </p>
      )}
      {injuryCount === 0 && (
        <p className="text-[9px] text-tertiary/30 text-center">
          Tap body to mark injuries
        </p>
      )}
    </div>
  )
})
