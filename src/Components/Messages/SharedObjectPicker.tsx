import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, Map as MapIcon, Image as ImageIcon, Package, ChevronRight, MapPin, Route, Hexagon, FileText, ClipboardList } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { AnchoredMenu } from '../LiftedRowMenu'
import type { ContextMenuItem } from '../ContextMenu'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { useMapOverlaysStore, useMapOverlaysCache } from '../../stores/useMapOverlaysStore'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useUserProfile } from '../../Hooks/useUserProfile'
import { useEditableClinicContent } from '../../Hooks/useEditableClinicContent'
import { fetchClinicItems } from '../../lib/propertyService'
import type { LocalPropertyItem } from '../../Types/PropertyTypes'
import type { LocalMapOverlay, OverlayFeature } from '../../Types/MapOverlayTypes'
import type { SharedRefContent } from '../../lib/signal/messageContent'
import type { BundleSource } from '../../lib/objectBundle'
import type { TextExpander, PlanOrderSet } from '../../Data/User'

type RefKind = 'calendar-event' | 'map-overlay' | 'property-item'
// 'map-feature' is a drill-in sub-step of 'map-overlay' — pick a single feature
// (or the whole overlay) so the shared_ref can carry a featureId.
// 'template' lists the user's text templates + plan order sets — these have NO
// live shared_ref (objectBundle.ts), so a pick sends a frozen note-blocks bundle.
type Step = 'menu' | RefKind | 'map-feature' | 'template'

/** Sentinel row id for the "Whole overlay" option inside the feature step. */
const WHOLE_OVERLAY = '__whole_overlay__'

function featureTypeLabel(f: OverlayFeature): string {
  if (f.type === 'waypoint') return f.waypoint_type ? `Waypoint · ${f.waypoint_type.toUpperCase()}` : 'Waypoint'
  if (f.type === 'route') return f.recorded ? 'Recorded route' : 'Route'
  return 'Area'
}

function featureIcon(f: OverlayFeature) {
  if (f.type === 'route') return Route
  if (f.type === 'area') return Hexagon
  return MapPin
}

interface SharedObjectPickerProps {
  isOpen: boolean
  /** Live + button element. The anchored menu re-measures it on reflow so an iOS
   *  keyboard collapse (input was focused when + was tapped) re-pins the menu to
   *  the button instead of stranding it at the top of the screen. */
  anchorRef: React.RefObject<HTMLElement | null>
  /** Conversation container — scopes the leaf list overlay so it roots in the
   *  conversation stacking context, not document.body (where the parent drawer
   *  covers it). */
  containerRef: React.RefObject<HTMLElement | null>
  clinicId: string | null
  onClose: () => void
  /** User chose "Photo" — caller opens its file picker. */
  onPickPhoto: () => void
  /** User picked a clustered object to share. */
  onPick: (content: SharedRefContent) => void
  /** User picked a text template / order set — sent as a frozen note-blocks
   *  bundle (no live ref exists for config). Caller packs + sends into the chat. */
  onPickBundle: (source: BundleSource) => void
}

function formatEventWhen(startISO: string, category: string): string {
  const d = new Date(startISO)
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${date}, ${time}${category ? ` · ${category}` : ''}`
}

interface Row { id: string; label: string; sub: string }

/**
 * Anchored picker for the chat composer's "+" add menu. Two steps inside one
 * PreviewOverlay: a menu (Photo / Event / Map / Property / Template), then a
 * searchable list.
 *
 * Event / Map / Property send a LIVE `shared_ref` (opaque id + operational label,
 * resolved against the receiver's vault) via onPick. Template lists the user's
 * text templates + plan order sets and sends a FROZEN note-blocks bundle via
 * onPickBundle — config has no live ref (objectBundle.ts). Never the payload,
 * never PHI.
 */
export function SharedObjectPicker({
  isOpen,
  anchorRef,
  containerRef,
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

  // Note-block sources for the 'template' step: personal (profile) + clinic
  // content, merged. Text templates dedupe by abbr, order sets by id.
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

  const [step, setStep] = useState<Step>('menu')
  // Overlay whose features the user is drilling into (map-feature step).
  const [featureOverlay, setFeatureOverlay] = useState<LocalMapOverlay | null>(null)
  // A menu row that advances to a leaf step must NOT let the AnchoredMenu's
  // select-then-onClose collapse the whole picker — flag the navigation so our
  // onClose handler swallows that one close. Real dismissals (backdrop/Photo)
  // leave it false and fall through to close.
  const navigatingRef = useRef(false)

  // Property store only inits when its drawer opens; if a chat reaches the
  // property step with no cached items, do a one-shot clinic-items fetch.
  const [fetchedItems, setFetchedItems] = useState<LocalPropertyItem[] | null>(null)
  useEffect(() => {
    if (step === 'property-item' && storeItems.length === 0 && fetchedItems === null && clinicId) {
      void fetchClinicItems(clinicId).then(setFetchedItems).catch(() => setFetchedItems([]))
    }
  }, [step, storeItems.length, fetchedItems, clinicId])
  const propertyItems = storeItems.length > 0 ? storeItems : (fetchedItems ?? [])

  // Reset to the menu on every open AND close — resetting on close too means a
  // reopen never briefly renders a stale leaf step before this fires.
  useEffect(() => { setStep('menu'); setFeatureOverlay(null); navigatingRef.current = false }, [isOpen])

  // Advance from the root menu into a leaf step without the menu's own close
  // collapsing the picker.
  const goToStep = (next: Step) => { navigatingRef.current = true; setStep(next) }

  const buildRows = useMemo(() => (filter: string): Row[] => {
    const q = filter.trim().toLowerCase()
    if (step === 'calendar-event') {
      return [...events]
        .filter(e => !q || (e.title ?? '').toLowerCase().includes(q) || (e.location ?? '').toLowerCase().includes(q))
        .sort((a, b) => b.start_time.localeCompare(a.start_time))
        .slice(0, 60)
        .map(e => ({ id: e.id, label: e.title || 'Untitled event', sub: formatEventWhen(e.start_time, e.category) }))
    }
    if (step === 'map-overlay') {
      return [...overlays]
        .filter(o => !q || (o.name ?? '').toLowerCase().includes(q) || (o.description ?? '').toLowerCase().includes(q))
        .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
        .slice(0, 60)
        .map(o => ({
          id: o.id,
          label: o.name || 'Untitled overlay',
          sub: o.description || `${o.features?.length ?? 0} ${(o.features?.length ?? 0) === 1 ? 'feature' : 'features'}`,
        }))
    }
    if (step === 'property-item') {
      return [...propertyItems]
        .filter(i => !q
          || (i.name ?? '').toLowerCase().includes(q)
          || (i.nsn ?? '').toLowerCase().includes(q)
          || (i.serial_number ?? '').toLowerCase().includes(q))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
        .slice(0, 60)
        .map(i => {
          const qty = i.is_serialized ? (i.serial_number ? `SN ${i.serial_number}` : 'Serialized') : `Qty ${i.quantity}`
          return {
            id: i.id,
            label: i.name || i.nomenclature || 'Item',
            sub: i.nsn ? `${qty} · NSN ${i.nsn}` : qty,
          }
        })
    }
    if (step === 'map-feature' && featureOverlay) {
      const feats = featureOverlay.features ?? []
      const featureRows: Row[] = feats
        .filter(f => !q || (f.label ?? '').toLowerCase().includes(q))
        .map(f => ({ id: f.id, label: f.label || 'Untitled feature', sub: featureTypeLabel(f) }))
      // "Whole overlay" stays pinned at top when not actively filtering.
      const whole: Row = {
        id: WHOLE_OVERLAY,
        label: 'Whole overlay',
        sub: `${feats.length} ${feats.length === 1 ? 'feature' : 'features'}`,
      }
      return q ? featureRows : [whole, ...featureRows]
    }
    return []
  }, [step, events, overlays, propertyItems, featureOverlay])

  const handlePick = (kind: RefKind, row: Row) => {
    onPick({ type: 'shared_ref', refKind: kind, refId: row.id, label: row.label, subLabel: row.sub })
    onClose()
  }

  // Map-overlay rows drill into a feature step instead of picking immediately —
  // unless the overlay has no features, in which case share the whole overlay.
  const handleRowClick = (kind: RefKind, row: Row) => {
    if (kind === 'map-overlay') {
      const o = overlays.find(ov => ov.id === row.id)
      if (o && (o.features?.length ?? 0) > 0) { setFeatureOverlay(o); setStep('map-feature'); return }
    }
    handlePick(kind, row)
  }

  // Feature step: "Whole overlay" → overlay-scoped ref; a feature → ref + featureId.
  const handlePickFeature = (row: Row) => {
    if (!featureOverlay) return
    if (row.id === WHOLE_OVERLAY) {
      const count = featureOverlay.features?.length ?? 0
      onPick({
        type: 'shared_ref',
        refKind: 'map-overlay',
        refId: featureOverlay.id,
        label: featureOverlay.name || 'Untitled overlay',
        subLabel: featureOverlay.description || `${count} ${count === 1 ? 'feature' : 'features'}`,
      })
    } else {
      const f = featureOverlay.features?.find(ff => ff.id === row.id)
      if (!f) return
      onPick({
        type: 'shared_ref',
        refKind: 'map-overlay',
        refId: featureOverlay.id,
        featureId: f.id,
        label: f.label || 'Waypoint',
        subLabel: featureOverlay.name || 'Overlay',
      })
    }
    onClose()
  }

  // ── Template step (text templates + order sets → frozen note-blocks bundle) ──
  interface TemplateRow { id: string; label: string; sub: string; isOrderSet: boolean }
  const orderSetSub = (o: PlanOrderSet): string => {
    const n = Object.values(o.presets).reduce((sum, arr) => sum + (arr?.length ?? 0), 0)
    return `Order set · ${n} ${n === 1 ? 'order' : 'orders'}`
  }
  const buildTemplateRows = (filter: string): TemplateRow[] => {
    const q = filter.trim().toLowerCase()
    const te: TemplateRow[] = textTemplates
      .filter(t => !q || t.abbr.toLowerCase().includes(q) || (t.expansion ?? '').toLowerCase().includes(q))
      .map(t => ({ id: `te:${t.abbr}`, label: t.abbr, sub: t.expansion?.trim() || 'Text template', isOrderSet: false }))
    const os: TemplateRow[] = orderSets
      .filter(o => !q || o.name.toLowerCase().includes(q))
      .map(o => ({ id: `os:${o.id}`, label: o.name, sub: orderSetSub(o), isOrderSet: true }))
    return [...te, ...os].slice(0, 80)
  }
  const handlePickTemplate = (row: TemplateRow) => {
    if (row.isOrderSet) {
      const o = orderSets.find(x => `os:${x.id}` === row.id)
      if (!o) return
      onPickBundle({ kind: 'note-blocks', blocks: { planOrderSets: [o] }, label: o.name, subLabel: 'Order set' })
    } else {
      const t = textTemplates.find(x => `te:${x.abbr}` === row.id)
      if (!t) return
      onPickBundle({ kind: 'note-blocks', blocks: { textExpanders: [t] }, label: t.abbr, subLabel: 'Text template' })
    }
    onClose()
  }
  const templateList = (filter: string) => {
    const rows = buildTemplateRows(filter)
    if (rows.length === 0) {
      return <p className="text-[10pt] text-tertiary text-center py-10">No templates to share</p>
    }
    return (
      <div className="py-1">
        {rows.map(row => {
          const RowIcon = row.isOrderSet ? ClipboardList : FileText
          return (
            <button
              key={row.id}
              onClick={() => handlePickTemplate(row)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary/5 active:scale-[0.99] transition-all text-left"
            >
              <div className="w-9 h-9 rounded-full bg-themeblue3/10 flex items-center justify-center shrink-0">
                <RowIcon size={16} className="text-themeblue3" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11pt] font-medium text-primary truncate">{row.label}</p>
                <p className="text-[9pt] text-tertiary truncate">{row.sub}</p>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  const title = step === 'menu' ? 'Share'
    : step === 'calendar-event' ? 'Share an event'
    : step === 'property-item' ? 'Share an item'
    : step === 'template' ? 'Share a template'
    : step === 'map-feature' ? (featureOverlay?.name || 'Share a feature')
    : 'Share a map'

  // ── Menu step — the canonical anchored list menu (same primitive as the
  // message long-press menu). Photo fires the file picker; the rest advance to a
  // searchable leaf list. ──
  const menuItems: ContextMenuItem[] = [
    { key: 'photo', label: 'Photo', icon: ImageIcon, onAction: onPickPhoto },
    { key: 'event', label: 'Event', icon: Calendar, onAction: () => goToStep('calendar-event') },
    { key: 'map', label: 'Map', icon: MapIcon, onAction: () => goToStep('map-overlay') },
    { key: 'property', label: 'Property', icon: Package, onAction: () => goToStep('property-item') },
    { key: 'template', label: 'Template', icon: FileText, onAction: () => goToStep('template') },
  ]

  // ── Object-list step (also the map-feature drill-in) ────────────────────
  const list = (filter: string) => {
    const isFeatureStep = step === 'map-feature'
    const kind = step as RefKind
    const rows = buildRows(filter)
    const Icon = kind === 'calendar-event' ? Calendar : kind === 'property-item' ? Package : MapIcon
    const emptyText = isFeatureStep ? 'No features to share'
      : kind === 'calendar-event' ? 'No events to share'
      : kind === 'property-item' ? 'No property to share'
      : 'No maps to share'
    if (rows.length === 0) {
      return <p className="text-[10pt] text-tertiary text-center py-10">{emptyText}</p>
    }
    const rowIcon = (row: Row) => {
      if (!isFeatureStep || row.id === WHOLE_OVERLAY) return Icon
      const f = featureOverlay?.features?.find(ff => ff.id === row.id)
      return f ? featureIcon(f) : MapIcon
    }
    return (
      <div className="py-1">
        {rows.map(row => {
          const RowIcon = rowIcon(row)
          return (
            <button
              key={row.id}
              onClick={() => isFeatureStep ? handlePickFeature(row) : handleRowClick(kind, row)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary/5 active:scale-[0.99] transition-all text-left"
            >
              <div className="w-9 h-9 rounded-full bg-themeblue3/10 flex items-center justify-center shrink-0">
                <RowIcon size={16} className="text-themeblue3" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11pt] font-medium text-primary truncate">{row.label}</p>
                <p className="text-[9pt] text-tertiary truncate">{row.sub}</p>
              </div>
              {!isFeatureStep && kind === 'map-overlay' && (
                <ChevronRight size={16} className="text-tertiary shrink-0" />
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // Root menu → canonical anchored menu (live-anchored, so an iOS keyboard
  // collapse re-pins it to the + button). Closed state falls here too, so a stale
  // leaf never flashes on reopen.
  if (!isOpen || step === 'menu') {
    return (
      <AnchoredMenu
        isOpen={isOpen}
        anchorRef={anchorRef}
        dataTour="messages-share"
        layout="list"
        align="left"
        items={menuItems}
        onClose={() => {
          if (navigatingRef.current) { navigatingRef.current = false; return }
          onClose()
        }}
      />
    )
  }

  // Leaf steps — searchable object / template lists stay in the anchored
  // PreviewOverlay (a static context-menu submenu can't host a search field).
  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={anchorRef.current?.getBoundingClientRect() ?? null}
      containerRef={containerRef}
      anchored
      title={title}
      onBack={step === 'map-feature' ? () => setStep('map-overlay') : () => setStep('menu')}
      maxWidth={320}
      previewMaxHeight="50dvh"
      searchPlaceholder="Filter…"
      preview={(filter: string) => step === 'template' ? templateList(filter) : list(filter)}
    />
  )
}
