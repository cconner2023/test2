/**
 * Per-panel cluster picker for settings editors that write clinic-scoped
 * content (auto-text, plan tags, order sets). Independent of the global
 * `supervisingClinicId` — these panels are configuration surfaces, not
 * operational context, so the editing target is local to the panel.
 *
 * Renders nothing for users with no surrogate clinics.
 *
 * Exports both `ClusterEditButton` (just the button + overlay, for embedding
 * inside an existing ActionPill) and `ClusterEditPicker` (the same button
 * wrapped in its own ActionPill for standalone use).
 */

import { useRef, useState } from 'react'
import { ArrowRightLeft, Check } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { ActionButton } from '../ActionButton'
import { ActionPill } from '../ActionPill'
import { PreviewOverlay } from '../PreviewOverlay'
import type { ContextMenuItem } from '../ContextMenu'

interface ClusterEditPickerProps {
  selectedClinicId: string | null
  onSelect: (clinicId: string) => void
}

/**
 * Cluster picker as a single ContextMenuItem with a clinic-list submenu — for
 * folding into a consolidated corner ⋯ menu (OverlayActionMenu) alongside New /
 * Share / Export / Import. Returns null when the user has no surrogate clinics
 * (no scope to switch), so callers spread `clusterItem ? [clusterItem] : []`.
 */
export function useClusterEditItem({ selectedClinicId, onSelect }: ClusterEditPickerProps): ContextMenuItem | null {
  const { profile, clinicId, surrogateClinicIds } = useAuth()
  if (!clinicId || surrogateClinicIds.length === 0) return null

  const loans = profile.surrogateClinics ?? []
  const options = [
    { id: clinicId, name: profile.clinicName ?? 'Assigned' },
    ...surrogateClinicIds.map((id) => ({
      id,
      name: loans.find((c) => c.id === id)?.name ?? 'Surrogate',
    })),
  ]
  const current = options.find(o => o.id === selectedClinicId) ?? options[0]

  return {
    key: 'cluster',
    label: `Editing: ${current.name}`,
    icon: ArrowRightLeft,
    submenu: options.map(o => ({
      key: o.id,
      label: o.name,
      selected: o.id === current.id,
      onAction: () => onSelect(o.id),
    })),
  }
}

export function ClusterEditButton({ selectedClinicId, onSelect }: ClusterEditPickerProps) {
  const buttonRef = useRef<HTMLSpanElement>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const { profile, clinicId, surrogateClinicIds } = useAuth()

  if (!clinicId || surrogateClinicIds.length === 0) return null

  const loans = profile.surrogateClinics ?? []
  const options = [
    { id: clinicId, name: profile.clinicName ?? 'Assigned' },
    ...surrogateClinicIds.map((id) => ({
      id,
      name: loans.find((c) => c.id === id)?.name ?? 'Surrogate',
    })),
  ]

  const current = options.find(o => o.id === selectedClinicId) ?? options[0]

  return (
    <>
      <span ref={buttonRef} className="contents">
        <ActionButton
          icon={ArrowRightLeft}
          label={`Editing: ${current.name}`}
          onClick={() => setAnchor(buttonRef.current?.getBoundingClientRect() ?? null)}
        />
      </span>
      <PreviewOverlay
        isOpen={!!anchor}
        onClose={() => setAnchor(null)}
        anchorRect={anchor}
        title="Edit cluster"
        maxWidth={300}
      >
        <div>
          {options.map(c => {
            const active = current.id === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => { onSelect(c.id); setAnchor(null) }}
                className={`w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors ${
                  active
                    ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
                    : 'hover:bg-secondary/5'
                }`}
              >
                <span className="text-[10pt] font-medium text-primary truncate flex-1">{c.name}</span>
                {active && <Check size={14} className="text-themeblue2 shrink-0" />}
              </button>
            )
          })}
        </div>
      </PreviewOverlay>
    </>
  )
}

export function ClusterEditPicker(props: ClusterEditPickerProps) {
  const { clinicId, surrogateClinicIds } = useAuth()
  if (!clinicId || surrogateClinicIds.length === 0) return null

  return (
    <ActionPill placement="inline">
      <ClusterEditButton {...props} />
    </ActionPill>
  )
}
