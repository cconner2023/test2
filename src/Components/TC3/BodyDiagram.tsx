import { memo, useState, useCallback, useRef } from 'react'
import { X, Check } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { TC3BodyDiagramSvg } from './TC3BodyDiagramSvg'
import { PreviewOverlay } from '../PreviewOverlay'
import { MarkerPopover } from './MarkerPopover'
import { getRegionLabel } from '../../Utilities/bodyRegionMap'
import type { TC3Marker, InjuryType } from '../../Types/TC3Types'

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

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function nowISO16(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/* ── BodyDiagram ─────────────────────────────────────────────────────────── */

interface BodyDiagramProps {
  editingMarkerId?: string | null
  onEditMarker?: (id: string | null) => void
}

export const BodyDiagram = memo(function BodyDiagram({
  editingMarkerId,
  onEditMarker,
}: BodyDiagramProps) {
  const markers = useTC3Store((s) => s.card.markers)
  const addMarker = useTC3Store((s) => s.addMarker)
  const updateMarker = useTC3Store((s) => s.updateMarker)
  const removeMarker = useTC3Store((s) => s.removeMarker)

  // Internal state fallback when not lifted
  const [internalEditing, setInternalEditing] = useState<string | null>(null)
  const editing = editingMarkerId !== undefined ? editingMarkerId : internalEditing
  const setEditing = onEditMarker ?? setInternalEditing

  const diagramRef = useRef<HTMLDivElement>(null)

  const handleAddMarker = useCallback((x: number, y: number) => {
    const id = crypto.randomUUID()
    addMarker({
      id,
      x,
      y,
      injuries: ['GSW'],
      treatments: [],
      procedures: [],
      gauge: '18g',
      tqType: 'CAT',
      tqCategory: 'Extremity',
      dressingType: 'Hemostatic',
      priority: '',
      dateTime: nowISO16(),
      description: '',
    })
    setEditing(id)
  }, [addMarker, setEditing])

  const editedMarker = editing ? markers.find(m => m.id === editing) ?? null : null

  // Anchor rect from the diagram container
  const anchorRect = diagramRef.current?.getBoundingClientRect() ?? null

  const handleRemove = useCallback(() => {
    if (!editedMarker) return
    removeMarker(editedMarker.id)
    setEditing(null)
  }, [editedMarker, removeMarker, setEditing])

  const handleDone = useCallback(() => {
    setEditing(null)
  }, [setEditing])

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Injury Locations</h3>
        <p className="text-[11px] text-tertiary/70">DD 1380 Section 3 — Tap on the body to mark injuries, treatments, or IV/IO sites</p>
      </div>

      {/* Combined posterior + anterior diagram */}
      <div ref={diagramRef} className="relative">
        <TC3BodyDiagramSvg
          markers={markers}
          editingMarker={editing}
          onAddMarker={handleAddMarker}
          onEditMarker={setEditing}
        />
      </div>

      {/* PreviewOverlay popover for editing marker */}
      <PreviewOverlay
        isOpen={!!editedMarker}
        onClose={handleDone}
        anchorRect={anchorRect}
        searchPlaceholder="Search items..."
        preview={(filter, clearFilter) => (
          editedMarker ? (
            <MarkerPopover
              marker={editedMarker}
              filter={filter}
              clearFilter={clearFilter}
            />
          ) : null
        )}
        actions={[
          { key: 'remove', label: 'Remove', icon: X, onAction: handleRemove, variant: 'danger' },
          { key: 'done', label: 'Done', icon: Check, onAction: handleDone },
        ]}
        onAdd={(value) => {
          if (editedMarker) {
            updateMarker(editedMarker.id, {
              description: editedMarker.description
                ? editedMarker.description + '; ' + value
                : value,
            })
          }
        }}
        addPlaceholder="Add custom note..."
      />

    </div>
  )
})
