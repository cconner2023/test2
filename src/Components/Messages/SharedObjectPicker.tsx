import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, Map as MapIcon, Image as ImageIcon, Package, FileText } from 'lucide-react'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import type { ContextMenuItem, MenuCardRow, SearchLevelSpec } from '@/Components/primitives/ContextMenu'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { useMapOverlaysStore, useMapOverlaysCache } from '../../stores/useMapOverlaysStore'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useUserProfile } from '../../Hooks/useUserProfile'
import { useEditableClinicContent } from '../../Hooks/useEditableClinicContent'
import { fetchClinicItems, fetchClinicLocations } from '../../lib/propertyService'
import { getCategoryMeta } from '../../Types/CalendarTypes'
import type { LocalPropertyItem, LocalPropertyLocation } from '../../Types/PropertyTypes'
import type { SharedRefContent } from '../../lib/signal/messageContent'
import type { BundleSource } from '../../lib/objectBundle'
import type { TextExpander, PlanOrderSet } from '../../Data/User'

type RefKind = 'calendar-event' | 'map-overlay' | 'property-item'

function formatEventDate(startISO: string): string {
  return new Date(startISO).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function orderSetSub(o: PlanOrderSet): string {
  const n = Object.values(o.presets).reduce((sum, arr) => sum + (arr?.length ?? 0), 0)
  return `Order set · ${n} ${n === 1 ? 'order' : 'orders'}`
}

/** Join present fields into a consistent `a · b` sub-line (drops blanks). */
function subLine(...parts: (string | null | undefined)[]): string | undefined {
  const kept = parts.filter(Boolean)
  return kept.length ? kept.join(' · ') : undefined
}

interface SharedObjectPickerProps {
  isOpen: boolean
  /** Live + button element. The anchored menu re-measures it on reflow so an iOS
   *  keyboard collapse (input was focused when + was tapped) re-pins the menu to
   *  the button instead of stranding it at the top of the screen. */
  anchorRef: React.RefObject<HTMLElement | null>
  clinicId: string | null
  onClose: () => void
  /** User chose "Photo" — caller opens its file picker. */
  onPickPhoto: () => void
  /** User picked a clustered object to share (live shared_ref). */
  onPick: (content: SharedRefContent) => void
  /** User picked a text template / order set — sent as a frozen note-blocks bundle
   *  (no live ref exists for config). Caller packs + sends into the chat. */
  onPickBundle: (source: BundleSource) => void
}

/**
 * Anchored "+" add menu for the chat composer — a single {@link AnchoredMenu} (list
 * layout). The root is Photo / Event / Map / Property / Template; every non-Photo
 * entry drills into a SEARCHABLE card list inside the same menu (Map drills again to
 * a feature step). One primitive, real Back navigation — no PreviewOverlay stitch.
 *
 * Event / Map / Property send a LIVE `shared_ref` (opaque id + operational label,
 * resolved against the receiver's vault) via onPick. Template lists the user's text
 * templates + plan order sets and sends a FROZEN note-blocks bundle via onPickBundle
 * — config has no live ref (objectBundle.ts). Never the payload, never PHI.
 */
export function SharedObjectPicker({
  isOpen,
  anchorRef,
  clinicId,
  onClose,
  onPickPhoto,
  onPick,
  onPickBundle,
}: SharedObjectPickerProps) {
  useMapOverlaysCache(clinicId)

  const events = useCalendarStore(s => s.events)
  const overlays = useMapOverlaysStore(s => s.overlays)
  const storeItems = usePropertyStore(s => s.items)
  const storeLocations = usePropertyStore(s => s.locations)

  // Note-block sources for the Template step: personal (profile) + clinic content,
  // merged. Text templates dedupe by abbr, order sets by id.
  const { profile } = useUserProfile()
  const { content: clinicContent } = useEditableClinicContent(clinicId)
  const textTemplates = useMemo<TextExpander[]>(() => {
    const merged = [...clinicContent.textExpanders, ...(profile.textExpanders ?? [])]
    const seen = new Set<string>()
    return merged.filter(t => { const k = t.abbr.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
  }, [clinicContent.textExpanders, profile.textExpanders])
  const orderSets = useMemo<PlanOrderSet[]>(() => {
    const merged = [...clinicContent.planOrderSets, ...(profile.planOrderSets ?? [])]
    const seen = new Set<string>()
    return merged.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true })
  }, [clinicContent.planOrderSets, profile.planOrderSets])

  // Property store only inits when its drawer opens; lazy-fetch clinic items the
  // first time the user drills into Property with an empty cache.
  const [fetchedItems, setFetchedItems] = useState<LocalPropertyItem[] | null>(null)
  const [fetchedLocations, setFetchedLocations] = useState<LocalPropertyLocation[] | null>(null)
  const fetchStarted = useRef(false)
  useEffect(() => { if (!isOpen) fetchStarted.current = false }, [isOpen])
  const propertyItems = storeItems.length > 0 ? storeItems : (fetchedItems ?? [])
  const propertyLocations = storeLocations.length > 0 ? storeLocations : (fetchedLocations ?? [])

  // Live snapshot of everything the search levels read. AnchoredMenu holds each
  // pushed level's spec in its OWN state, so `rows()` closures MUST read live data
  // through this ref — otherwise a lazy fetch (property) or a store update wouldn't
  // reach an already-open level.
  const dataRef = useRef({ events, overlays, propertyItems, propertyLocations, textTemplates, orderSets })
  dataRef.current = { events, overlays, propertyItems, propertyLocations, textTemplates, orderSets }

  // Same for the pick callbacks + clinicId — lets `menuItems` build ONCE (stable
  // identity) without going stale on prop changes.
  const ctxRef = useRef({ onPick, onPickBundle, onPickPhoto, clinicId })
  ctxRef.current = { onPick, onPickBundle, onPickPhoto, clinicId }

  const menuItems = useMemo<ContextMenuItem[]>(() => {
    const pickRef = (kind: RefKind, row: MenuCardRow) =>
      ctxRef.current.onPick({ type: 'shared_ref', refKind: kind, refId: row.id, label: row.label, subLabel: row.sub })

    const eventSpec: SearchLevelSpec = {
      title: 'Share an event',
      placeholder: 'Filter events…',
      emptyText: 'No events to share',
      rows: (q) => {
        const ql = q.trim().toLowerCase()
        return [...dataRef.current.events]
          .filter(e => !ql || (e.title ?? '').toLowerCase().includes(ql) || (e.location ?? '').toLowerCase().includes(ql))
          .sort((a, b) => b.start_time.localeCompare(a.start_time))
          .slice(0, 60)
          .map(e => ({ id: e.id, label: e.title || 'Untitled event', sub: subLine(formatEventDate(e.start_time), getCategoryMeta(e.category).label) }))
      },
      onPick: (r) => pickRef('calendar-event', r),
    }

    const propertySpec: SearchLevelSpec = {
      title: 'Share an item',
      placeholder: 'Filter property…',
      emptyText: 'No property to share',
      rows: (q) => {
        const ql = q.trim().toLowerCase()
        const locName = new Map(dataRef.current.propertyLocations.map(l => [l.id, l.name]))
        return [...dataRef.current.propertyItems]
          .filter(i => !ql
            || (i.name ?? '').toLowerCase().includes(ql)
            || (i.nsn ?? '').toLowerCase().includes(ql)
            || (i.serial_number ?? '').toLowerCase().includes(ql))
          .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
          .slice(0, 60)
          .map(i => ({
            id: i.id,
            label: i.name || i.nomenclature || 'Item',
            sub: subLine(i.nsn ? `NSN ${i.nsn}` : null, i.location_id ? locName.get(i.location_id) : null),
          }))
      },
      onPick: (r) => pickRef('property-item', r),
    }

    // Flat list of every overlay feature across every overlay — no drill step. Row id
    // is `${overlayId}:${featureId}` (both bare uuids, so one split is unambiguous) so
    // onPick can resolve the parent overlay + feature live.
    const mapSpec: SearchLevelSpec = {
      title: 'Share a map feature',
      placeholder: 'Filter features…',
      emptyText: 'No map features to share',
      rows: (q) => {
        const ql = q.trim().toLowerCase()
        const rows: MenuCardRow[] = []
        for (const o of dataRef.current.overlays) {
          const overlayName = o.name || 'Untitled overlay'
          for (const f of o.features ?? []) {
            if (ql
              && !(f.label ?? '').toLowerCase().includes(ql)
              && !(f.mgrs ?? '').toLowerCase().includes(ql)
              && !overlayName.toLowerCase().includes(ql)) continue
            rows.push({
              id: `${o.id}:${f.id}`,
              label: f.label || 'Untitled feature',
              sub: subLine(f.mgrs, overlayName),
            })
          }
        }
        return rows.slice(0, 80)
      },
      onPick: (r) => {
        const [overlayId, featureId] = r.id.split(':')
        const overlay = dataRef.current.overlays.find(o => o.id === overlayId)
        const f = overlay?.features?.find(ff => ff.id === featureId)
        if (!overlay || !f) return
        ctxRef.current.onPick({
          type: 'shared_ref', refKind: 'map-overlay', refId: overlay.id, featureId: f.id,
          label: f.label || 'Waypoint', subLabel: overlay.name || 'Overlay',
        })
      },
    }

    const templateSpec: SearchLevelSpec = {
      title: 'Share a template',
      placeholder: 'Filter templates…',
      emptyText: 'No templates to share',
      rows: (q) => {
        const ql = q.trim().toLowerCase()
        const te: MenuCardRow[] = dataRef.current.textTemplates
          .filter(t => !ql || t.abbr.toLowerCase().includes(ql) || (t.expansion ?? '').toLowerCase().includes(ql))
          .map(t => ({ id: `te:${t.abbr}`, label: t.abbr, sub: t.expansion?.trim() || 'Text template' }))
        const os: MenuCardRow[] = dataRef.current.orderSets
          .filter(o => !ql || o.name.toLowerCase().includes(ql))
          .map(o => ({ id: `os:${o.id}`, label: o.name, sub: orderSetSub(o) }))
        return [...te, ...os].slice(0, 80)
      },
      onPick: (r) => {
        if (r.id.startsWith('os:')) {
          const o = dataRef.current.orderSets.find(x => `os:${x.id}` === r.id)
          if (!o) return
          ctxRef.current.onPickBundle({ kind: 'note-blocks', blocks: { planOrderSets: [o] }, label: o.name, subLabel: 'Order set' })
        } else {
          const t = dataRef.current.textTemplates.find(x => `te:${x.abbr}` === r.id)
          if (!t) return
          ctxRef.current.onPickBundle({ kind: 'note-blocks', blocks: { textExpanders: [t] }, label: t.abbr, subLabel: 'Text template' })
        }
      },
    }

    // Fires as the Property row's side-effect (onAction) right before its drill —
    // one-shot clinic-items fetch when the store cache is cold.
    const prefetchProperty = () => {
      const cid = ctxRef.current.clinicId
      if (!cid || fetchStarted.current) return
      if (usePropertyStore.getState().items.length > 0) return
      fetchStarted.current = true
      void fetchClinicItems(cid).then(setFetchedItems).catch(() => setFetchedItems([]))
      void fetchClinicLocations(cid).then(setFetchedLocations).catch(() => setFetchedLocations([]))
    }

    return [
      { key: 'photo', label: 'Photo', icon: ImageIcon, onAction: () => ctxRef.current.onPickPhoto() },
      { key: 'event', label: 'Event', icon: Calendar, search: eventSpec },
      { key: 'map', label: 'Map', icon: MapIcon, search: mapSpec },
      { key: 'property', label: 'Property', icon: Package, search: propertySpec, onAction: prefetchProperty },
      { key: 'template', label: 'Template', icon: FileText, search: templateSpec },
    ]
  }, [])

  return (
    <AnchoredMenu
      isOpen={isOpen}
      anchorRef={anchorRef}
      layout="list"
      align="left"
      items={menuItems}
      onClose={onClose}
    />
  )
}
