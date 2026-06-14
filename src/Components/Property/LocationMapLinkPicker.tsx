// LocationMapLinkPicker — bind a property zone to the map. Three paths (the
// user's "support both" decision): link an EXISTING overlay whole, drop a NEW
// pin onto an existing overlay, or spin up a NEW standalone overlay for the
// zone. Writes property_locations.overlay_id (+ overlay_feature_id when a
// specific pin anchors the zone) through the caller's onLink callback, which
// persists via usePropertyStore.editLocation (offline-first, no types regen —
// the fields ride the createLocation data-spread, same as Phase 0).
//
// Mirrors the tc3/medevac cross-link UX in FeatureEditor: pick a target, link,
// unlink. NO-PHI: zone names + overlay names are operational vocabulary.

import { useEffect, useMemo, useState } from 'react'
import { Map as MapIcon, MapPin, Plus, Link2Off, ChevronLeft, Check } from 'lucide-react'
import { Sheet } from '../Sheet'
import { useMapOverlaysCache, useMapOverlaysStore } from '../../stores/useMapOverlaysStore'
import { useMapOverlayWrite } from '../../Hooks/useMapOverlayWrite'
import { DEFAULT_FEATURE_STYLE } from '../../Types/MapOverlayTypes'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'
import type { LocalPropertyLocation } from '../../Types/PropertyTypes'
import { getClinicDetails } from '../../lib/supervisorService'
import { listLocations } from '../../lib/adminService'
import { resolveSearch } from '../MapOverlay/searchResolver'

/** Best-effort clinic coordinates for a freshly-created overlay/pin. Mirrors
 *  MapOverlayPanel's default-center resolution: structured location row first
 *  (exact), then geocode the free-text fallbacks. Null when nothing resolves. */
async function resolveClinicCenter(clinicId: string): Promise<[number, number] | null> {
  try {
    const details = await getClinicDetails(clinicId)
    if (details.location_id) {
      const locs = await listLocations()
      const loc = locs.find((l) => l.id === details.location_id)
      if (loc?.lat != null && loc?.lon != null) return [loc.lat, loc.lon]
      if (loc?.display_name) {
        const r = await resolveSearch(loc.display_name)
        if (r) return [r.lat, r.lng]
      }
    }
    if (details.location) {
      const r = await resolveSearch(details.location)
      if (r) return [r.lat, r.lng]
    }
  } catch {
    /* non-fatal — caller falls back to an existing overlay's center */
  }
  return null
}

function makeWaypoint(overlayId: string, label: string, center: [number, number]): OverlayFeature {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    overlay_id: overlayId,
    type: 'waypoint',
    geometry: [center],
    label,
    style: { ...DEFAULT_FEATURE_STYLE },
    waypoint_type: 'circle',
    created_at: now,
    updated_at: now,
  }
}

export interface MapLinkUpdate {
  overlay_id: string | null
  overlay_feature_id: string | null
}

interface LocationMapLinkPickerProps {
  location: LocalPropertyLocation
  clinicId: string
  onClose: () => void
  /** Persist the new anchor on the zone (caller wires to store.editLocation). */
  onLink: (update: MapLinkUpdate) => void
}

type Step = { mode: 'menu' } | { mode: 'pick'; intent: 'link' | 'pin' }

const ROW =
  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-themewhite2/70 dark:bg-themewhite3/70 text-left active:scale-[0.99] transition-all'

export function LocationMapLinkPicker({ location, clinicId, onClose, onLink }: LocationMapLinkPickerProps) {
  useMapOverlaysCache(clinicId)
  const overlays = useMapOverlaysStore((s) => s.overlays)
  const { writeOverlay, upsertFeature } = useMapOverlayWrite()

  const [step, setStep] = useState<Step>({ mode: 'menu' })
  const [busy, setBusy] = useState(false)
  const [clinicCenter, setClinicCenter] = useState<[number, number] | null>(null)

  useEffect(() => {
    let cancelled = false
    void resolveClinicCenter(clinicId).then((c) => { if (!cancelled) setClinicCenter(c) })
    return () => { cancelled = true }
  }, [clinicId])

  const linkedOverlay = useMemo(
    () => (location.overlay_id ? overlays.find((o) => o.id === location.overlay_id) : undefined),
    [overlays, location.overlay_id],
  )
  const linkedFeature = useMemo(
    () => (location.overlay_feature_id ? linkedOverlay?.features.find((f) => f.id === location.overlay_feature_id) : undefined),
    [linkedOverlay, location.overlay_feature_id],
  )

  // A new standalone overlay needs a center; borrow the clinic's, else any
  // existing overlay's. Hidden (not disabled) when neither is available.
  const createCenter = clinicCenter ?? overlays[0]?.center ?? null

  const apply = (update: MapLinkUpdate) => { onLink(update); onClose() }

  const linkWhole = (overlayId: string) => apply({ overlay_id: overlayId, overlay_feature_id: null })

  const addPin = async (overlayId: string) => {
    const overlay = overlays.find((o) => o.id === overlayId)
    if (!overlay || busy) return
    setBusy(true)
    try {
      const feature = makeWaypoint(overlayId, location.name, overlay.center)
      await upsertFeature({ overlayId, clinicId, feature })
      apply({ overlay_id: overlayId, overlay_feature_id: feature.id })
    } finally {
      setBusy(false)
    }
  }

  const createOverlay = async () => {
    if (!createCenter || busy) return
    setBusy(true)
    try {
      const overlayId = crypto.randomUUID()
      const feature = makeWaypoint(overlayId, location.name, createCenter)
      const saved = await writeOverlay({
        overlayId,
        clinicId,
        name: location.name,
        center: createCenter,
        zoom: 17,
        features: [feature],
      })
      if (saved) apply({ overlay_id: overlayId, overlay_feature_id: feature.id })
    } finally {
      setBusy(false)
    }
  }

  const title = step.mode === 'pick'
    ? (step.intent === 'pin' ? 'Choose an overlay to pin' : 'Choose an overlay')
    : 'Map link'

  return (
    <Sheet
      isOpen
      onClose={onClose}
      title={title}
      titleNode={
        step.mode === 'pick' ? (
          <button
            onClick={() => setStep({ mode: 'menu' })}
            className="flex items-center gap-1 text-[13pt] font-semibold text-primary active:scale-95 transition-all"
          >
            <ChevronLeft size={18} /> {title}
          </button>
        ) : undefined
      }
      height="fit"
      maxHeight={70}
      backdrop="dismiss"
      zIndex={1300}
    >
      <div className="px-4 pb-4 flex flex-col gap-2">
        {step.mode === 'menu' && (
          <>
            {linkedOverlay && (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-themeblue3/10 border border-themeblue3/20">
                <MapPin size={18} className="text-themeblue3 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10pt] text-tertiary">Linked to</p>
                  <p className="truncate text-sm font-medium text-primary">
                    {linkedOverlay.name}{linkedFeature ? ` · ${linkedFeature.label}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => apply({ overlay_id: null, overlay_feature_id: null })}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10pt] text-themeredred active:scale-95 transition-all"
                >
                  <Link2Off size={14} /> Unlink
                </button>
              </div>
            )}

            {overlays.length > 0 && (
              <>
                <button className={ROW} onClick={() => setStep({ mode: 'pick', intent: 'link' })}>
                  <MapIcon size={18} className="text-themeblue3 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary">Link an existing overlay</p>
                    <p className="text-[10pt] text-tertiary">Anchor this zone to a whole map</p>
                  </div>
                </button>
                <button className={ROW} onClick={() => setStep({ mode: 'pick', intent: 'pin' })}>
                  <MapPin size={18} className="text-themeblue3 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary">Add a pin to an overlay</p>
                    <p className="text-[10pt] text-tertiary">Drop a marker for this zone</p>
                  </div>
                </button>
              </>
            )}

            {createCenter && (
              <button className={ROW} onClick={createOverlay} disabled={busy}>
                <Plus size={18} className="text-themeblue3 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary">New map for this zone</p>
                  <p className="text-[10pt] text-tertiary">Create a standalone overlay</p>
                </div>
              </button>
            )}

            {overlays.length === 0 && !createCenter && (
              <p className="px-1 py-2 text-[10pt] text-tertiary">
                No overlays yet, and no clinic location to center a new map. Set the clinic location, or create an overlay in the map first.
              </p>
            )}
          </>
        )}

        {step.mode === 'pick' && (
          overlays.length === 0 ? (
            <p className="px-1 py-2 text-[10pt] text-tertiary">No overlays available.</p>
          ) : (
            overlays.map((o) => {
              const isLinked = o.id === location.overlay_id
              return (
                <button
                  key={o.id}
                  className={ROW}
                  disabled={busy}
                  onClick={() => (step.intent === 'pin' ? addPin(o.id) : linkWhole(o.id))}
                >
                  <MapIcon size={18} className="text-themeblue3 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-primary">{o.name}</p>
                    <p className="text-[10pt] text-tertiary">
                      {o.features.length} feature{o.features.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  {isLinked && step.intent === 'link' && <Check size={16} className="text-themeblue3 shrink-0" />}
                </button>
              )
            })
          )
        )}
      </div>
    </Sheet>
  )
}

export default LocationMapLinkPicker
