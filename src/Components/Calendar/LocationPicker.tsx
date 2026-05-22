import { useCallback, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import type { OverlayOption } from './EventForm'
import type { LinkedFeatureRef } from '../../Types/MissionTypes'

interface LocationPickerProps {
  overlays: readonly OverlayOption[]
  linkedOverlays: readonly string[]
  linkedFeatures: readonly LinkedFeatureRef[]
  onChange: (linkedOverlays: string[], linkedFeatures: LinkedFeatureRef[]) => void
  /** Footer Add action — invoked with the typed name. Should return the new overlay's id so we can auto-link it. */
  onCreateOverlay?: (name: string) => Promise<string | null>
}

export function LocationPicker({
  overlays,
  linkedOverlays,
  linkedFeatures,
  onChange,
  onCreateOverlay,
}: LocationPickerProps) {
  const [visible, setVisible] = useState(false)

  const close = useCallback(() => setVisible(false), [])

  const linkedOverlaySet = useMemo(() => new Set(linkedOverlays), [linkedOverlays])
  const featureAnchorMap = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const f of linkedFeatures) {
      const set = m.get(f.overlay_id) ?? new Set<string>()
      set.add(f.feature_id)
      m.set(f.overlay_id, set)
    }
    return m
  }, [linkedFeatures])

  const summary = useMemo(() => {
    const fullCount = linkedOverlays.length
    const partialCount = linkedFeatures.filter(f => !linkedOverlaySet.has(f.overlay_id)).length
    if (fullCount === 0 && partialCount === 0) return ''
    const parts: string[] = []
    if (fullCount > 0) parts.push(`${fullCount} map${fullCount === 1 ? '' : 's'}`)
    if (partialCount > 0) parts.push(`${partialCount} feature${partialCount === 1 ? '' : 's'}`)
    return parts.join(' · ')
  }, [linkedOverlays, linkedFeatures, linkedOverlaySet])

  const toggleOverlay = useCallback((overlayId: string) => {
    const isLinked = linkedOverlaySet.has(overlayId)
    if (isLinked) {
      onChange(linkedOverlays.filter(id => id !== overlayId), [...linkedFeatures])
    } else {
      const nextFeatures = linkedFeatures.filter(f => f.overlay_id !== overlayId)
      onChange([...linkedOverlays, overlayId], nextFeatures)
    }
  }, [linkedOverlays, linkedFeatures, linkedOverlaySet, onChange])

  const toggleFeature = useCallback((overlayId: string, featureId: string) => {
    const set = featureAnchorMap.get(overlayId)
    const isLinked = set?.has(featureId) ?? false
    if (isLinked) {
      onChange(
        [...linkedOverlays],
        linkedFeatures.filter(f => !(f.overlay_id === overlayId && f.feature_id === featureId)),
      )
    } else {
      onChange([...linkedOverlays], [...linkedFeatures, { overlay_id: overlayId, feature_id: featureId }])
    }
  }, [linkedOverlays, linkedFeatures, featureAnchorMap, onChange])

  const handleAdd = useCallback(async (name: string) => {
    if (!onCreateOverlay) return
    const newId = await onCreateOverlay(name)
    if (!newId) return
    onChange([...linkedOverlays, newId], [...linkedFeatures])
  }, [onCreateOverlay, linkedOverlays, linkedFeatures, onChange])

  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      <button
        type="button"
        onClick={() => setVisible(true)}
        className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm flex items-center justify-between gap-3 focus:outline-none ${summary ? 'text-primary' : 'text-tertiary'}`}
      >
        <span className="truncate">{summary || 'Location'}</span>
        <ChevronDown size={16} className="shrink-0 text-tertiary" />
      </button>

      <PreviewOverlay
        isOpen={visible}
        onClose={close}
        anchorRect={null}
        maxWidth={360}
        previewMaxHeight="60dvh"
        title="Location"
        searchPlaceholder="Search maps & features…"
        onAdd={onCreateOverlay ? handleAdd : undefined}
        addPlaceholder="New map name…"
        preview={(filter) => {
          const q = filter.trim().toLowerCase()
          const matchedOverlays = q
            ? overlays.filter(o =>
                o.name.toLowerCase().includes(q)
                || (o.features ?? []).some(f => f.label.toLowerCase().includes(q)))
            : overlays

          if (matchedOverlays.length === 0) {
            return (
              <div className="px-4 py-6 text-center text-[10pt] text-tertiary">
                {q ? 'No maps or features match' : 'No maps yet'}
              </div>
            )
          }

          return (
            <ul className="flex flex-col py-1">
              {matchedOverlays.map(o => {
                const isLinked = linkedOverlaySet.has(o.id)
                const overlayFeatures = o.features ?? []
                const linkedFeatureCount = featureAnchorMap.get(o.id)?.size ?? 0
                const matchedFeatures = q
                  ? overlayFeatures.filter(f => f.label.toLowerCase().includes(q))
                  : overlayFeatures
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => toggleOverlay(o.id)}
                      className={`w-full flex items-center gap-2 px-4 py-3 text-left active:scale-[0.99] transition-all ${isLinked ? 'bg-themeblue3/8' : ''}`}
                    >
                      <span className={`flex-1 truncate text-[10pt] text-primary ${isLinked ? 'font-medium' : ''}`}>
                        {o.name}
                      </span>
                      {!isLinked && linkedFeatureCount > 0 && (
                        <span className="text-[9pt] text-tertiary shrink-0">{linkedFeatureCount}</span>
                      )}
                      {isLinked && <div className="w-2 h-2 rounded-full bg-themeblue3 shrink-0" />}
                    </button>
                    {matchedFeatures.length > 0 && (
                      isLinked ? (
                        <div className="pl-8 pr-4 pb-2 text-[9pt] text-tertiary italic">
                          All features included.
                        </div>
                      ) : (
                        <ul className="pb-1">
                          {matchedFeatures.map(f => {
                            const isFeatLinked = featureAnchorMap.get(o.id)?.has(f.id) ?? false
                            return (
                              <li key={f.id}>
                                <button
                                  type="button"
                                  onClick={() => toggleFeature(o.id, f.id)}
                                  className={`w-full flex items-center gap-2 pl-8 pr-4 py-2 text-left active:scale-[0.99] transition-all ${isFeatLinked ? 'bg-themeblue3/8' : ''}`}
                                >
                                  <span className={`flex-1 truncate text-[10pt] text-primary ${isFeatLinked ? 'font-medium' : ''}`}>
                                    {f.label}
                                  </span>
                                  {isFeatLinked && <div className="w-2 h-2 rounded-full bg-themeblue3 shrink-0" />}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      )
                    )}
                  </li>
                )
              })}
            </ul>
          )
        }}
      />
    </div>
  )
}
