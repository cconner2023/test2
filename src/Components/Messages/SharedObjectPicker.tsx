import { useEffect, useMemo, useState } from 'react'
import { Calendar, Map as MapIcon, Image as ImageIcon, Package, ChevronRight } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { useMapOverlaysStore, useMapOverlaysCache } from '../../stores/useMapOverlaysStore'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { fetchClinicItems } from '../../lib/propertyService'
import type { LocalPropertyItem } from '../../Types/PropertyTypes'
import type { SharedRefContent } from '../../lib/signal/messageContent'

type RefKind = 'calendar-event' | 'map-overlay' | 'property-item'
type Step = 'menu' | RefKind

interface SharedObjectPickerProps {
  isOpen: boolean
  /** Bounding rect of the + button — drives the popover transform origin. */
  anchorRect: DOMRect | null
  /** Conversation container — scopes the overlay so it roots in the conversation
   *  stacking context, not document.body (where the parent drawer covers it). */
  containerRef: React.RefObject<HTMLElement | null>
  clinicId: string | null
  onClose: () => void
  /** User chose "Photo" — caller opens its file picker. */
  onPickPhoto: () => void
  /** User picked a clustered object to share. */
  onPick: (content: SharedRefContent) => void
}

function formatEventWhen(startISO: string, category: string): string {
  const d = new Date(startISO)
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${date}, ${time}${category ? ` · ${category}` : ''}`
}

interface Row { id: string; label: string; sub: string }

/**
 * Anchored picker for sharing a clustered object (calendar event or map
 * overlay) into a chat as a deep-link card. Two steps inside one PreviewOverlay:
 * a menu (Photo / Event / Map), then a searchable object list. Reads the
 * already-synced Zustand caches — sends only an opaque id + operational label,
 * never the payload, never PHI.
 */
export function SharedObjectPicker({
  isOpen,
  anchorRect,
  containerRef,
  clinicId,
  onClose,
  onPickPhoto,
  onPick,
}: SharedObjectPickerProps) {
  useMapOverlaysCache(clinicId)

  const events = useCalendarStore(s => s.events)
  const overlays = useMapOverlaysStore(s => s.overlays)
  const storeItems = usePropertyStore(s => s.items)
  const [step, setStep] = useState<Step>('menu')

  // Property store only inits when its drawer opens; if a chat reaches the
  // property step with no cached items, do a one-shot clinic-items fetch.
  const [fetchedItems, setFetchedItems] = useState<LocalPropertyItem[] | null>(null)
  useEffect(() => {
    if (step === 'property-item' && storeItems.length === 0 && fetchedItems === null && clinicId) {
      void fetchClinicItems(clinicId).then(setFetchedItems).catch(() => setFetchedItems([]))
    }
  }, [step, storeItems.length, fetchedItems, clinicId])
  const propertyItems = storeItems.length > 0 ? storeItems : (fetchedItems ?? [])

  // Reset to the menu whenever the picker (re)opens.
  useEffect(() => { if (isOpen) setStep('menu') }, [isOpen])

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
    return []
  }, [step, events, overlays, propertyItems])

  const handlePick = (kind: RefKind, row: Row) => {
    onPick({ type: 'shared_ref', refKind: kind, refId: row.id, label: row.label, subLabel: row.sub })
    onClose()
  }

  const title = step === 'menu' ? 'Share'
    : step === 'calendar-event' ? 'Share an event'
    : step === 'property-item' ? 'Share an item'
    : 'Share a map'

  // ── Menu step ──────────────────────────────────────────────────────────
  const menu = (
    <div className="py-1" data-tour="messages-share">
      <button
        onClick={() => { onClose(); onPickPhoto() }}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 active:scale-[0.99] transition-all text-left"
      >
        <div className="w-9 h-9 rounded-full bg-themeblue3/10 flex items-center justify-center shrink-0">
          <ImageIcon size={16} className="text-themeblue3" />
        </div>
        <span className="text-[11pt] font-medium text-primary flex-1">Photo</span>
      </button>
      <button
        onClick={() => setStep('calendar-event')}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 active:scale-[0.99] transition-all text-left"
      >
        <div className="w-9 h-9 rounded-full bg-themeblue3/10 flex items-center justify-center shrink-0">
          <Calendar size={16} className="text-themeblue3" />
        </div>
        <span className="text-[11pt] font-medium text-primary flex-1">Event</span>
        <ChevronRight size={16} className="text-tertiary shrink-0" />
      </button>
      <button
        onClick={() => setStep('map-overlay')}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 active:scale-[0.99] transition-all text-left"
      >
        <div className="w-9 h-9 rounded-full bg-themeblue3/10 flex items-center justify-center shrink-0">
          <MapIcon size={16} className="text-themeblue3" />
        </div>
        <span className="text-[11pt] font-medium text-primary flex-1">Map</span>
        <ChevronRight size={16} className="text-tertiary shrink-0" />
      </button>
      <button
        onClick={() => setStep('property-item')}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 active:scale-[0.99] transition-all text-left"
      >
        <div className="w-9 h-9 rounded-full bg-themeblue3/10 flex items-center justify-center shrink-0">
          <Package size={16} className="text-themeblue3" />
        </div>
        <span className="text-[11pt] font-medium text-primary flex-1">Property</span>
        <ChevronRight size={16} className="text-tertiary shrink-0" />
      </button>
    </div>
  )

  // ── Object-list step ───────────────────────────────────────────────────
  const list = (filter: string) => {
    const kind = step as RefKind
    const rows = buildRows(filter)
    const Icon = kind === 'calendar-event' ? Calendar : kind === 'property-item' ? Package : MapIcon
    const emptyText = kind === 'calendar-event' ? 'No events to share'
      : kind === 'property-item' ? 'No property to share'
      : 'No maps to share'
    if (rows.length === 0) {
      return <p className="text-[10pt] text-tertiary text-center py-10">{emptyText}</p>
    }
    return (
      <div className="py-1">
        {rows.map(row => (
          <button
            key={row.id}
            onClick={() => handlePick(kind, row)}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary/5 active:scale-[0.99] transition-all text-left"
          >
            <div className="w-9 h-9 rounded-full bg-themeblue3/10 flex items-center justify-center shrink-0">
              <Icon size={16} className="text-themeblue3" />
            </div>
            <div className="min-w-0">
              <p className="text-[11pt] font-medium text-primary truncate">{row.label}</p>
              <p className="text-[9pt] text-tertiary truncate">{row.sub}</p>
            </div>
          </button>
        ))}
      </div>
    )
  }

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={anchorRect}
      containerRef={containerRef}
      anchored
      title={title}
      onBack={step === 'menu' ? undefined : () => setStep('menu')}
      maxWidth={320}
      previewMaxHeight="50dvh"
      {...(step === 'menu'
        ? {}
        : { searchPlaceholder: 'Filter…', preview: (filter: string) => list(filter) })}
    >
      {step === 'menu' ? menu : null}
    </PreviewOverlay>
  )
}
