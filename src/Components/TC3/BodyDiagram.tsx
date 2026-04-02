import { memo, useState, useCallback, useRef } from 'react'
import { X, Check, Plus } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { TC3BodyDiagramSvg } from './TC3BodyDiagramSvg'
import { ContextMenuPreview } from '../ContextMenuPreview'
import { getSuggestedTreatments, getRegionLabel } from '../../Utilities/bodyRegionMap'
import type { TC3Injury, InjuryType, TreatmentCategory, TC3Hemostatic, TC3Tourniquet } from '../../Types/TC3Types'

/* ── Constants ────────────────────────────────────────────────────────────── */

const INJURY_TYPES: { value: InjuryType; label: string; color: string }[] = [
  { value: 'GSW', label: 'GSW', color: '#ef4444' },
  { value: 'blast', label: 'Blast', color: '#f97316' },
  { value: 'burn', label: 'Burn', color: '#eab308' },
  { value: 'laceration', label: 'Lac', color: '#3b82f6' },
  { value: 'fracture', label: 'Fx', color: '#8b5cf6' },
  { value: 'amputation', label: 'Amp', color: '#dc2626' },
  { value: 'other', label: 'Other', color: '#6b7280' },
]

export const INJURY_TYPE_COLOR: Record<InjuryType, string> = Object.fromEntries(
  INJURY_TYPES.map(t => [t.value, t.color]),
) as Record<InjuryType, string>

const TREATMENT_LABELS: Record<TreatmentCategory, string> = {
  tourniquet: 'Tourniquet',
  hemostatic: 'Hemostatic',
  chestSeal: 'Chest Seal',
  needleDecomp: 'Needle Decomp',
  other: 'Other',
}

/* ── Preview content (same content as old InjuryPopover) ─────────────────── */

function InjuryPreviewContent({ injury }: { injury: TC3Injury }) {
  const updateInjury = useTC3Store((s) => s.updateInjury)
  const addTourniquet = useTC3Store((s) => s.addTourniquet)
  const addHemostatic = useTC3Store((s) => s.addHemostatic)
  const updateChestSeal = useTC3Store((s) => s.updateChestSeal)
  const updateNeedleDecomp = useTC3Store((s) => s.updateNeedleDecomp)
  const linkTreatmentToInjury = useTC3Store((s) => s.linkTreatmentToInjury)
  const unlinkTreatmentFromInjury = useTC3Store((s) => s.unlinkTreatmentFromInjury)

  const suggested = getSuggestedTreatments(injury.bodyRegion)
  const regionLabel = injury.bodyRegion ? getRegionLabel(injury.bodyRegion) : ''

  const handleAddTreatment = (category: TreatmentCategory) => {
    const treatmentId = crypto.randomUUID()
    const location = regionLabel || `(${Math.round(injury.x)}%, ${Math.round(injury.y)}%)`

    switch (category) {
      case 'tourniquet': {
        const tq: TC3Tourniquet = {
          id: treatmentId,
          location,
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          type: 'CAT',
          tqCategory: 'Extremity',
          injuryId: injury.id,
        }
        addTourniquet(tq)
        break
      }
      case 'hemostatic': {
        const h: TC3Hemostatic = {
          id: treatmentId,
          applied: true,
          type: 'Combat Gauze',
          location,
          dressingType: 'Hemostatic',
          injuryId: injury.id,
        }
        addHemostatic(h)
        break
      }
      case 'chestSeal': {
        const side = injury.bodyRegion === 'chest-left' ? 'left'
          : injury.bodyRegion === 'chest-right' ? 'right'
          : 'left'
        updateChestSeal({ applied: true, side })
        break
      }
      case 'needleDecomp': {
        const side = injury.bodyRegion === 'chest-left' ? 'left'
          : injury.bodyRegion === 'chest-right' ? 'right'
          : 'left'
        updateNeedleDecomp({ performed: true, side })
        break
      }
      default:
        return
    }

    linkTreatmentToInjury(injury.id, {
      treatmentCategory: category,
      treatmentId,
      description: `${TREATMENT_LABELS[category]} @ ${location}`,
    })
  }

  return (
    <div className="p-2.5 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
      {/* Body region label */}
      {regionLabel && (
        <p className="text-[9px] font-semibold text-themeredred/70 tracking-wider uppercase mb-1.5">
          {regionLabel}
        </p>
      )}

      {/* Injury type selector */}
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

      {/* Description input */}
      <input
        type="text"
        value={injury.description}
        onChange={(e) => updateInjury(injury.id, { description: e.target.value })}
        placeholder="Description..."
        className="w-full text-xs px-2 py-1 rounded border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary mb-2"
        autoFocus
      />

      {/* Treatment quick-add */}
      {suggested.length > 0 && (
        <div className="mb-2">
          <p className="text-[8px] font-semibold text-tertiary/40 tracking-wider uppercase mb-1">Quick Add Treatment</p>
          <div className="flex flex-wrap gap-1">
            {suggested.map((cat) => (
              <button
                key={cat}
                onClick={() => handleAddTreatment(cat)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium rounded-md border border-themeredred/20 text-themeredred bg-themeredred/5 hover:bg-themeredred/10 transition-all"
              >
                <Plus size={8} /> {TREATMENT_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Linked treatments list */}
      {injury.treatmentLinks.length > 0 && (
        <div>
          <p className="text-[8px] font-semibold text-tertiary/40 tracking-wider uppercase mb-1">Linked Treatments</p>
          <div className="space-y-0.5">
            {injury.treatmentLinks.map((link) => (
              <div key={link.treatmentId} className="flex items-center gap-1 text-[9px] text-tertiary">
                <span className="px-1 py-0.5 rounded bg-green-500/10 text-green-700 font-medium">
                  {TREATMENT_LABELS[link.treatmentCategory]}
                </span>
                <span className="truncate flex-1 text-tertiary/60">{link.description}</span>
                <button
                  onClick={() => unlinkTreatmentFromInjury(injury.id, link.treatmentId)}
                  className="p-0.5 hover:bg-themeredred/10 rounded transition-colors shrink-0"
                >
                  <X size={8} className="text-themeredred/60" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── BodyDiagram ─────────────────────────────────────────────────────────── */

interface BodyDiagramProps {
  panelRef?: React.RefObject<HTMLElement | null>
  editingInjuryId?: string | null
  onEditInjury?: (id: string | null) => void
}

export const BodyDiagram = memo(function BodyDiagram({
  panelRef,
  editingInjuryId,
  onEditInjury,
}: BodyDiagramProps) {
  const injuries = useTC3Store((s) => s.card.injuries)
  const addInjury = useTC3Store((s) => s.addInjury)
  const removeInjury = useTC3Store((s) => s.removeInjury)

  // Internal state fallback when not lifted
  const [internalEditing, setInternalEditing] = useState<string | null>(null)
  const editing = editingInjuryId !== undefined ? editingInjuryId : internalEditing
  const setEditing = onEditInjury ?? setInternalEditing

  const diagramRef = useRef<HTMLDivElement>(null)
  const injuryCount = injuries.length

  const handleAddInjury = useCallback((x: number, y: number) => {
    const id = crypto.randomUUID()
    addInjury({ id, x, y, type: 'GSW', description: '' })
    setEditing(id)
  }, [addInjury, setEditing])

  const editedInjury = editing ? injuries.find(i => i.id === editing) : null

  // Anchor rect from the diagram container
  const anchorRect = diagramRef.current?.getBoundingClientRect() ?? null

  const handleRemove = useCallback(() => {
    if (!editedInjury) return
    removeInjury(editedInjury.id)
    setEditing(null)
  }, [editedInjury, removeInjury, setEditing])

  const handleDone = useCallback(() => {
    setEditing(null)
  }, [setEditing])

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Injury Locations</h3>
        <p className="text-[11px] text-tertiary/70">DD 1380 Section 3 — Tap on the body to mark injuries</p>
      </div>

      {/* Combined posterior + anterior diagram */}
      <div ref={diagramRef} className="relative">
        <TC3BodyDiagramSvg
          injuries={injuries}
          editingInjury={editing}
          onAddInjury={handleAddInjury}
          onEditInjury={setEditing}
        />
      </div>

      {/* ContextMenuPreview popover for editing injury */}
      {editedInjury && (
        <ContextMenuPreview
          isVisible={!!editedInjury}
          onClose={handleDone}
          anchorRect={anchorRect}
          containerRef={panelRef}
          preview={<InjuryPreviewContent injury={editedInjury} />}
          actions={[
            { key: 'remove', label: 'Remove', icon: X, onAction: handleRemove, variant: 'danger' },
            { key: 'done', label: 'Done', icon: Check, onAction: handleDone },
          ]}
        />
      )}

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
