import { useCallback, useContext, useMemo, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { StackNavContext } from '../stackNav'
import { TextInput } from '../FormInputs'
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

function anchorMapOf(linkedFeatures: readonly LinkedFeatureRef[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>()
  for (const f of linkedFeatures) {
    const set = m.get(f.overlay_id) ?? new Set<string>()
    set.add(f.feature_id)
    m.set(f.overlay_id, set)
  }
  return m
}

/** Pure list body — shared by the drilled screen and the nested-overlay fallback. */
function LocationRows({ overlays, filter, linkedOverlaySet, featureAnchorMap, onToggleOverlay, onToggleFeature }: {
  overlays: readonly OverlayOption[]
  filter: string
  linkedOverlaySet: Set<string>
  featureAnchorMap: Map<string, Set<string>>
  onToggleOverlay: (overlayId: string) => void
  onToggleFeature: (overlayId: string, featureId: string) => void
}) {
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
              onClick={() => onToggleOverlay(o.id)}
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
                          onClick={() => onToggleFeature(o.id, f.id)}
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
}

/** Inline create-map row (drill path) — sanctioned inline-add pattern: bare
 *  TextInput + a circular themeblue3 Plus, not a full-width "Add" button. */
function MapAddRow({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  const submit = () => {
    const n = name.trim()
    if (!n) return
    onAdd(n)
    setName('')
  }
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-primary/6">
      <TextInput
        bare
        value={name}
        onChange={setName}
        placeholder="New map name…"
        ariaLabel="New map name"
        inputClassName="flex-1 min-w-0 bg-transparent text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
      />
      <button
        type="button"
        onClick={submit}
        aria-label="Add map"
        className="w-9 h-9 shrink-0 rounded-full bg-themeblue3 text-white flex items-center justify-center active:scale-95 transition-all"
      >
        <Plus size={18} />
      </button>
    </div>
  )
}

/**
 * The DRILLED screen body. A pushScreen render is frozen at push time, so it owns
 * LOCAL link state seeded from the host and commits every toggle through onChange.
 * A freshly-created map is appended to a local overlay list too, so it appears in
 * the drilled list immediately (the host's `overlays` prop can't reach this frozen
 * frame). Back closes it; changes are live.
 */
function LocationSelectScreen({
  overlays: initialOverlays,
  initialLinkedOverlays,
  initialLinkedFeatures,
  filter,
  onChange,
  onCreateOverlay,
}: {
  overlays: readonly OverlayOption[]
  initialLinkedOverlays: string[]
  initialLinkedFeatures: LinkedFeatureRef[]
  filter: string
  onChange: (linkedOverlays: string[], linkedFeatures: LinkedFeatureRef[]) => void
  onCreateOverlay?: (name: string) => Promise<string | null>
}) {
  const [overlays, setOverlays] = useState<OverlayOption[]>([...initialOverlays])
  const [linkedOverlays, setLinkedOverlays] = useState<string[]>(initialLinkedOverlays)
  const [linkedFeatures, setLinkedFeatures] = useState<LinkedFeatureRef[]>(initialLinkedFeatures)

  const linkedOverlaySet = useMemo(() => new Set(linkedOverlays), [linkedOverlays])
  const featureAnchorMap = useMemo(() => anchorMapOf(linkedFeatures), [linkedFeatures])

  const commit = (nextOverlays: string[], nextFeatures: LinkedFeatureRef[]) => {
    setLinkedOverlays(nextOverlays)
    setLinkedFeatures(nextFeatures)
    onChange(nextOverlays, nextFeatures)
  }

  const toggleOverlay = (overlayId: string) => {
    if (linkedOverlaySet.has(overlayId)) {
      commit(linkedOverlays.filter(id => id !== overlayId), [...linkedFeatures])
    } else {
      commit([...linkedOverlays, overlayId], linkedFeatures.filter(f => f.overlay_id !== overlayId))
    }
  }

  const toggleFeature = (overlayId: string, featureId: string) => {
    const isLinked = featureAnchorMap.get(overlayId)?.has(featureId) ?? false
    if (isLinked) {
      commit([...linkedOverlays], linkedFeatures.filter(f => !(f.overlay_id === overlayId && f.feature_id === featureId)))
    } else {
      commit([...linkedOverlays], [...linkedFeatures, { overlay_id: overlayId, feature_id: featureId }])
    }
  }

  const handleAdd = async (name: string) => {
    if (!onCreateOverlay) return
    const newId = await onCreateOverlay(name)
    if (!newId) return
    setOverlays(prev => (prev.some(o => o.id === newId) ? prev : [...prev, { id: newId, name }]))
    commit([...linkedOverlays, newId], [...linkedFeatures])
  }

  return (
    <>
      {onCreateOverlay && <MapAddRow onAdd={handleAdd} />}
      <LocationRows
        overlays={overlays}
        filter={filter}
        linkedOverlaySet={linkedOverlaySet}
        featureAnchorMap={featureAnchorMap}
        onToggleOverlay={toggleOverlay}
        onToggleFeature={toggleFeature}
      />
    </>
  )
}

/**
 * Location selection: a collapsed summary row that reveals a searchable list of
 * maps (+ their features) with a create-map inline add. Inside an OverlayStack/Sheet
 * drill stack it MORPHS the surface in place (StackNavContext → pushScreen); with no
 * stack it falls back to its own nested PreviewOverlay. Multi-select commits live,
 * so Back closes the drill.
 */
export function LocationPicker({
  overlays,
  linkedOverlays,
  linkedFeatures,
  onChange,
  onCreateOverlay,
}: LocationPickerProps) {
  const stackNav = useContext(StackNavContext)
  const [visible, setVisible] = useState(false)

  const close = useCallback(() => setVisible(false), [])

  const linkedOverlaySet = useMemo(() => new Set(linkedOverlays), [linkedOverlays])
  const featureAnchorMap = useMemo(() => anchorMapOf(linkedFeatures), [linkedFeatures])

  const summary = useMemo(() => {
    const fullCount = linkedOverlays.length
    const partialFeatures = linkedFeatures.filter(f => !linkedOverlaySet.has(f.overlay_id))
    if (fullCount === 0 && partialFeatures.length === 0) return ''
    const parts: string[] = []
    if (fullCount > 0) parts.push(`${fullCount} map${fullCount === 1 ? '' : 's'}`)
    // Name each partially-linked feature rather than counting — resolve label from its overlay.
    for (const f of partialFeatures) {
      const label = overlays.find(o => o.id === f.overlay_id)?.features?.find(x => x.id === f.feature_id)?.label
      parts.push(label ?? 'feature')
    }
    return parts.join(' · ')
  }, [overlays, linkedOverlays, linkedFeatures, linkedOverlaySet])

  const toggleOverlay = useCallback((overlayId: string) => {
    if (linkedOverlaySet.has(overlayId)) {
      onChange(linkedOverlays.filter(id => id !== overlayId), [...linkedFeatures])
    } else {
      onChange([...linkedOverlays, overlayId], linkedFeatures.filter(f => f.overlay_id !== overlayId))
    }
  }, [linkedOverlays, linkedFeatures, linkedOverlaySet, onChange])

  const toggleFeature = useCallback((overlayId: string, featureId: string) => {
    const isLinked = featureAnchorMap.get(overlayId)?.has(featureId) ?? false
    if (isLinked) {
      onChange([...linkedOverlays], linkedFeatures.filter(f => !(f.overlay_id === overlayId && f.feature_id === featureId)))
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

  const open = () => {
    if (stackNav) {
      stackNav.pushScreen({
        title: 'Location',
        searchPlaceholder: 'Search maps & features…',
        render: (_p, _nav, filter) => (
          <LocationSelectScreen
            overlays={overlays}
            initialLinkedOverlays={[...linkedOverlays]}
            initialLinkedFeatures={[...linkedFeatures]}
            filter={filter}
            onChange={onChange}
            onCreateOverlay={onCreateOverlay}
          />
        ),
      })
    } else {
      setVisible(true)
    }
  }

  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      <button
        type="button"
        onClick={open}
        className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm flex items-center justify-between gap-3 focus:outline-none ${summary ? 'text-primary' : 'text-tertiary'}`}
      >
        <span className="truncate">{summary || 'Location'}</span>
        <ChevronDown size={16} className="shrink-0 text-tertiary" />
      </button>

      {!stackNav && (
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
          preview={(filter) => (
            <LocationRows
              overlays={overlays}
              filter={filter}
              linkedOverlaySet={linkedOverlaySet}
              featureAnchorMap={featureAnchorMap}
              onToggleOverlay={toggleOverlay}
              onToggleFeature={toggleFeature}
            />
          )}
        />
      )}
    </div>
  )
}
