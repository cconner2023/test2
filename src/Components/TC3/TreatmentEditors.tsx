import { X } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { getBodyRegion, getRegionLabel, getRegionCenter } from '../../Utilities/bodyRegionMap'
import { TC3BodyDiagramSvg } from './TC3BodyDiagramSvg'
import type {
  TourniquetType, TQCategory, DressingType, BodyRegion, TC3Marker,
} from '../../Types/TC3Types'

/* ── Cell primitives — the VitalsForm popover language ──────────────
   Bare inputs (no rounded-full / shadow), iOS-zoom-safe (text-base on mobile).
   Shared so the tourniquet/dressing editors render identically wherever they
   are hosted — MARCH section overlay OR the body-marker popover. */
export const cellInput = 'w-full bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-base md:text-sm'

/** Hosts a vertical stack of cells. Flat — rows divided by hairline borders. */
export function CellCard({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

/** One labelled cell — label on top, value below. Carries its own bottom
    divider; pass `bare` when the parent row owns the divider. */
export function Cell({ label, children, className, bare }: {
  label: string
  children: React.ReactNode
  className?: string
  bare?: boolean
}) {
  return (
    <div className={`flex flex-col gap-0.5 px-3 py-2 ${bare ? '' : 'border-b border-primary/6 last:border-0'} ${className ?? ''}`}>
      <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest">{label}</span>
      {children}
    </div>
  )
}

/** Flat segmented selector — NO pills (see conventions/TOGGLE pattern). */
export function Segmented<T extends string>({ options, value, onChange, capitalize }: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  capitalize?: boolean
}) {
  return (
    <div className="flex flex-wrap mt-0.5">
      {options.map((opt) => (
        <button
          key={opt} type="button" onClick={() => onChange(opt)}
          className={`px-3 py-0.5 transition-colors ${value === opt ? 'bg-themeblue3' : 'active:bg-tertiary/5'}`}
        >
          <span className={`text-[9pt] ${capitalize ? 'capitalize' : ''} ${value === opt ? 'text-white font-medium' : 'text-secondary'}`}>{opt}</span>
        </button>
      ))}
    </div>
  )
}

/** Location picker — the body diagram is ALWAYS visible (never a blank input). */
export function LocationCell({ value, marker, onChange, label = 'Location' }: {
  value: string
  marker?: TC3Marker | null
  onChange: (label: string, region: BodyRegion | '') => void
  label?: string
}) {
  const handlePick = (x: number, y: number) => {
    const region = getBodyRegion(x, y)
    const regionLabel = region ? getRegionLabel(region) : ''
    if (regionLabel) onChange(regionLabel, region)
  }
  return (
    <div className="flex flex-col gap-1 px-3 py-2 border-b border-primary/6 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9pt] font-medium ${value ? 'text-primary' : 'text-tertiary/50'}`}>{value || 'Tap diagram'}</span>
          {value && (
            <button type="button" onClick={() => onChange('', '')} className="text-tertiary active:scale-90">
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="flex justify-center pt-1">
        <TC3BodyDiagramSvg markers={marker ? [marker] : []} onAddMarker={handlePick} compact />
      </div>
    </div>
  )
}

/* ── Constants — single source of truth for treatment option sets ── */
export const TOURNIQUET_TYPES: TourniquetType[] = ['CAT', 'SOFT-T', 'other']
export const TQ_CATEGORIES: TQCategory[] = ['Extremity', 'Junctional', 'Truncal']
export const DRESSING_TYPES: DressingType[] = ['Hemostatic', 'Pressure', 'Other']

/* ── Editors ───────────────────────────────────────────────────────
   The canonical treatment overlays. Hosted inside MARCH's PreviewOverlay
   AND the body-marker popover, so the editor is written once. `showLocation`
   is off when the host already owns the pin's location (the marker popover). */

export function TourniquetEditor({ id, showLocation = true }: { id: string; showLocation?: boolean }) {
  const tq = useTC3Store((s) => s.card.march.massiveHemorrhage.tourniquets.find((t) => t.id === id))
  const markers = useTC3Store((s) => s.card.markers)
  const updateTourniquet = useTC3Store((s) => s.updateTourniquet)
  const addMarker = useTC3Store((s) => s.addMarker)
  const updateMarker = useTC3Store((s) => s.updateMarker)
  if (!tq) return null

  const handleLocation = (label: string, region: BodyRegion | '') => {
    updateTourniquet(id, { location: label })
    if (!region) return
    const center = getRegionCenter(region)
    if (!center) return
    if (tq.injuryId) {
      updateMarker(tq.injuryId, { bodyRegion: region, x: center.x, y: center.y })
    } else {
      const markerId = crypto.randomUUID()
      // Link the tourniquet first so syncMarkerToMarch finds it and updates rather than duplicating
      updateTourniquet(id, { location: label, injuryId: markerId })
      addMarker({
        id: markerId, x: center.x, y: center.y, bodyRegion: region,
        injuries: [], treatments: ['tourniquet'], procedures: [],
        gauge: '', tqType: tq.type, tqCategory: tq.tqCategory,
        dressingType: 'Hemostatic', priority: '',
        dateTime: new Date().toISOString().slice(0, 16), description: '',
      })
    }
  }

  const marker = tq.injuryId ? markers.find((m) => m.id === tq.injuryId) : null

  return (
    <CellCard>
      <Cell label="Time">
        <input type="text" inputMode="numeric" value={tq.time}
          onChange={(e) => updateTourniquet(id, { time: e.target.value })}
          placeholder="HH:MM" className={cellInput} />
      </Cell>
      <Cell label="Category">
        <Segmented options={TQ_CATEGORIES} value={tq.tqCategory} onChange={(v) => updateTourniquet(id, { tqCategory: v })} />
      </Cell>
      <Cell label="Type">
        <Segmented options={TOURNIQUET_TYPES} value={tq.type} onChange={(v) => updateTourniquet(id, { type: v })} />
      </Cell>
      {showLocation && <LocationCell value={tq.location} marker={marker} onChange={handleLocation} />}
    </CellCard>
  )
}

export function DressingEditor({ id, showLocation = true }: { id: string; showLocation?: boolean }) {
  const h = useTC3Store((s) => s.card.march.massiveHemorrhage.hemostatics.find((d) => d.id === id))
  const markers = useTC3Store((s) => s.card.markers)
  const updateHemostatic = useTC3Store((s) => s.updateHemostatic)
  const addMarker = useTC3Store((s) => s.addMarker)
  const updateMarker = useTC3Store((s) => s.updateMarker)
  if (!h) return null

  const handleLocation = (label: string, region: BodyRegion | '') => {
    updateHemostatic(id, { location: label })
    if (!region) return
    const center = getRegionCenter(region)
    if (!center) return
    if (h.injuryId) {
      updateMarker(h.injuryId, { bodyRegion: region, x: center.x, y: center.y })
    } else {
      const markerId = crypto.randomUUID()
      updateHemostatic(id, { location: label, injuryId: markerId })
      addMarker({
        id: markerId, x: center.x, y: center.y, bodyRegion: region,
        injuries: [], treatments: ['hemostatic'], procedures: [],
        gauge: '', tqType: 'CAT', tqCategory: 'Extremity',
        dressingType: h.dressingType, priority: '',
        dateTime: new Date().toISOString().slice(0, 16), description: '',
      })
    }
  }

  const marker = h.injuryId ? markers.find((m) => m.id === h.injuryId) : null

  return (
    <CellCard>
      <Cell label="Time">
        <input type="text" inputMode="numeric" value={h.time ?? ''}
          onChange={(e) => updateHemostatic(id, { time: e.target.value })}
          placeholder="HH:MM" className={cellInput} />
      </Cell>
      <Cell label="Dressing Type">
        <Segmented options={DRESSING_TYPES} value={h.dressingType} onChange={(v) => updateHemostatic(id, { dressingType: v })} />
      </Cell>
      <Cell label="Agent">
        <input type="text" value={h.type}
          onChange={(e) => updateHemostatic(id, { type: e.target.value })}
          placeholder="Combat Gauze, QuikClot..." className={cellInput} />
      </Cell>
      {showLocation && <LocationCell value={h.location} marker={marker} onChange={handleLocation} />}
    </CellCard>
  )
}
