import { memo, useState, useCallback } from 'react'
import { useTC3Store } from '../../stores/useTC3Store'
import { InjuryMarker } from './InjuryMarker'
import type { BodySide, TC3Injury } from '../../Types/TC3Types'

/** Simple body outline SVG path — front view */
const BodyFrontSVG = () => (
  <svg viewBox="0 0 200 400" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {/* Head */}
    <ellipse cx="100" cy="35" rx="22" ry="28" />
    {/* Neck */}
    <line x1="92" y1="62" x2="92" y2="75" />
    <line x1="108" y1="62" x2="108" y2="75" />
    {/* Torso */}
    <path d="M70 75 L60 85 L55 140 L60 200 L75 210 L80 200 L100 205 L120 200 L125 210 L140 200 L145 140 L140 85 L130 75 Z" />
    {/* Left arm */}
    <path d="M60 85 L40 120 L30 170 L25 200 L30 205 L38 200 L45 170 L55 140" />
    {/* Right arm */}
    <path d="M140 85 L160 120 L170 170 L175 200 L170 205 L162 200 L155 170 L145 140" />
    {/* Left leg */}
    <path d="M75 210 L70 270 L68 330 L65 370 L62 385 L78 385 L80 370 L82 330 L85 270 L100 205" />
    {/* Right leg */}
    <path d="M125 210 L130 270 L132 330 L135 370 L138 385 L122 385 L120 370 L118 330 L115 270 L100 205" />
  </svg>
)

/** Simple body outline SVG path — back view */
const BodyBackSVG = () => (
  <svg viewBox="0 0 200 400" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {/* Head */}
    <ellipse cx="100" cy="35" rx="22" ry="28" />
    {/* Neck */}
    <line x1="92" y1="62" x2="92" y2="75" />
    <line x1="108" y1="62" x2="108" y2="75" />
    {/* Back / Torso */}
    <path d="M70 75 L60 85 L55 140 L58 200 L75 215 L100 210 L125 215 L142 200 L145 140 L140 85 L130 75 Z" />
    {/* Spine line */}
    <line x1="100" y1="75" x2="100" y2="200" strokeDasharray="4 3" opacity="0.4" />
    {/* Left arm */}
    <path d="M60 85 L40 120 L30 170 L25 200 L30 205 L38 200 L45 170 L55 140" />
    {/* Right arm */}
    <path d="M140 85 L160 120 L170 170 L175 200 L170 205 L162 200 L155 170 L145 140" />
    {/* Left leg */}
    <path d="M75 215 L70 270 L68 330 L65 370 L62 385 L78 385 L80 370 L82 330 L85 270 L100 210" />
    {/* Right leg */}
    <path d="M125 215 L130 270 L132 330 L135 370 L138 385 L122 385 L120 370 L118 330 L115 270 L100 210" />
    {/* Buttocks line */}
    <path d="M75 215 Q100 225 125 215" strokeDasharray="3 3" opacity="0.3" />
  </svg>
)

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
        {side === 'front' ? <BodyFrontSVG /> : <BodyBackSVG />}
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
