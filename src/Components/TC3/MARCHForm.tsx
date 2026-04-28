import { memo, useState, useCallback, useRef } from 'react'
import { Plus, X, Check, ChevronRight, MapPin } from 'lucide-react'
import type {
  TC3Tourniquet, TC3Hemostatic, TC3IVAccess, TC3Medication,
  TourniquetType, TQCategory, DressingType, NeedleDecompSide,
  MedRoute, MedCategory, BodyRegion,
} from '../../Types/TC3Types'
import { useTC3Store } from '../../stores/useTC3Store'
import { PreviewOverlay } from '../PreviewOverlay'
import { Section, SectionHeader } from '../Section'
import { ActionButton } from '../ActionButton'
import { ActionPill } from '../ActionPill'
import { getBodyRegion, getRegionLabel, getRegionCenter } from '../../Utilities/bodyRegionMap'
import { TC3BodyDiagramSvg } from './TC3BodyDiagramSvg'

// ── Shared input / select classes ────────────────
const inputCls = 'w-full px-4 py-2.5 rounded-full text-sm text-primary bg-themewhite border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none transition-all placeholder:text-tertiary'
const selectCls = 'px-4 py-2.5 rounded-full text-sm text-primary bg-themewhite border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:outline-none transition-all'

// ── Location region picker ────────────────────────
function LocationRegionPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (label: string, region: BodyRegion | '') => void
}) {
  const [open, setOpen] = useState(false)

  const handlePick = (x: number, y: number) => {
    const region = getBodyRegion(x, y)
    const label = region ? getRegionLabel(region) : ''
    if (label) {
      onChange(label, region)
      setOpen(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(s => !s)}
        className="w-full px-4 py-2.5 rounded-full text-sm bg-themewhite border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:outline-none transition-all flex items-center justify-between gap-2"
      >
        <span className={value ? 'text-primary' : 'text-tertiary'}>{value || 'Select on diagram'}</span>
        {value ? (
          <X
            size={14}
            className="text-tertiary shrink-0"
            onClick={(e) => { e.stopPropagation(); onChange('', '') }}
          />
        ) : (
          <MapPin size={14} className="text-tertiary shrink-0" />
        )}
      </button>
      {open && (
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden flex justify-center py-2">
          <TC3BodyDiagramSvg onAddMarker={handlePick} compact />
        </div>
      )}
    </div>
  )
}

// ── Constants ────────────────────────────────────
const TOURNIQUET_TYPES: TourniquetType[] = ['CAT', 'SOFT-T', 'other']
const TQ_CATEGORIES: TQCategory[] = ['Extremity', 'Junctional', 'Truncal']
const DRESSING_TYPES: DressingType[] = ['Hemostatic', 'Pressure', 'Other']
const SIDE_OPTIONS: NeedleDecompSide[] = ['left', 'right', 'bilateral']
const MED_ROUTES: MedRoute[] = ['IV', 'IM', 'IO', 'PO', 'IN', 'PR', 'topical']
const ROUTE_OPTIONS: ('IV' | 'IO')[] = ['IV', 'IO']

const CATEGORIZED_MEDS: { category: MedCategory; label: string; meds: { name: string; dose: string; route: MedRoute }[] }[] = [
  {
    category: 'Analgesic', label: 'Analgesic',
    meds: [
      { name: 'Ketamine', dose: '50mg', route: 'IV' },
      { name: 'Ketamine', dose: '300mg', route: 'IM' },
      { name: 'Fentanyl', dose: '50mcg', route: 'IV' },
      { name: 'Morphine', dose: '5mg', route: 'IV' },
      { name: 'Acetaminophen', dose: '500mg', route: 'PO' },
      { name: 'Meloxicam', dose: '15mg', route: 'PO' },
    ],
  },
  {
    category: 'Antibiotic', label: 'Antibiotic',
    meds: [
      { name: 'Moxifloxacin', dose: '400mg', route: 'PO' },
      { name: 'Ertapenem', dose: '1g', route: 'IV' },
    ],
  },
  {
    category: 'Other', label: 'Other',
    meds: [
      { name: 'TXA', dose: '1g', route: 'IV' },
      { name: 'Ondansetron', dose: '4mg', route: 'IV' },
    ],
  },
]

const COMMON_FLUIDS = [
  { type: 'Normal Saline', volume: '1000mL' },
  { type: 'Lactated Ringers', volume: '1000mL' },
  { type: 'Hextend', volume: '500mL' },
  { type: 'Plasma-Lyte', volume: '1000mL' },
]

const COMMON_BLOOD = [
  { type: 'Whole Blood', volume: '1 unit' },
  { type: 'pRBC', volume: '1 unit' },
  { type: 'FFP', volume: '1 unit' },
  { type: 'Platelets', volume: '1 unit' },
]

// ── MARCH category primitives ────────────────────
type MarchCat = 'H' | 'A' | 'B' | 'C'

const MARCH_COLORS: Record<MarchCat, string> = {
  H: 'bg-themeredred/15 text-themeredred',
  A: 'bg-amber-500/15 text-amber-600',
  B: 'bg-sky-500/15 text-sky-600',
  C: 'bg-themegreen/15 text-themegreen',
}

/** Display letters spell MARCH: H→M, A→A, B→R, C→C */
const MARCH_LABELS: Record<MarchCat, string> = { H: 'M', A: 'A', B: 'R', C: 'C' }

/** Small dot used in the add-menu overlay */
function MarchBadge({ cat }: { cat: MarchCat }) {
  return (
    <span className={`text-[9pt] md:text-[9pt] font-bold w-4 h-4 rounded flex items-center justify-center shrink-0 ${MARCH_COLORS[cat]}`}>
      {MARCH_LABELS[cat]}
    </span>
  )
}

/** Full-size icon used in list card rows */
function MarchIcon({ cat }: { cat: MarchCat }) {
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
      <span className="text-[10pt] font-bold text-tertiary">{MARCH_LABELS[cat]}</span>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────
function nowHHMM() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
}

function PillSelector<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt} type="button" onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-full text-[9pt] font-semibold border transition-all active:scale-95
            ${value === opt
              ? 'bg-themeblue3 text-white border-transparent'
              : 'border-tertiary/15 text-tertiary bg-tertiary/8 hover:bg-tertiary/12'
            }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function InjuryBadge({ injuryId }: { injuryId?: string }) {
  const injuries = useTC3Store((s) => s.card.injuries)
  if (!injuryId) return null
  const inj = injuries.find(i => i.id === injuryId)
  if (!inj) return null
  const label = inj.bodyRegion ? getRegionLabel(inj.bodyRegion) : inj.type
  return (
    <span className="text-[9pt] md:text-[9pt] px-1.5 py-0.5 rounded-full bg-themeredred/10 text-themeredred font-medium whitespace-nowrap">
      {label}
    </span>
  )
}

// ── Types for unified row system ─────────────────
type RowKind =
  | { cat: 'H'; kind: 'tourniquet'; id: string }
  | { cat: 'H'; kind: 'dressing'; id: string }
  | { cat: 'A'; kind: 'airway'; key: AirwayKey }
  | { cat: 'B'; kind: 'breathing'; key: BreathingKey }
  | { cat: 'C'; kind: 'iv'; id: string }
  | { cat: 'C'; kind: 'med'; id: string }
  | { cat: 'C'; kind: 'fluid'; index: number }
  | { cat: 'C'; kind: 'blood'; index: number }

type AirwayKey = 'npa' | 'cric' | 'ett' | 'supraglottic' | 'chinLift'
type BreathingKey = 'needleDecomp' | 'chestSeal' | 'chestTube' | 'o2'

const AIRWAY_LABELS: Record<AirwayKey, string> = {
  npa: 'NPA', cric: 'CRIC', ett: 'ET-Tube', supraglottic: 'SGA', chinLift: 'Chin Lift',
}
const BREATHING_LABELS: Record<BreathingKey, string> = {
  needleDecomp: 'Needle-D', chestSeal: 'Chest Seal', chestTube: 'Chest Tube', o2: 'O₂',
}

// ── Add-menu items ───────────────────────────────
type AddMenuItem = { cat: MarchCat; label: string; action: string }
const ADD_MENU: AddMenuItem[] = [
  { cat: 'H', label: 'Tourniquet', action: 'tourniquet' },
  { cat: 'H', label: 'Dressing', action: 'dressing' },
  { cat: 'A', label: 'NPA', action: 'a:npa' },
  { cat: 'A', label: 'CRIC', action: 'a:cric' },
  { cat: 'A', label: 'ET-Tube', action: 'a:ett' },
  { cat: 'A', label: 'SGA', action: 'a:supraglottic' },
  { cat: 'A', label: 'Chin Lift', action: 'a:chinLift' },
  { cat: 'B', label: 'Needle-D', action: 'b:needleDecomp' },
  { cat: 'B', label: 'Chest Seal', action: 'b:chestSeal' },
  { cat: 'B', label: 'Chest Tube', action: 'b:chestTube' },
  { cat: 'B', label: 'O₂', action: 'b:o2' },
  { cat: 'C', label: 'IV/IO Access', action: 'iv' },
  { cat: 'C', label: 'Medication', action: 'med' },
  { cat: 'C', label: 'Fluid', action: 'fluid' },
  { cat: 'C', label: 'Blood Product', action: 'blood' },
]

// ── Popover previews ─────────────────────────────
function TourniquetPreview({ id }: { id: string }) {
  const tq = useTC3Store((s) => s.card.march.massiveHemorrhage.tourniquets.find((t) => t.id === id))
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

  return (
    <div className="px-4 py-3 space-y-3" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-1.5">
        <SectionHeader>Category</SectionHeader>
        <PillSelector options={TQ_CATEGORIES} value={tq.tqCategory} onChange={(v) => updateTourniquet(id, { tqCategory: v })} />
      </div>
      <div className="space-y-1.5">
        <SectionHeader>Type</SectionHeader>
        <PillSelector options={TOURNIQUET_TYPES} value={tq.type} onChange={(v) => updateTourniquet(id, { type: v })} />
      </div>
      <div className="space-y-1.5">
        <SectionHeader>Location</SectionHeader>
        <LocationRegionPicker value={tq.location} onChange={handleLocation} />
      </div>
      <div className="space-y-1.5">
        <SectionHeader>Time</SectionHeader>
        <input type="text" value={tq.time}
          onChange={(e) => updateTourniquet(id, { time: e.target.value })}
          placeholder="HH:MM"
          className={inputCls} />
      </div>
      <InjuryBadge injuryId={tq.injuryId} />
    </div>
  )
}

function DressingPreview({ id }: { id: string }) {
  const h = useTC3Store((s) => s.card.march.massiveHemorrhage.hemostatics.find((d) => d.id === id))
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

  return (
    <div className="px-4 py-3 space-y-3" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-1.5">
        <SectionHeader>Dressing Type</SectionHeader>
        <PillSelector options={DRESSING_TYPES} value={h.dressingType} onChange={(v) => updateHemostatic(id, { dressingType: v })} />
      </div>
      <div className="space-y-1.5">
        <SectionHeader>Agent</SectionHeader>
        <input type="text" value={h.type}
          onChange={(e) => updateHemostatic(id, { type: e.target.value })}
          placeholder="Combat Gauze, QuikClot..."
          className={inputCls} />
      </div>
      <div className="space-y-1.5">
        <SectionHeader>Location</SectionHeader>
        <LocationRegionPicker value={h.location} onChange={handleLocation} />
      </div>
      <InjuryBadge injuryId={h.injuryId} />
    </div>
  )
}

function NeedleDecompPreview() {
  const nd = useTC3Store((s) => s.card.march.respiration.needleDecomp)
  const updateNeedleDecomp = useTC3Store((s) => s.updateNeedleDecomp)
  return (
    <div className="px-4 py-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      <SectionHeader>Side</SectionHeader>
      <PillSelector
        options={SIDE_OPTIONS}
        value={nd.side}
        onChange={(side) => updateNeedleDecomp({ side })}
      />
    </div>
  )
}

function ChestSealPreview() {
  const cs = useTC3Store((s) => s.card.march.respiration.chestSeal)
  const updateChestSeal = useTC3Store((s) => s.updateChestSeal)
  return (
    <div className="px-4 py-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      <SectionHeader>Side</SectionHeader>
      <PillSelector
        options={SIDE_OPTIONS}
        value={cs.side}
        onChange={(side) => updateChestSeal({ side })}
      />
    </div>
  )
}

function O2Preview() {
  const resp = useTC3Store((s) => s.card.march.respiration)
  const updateRespirationO2 = useTC3Store((s) => s.updateRespirationO2)
  return (
    <div className="px-4 py-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      <SectionHeader>Method</SectionHeader>
      <input type="text" autoFocus value={resp.o2Method}
        onChange={(e) => updateRespirationO2(true, e.target.value)}
        placeholder="NRB, NC, BVM..."
        className={inputCls} />
    </div>
  )
}

function AirwayTypePreview() {
  const airway = useTC3Store((s) => s.card.march.airway)
  const updateAirway = useTC3Store((s) => s.updateAirway)
  return (
    <div className="px-4 py-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      <SectionHeader>Type / Size</SectionHeader>
      <input type="text" autoFocus value={airway.airwayType}
        onChange={(e) => updateAirway({ airwayType: e.target.value })}
        placeholder="Type / size..."
        className={inputCls} />
    </div>
  )
}

// ── Main component ───────────────────────────────
export const MARCHForm = memo(function MARCHForm() {
  // --- H: Hemorrhage ---
  const tourniquets = useTC3Store((s) => s.card.march.massiveHemorrhage.tourniquets)
  const hemostatics = useTC3Store((s) => s.card.march.massiveHemorrhage.hemostatics)
  const addTourniquet = useTC3Store((s) => s.addTourniquet)
  const removeTourniquet = useTC3Store((s) => s.removeTourniquet)
  const addHemostatic = useTC3Store((s) => s.addHemostatic)
  const removeHemostatic = useTC3Store((s) => s.removeHemostatic)

  // --- A: Airway ---
  const airway = useTC3Store((s) => s.card.march.airway)
  const updateAirway = useTC3Store((s) => s.updateAirway)

  // --- B: Breathing ---
  const respiration = useTC3Store((s) => s.card.march.respiration)
  const updateNeedleDecomp = useTC3Store((s) => s.updateNeedleDecomp)
  const updateChestSeal = useTC3Store((s) => s.updateChestSeal)
  const updateChestTube = useTC3Store((s) => s.updateChestTube)
  const updateRespirationO2 = useTC3Store((s) => s.updateRespirationO2)

  // --- C: Circulation ---
  const ivAccess = useTC3Store((s) => s.card.march.circulation.ivAccess)
  const addIVAccess = useTC3Store((s) => s.addIVAccess)
  const removeIVAccess = useTC3Store((s) => s.removeIVAccess)
  const markers = useTC3Store((s) => s.card.markers)
  const addMarker = useTC3Store((s) => s.addMarker)
  const updateMarker = useTC3Store((s) => s.updateMarker)
  const medications = useTC3Store((s) => s.card.medications)
  const addMedication = useTC3Store((s) => s.addMedication)
  const removeMedication = useTC3Store((s) => s.removeMedication)
  const fluids = useTC3Store((s) => s.card.march.circulation.fluids)
  const addFluid = useTC3Store((s) => s.addFluid)
  const removeFluid = useTC3Store((s) => s.removeFluid)
  const bloodProducts = useTC3Store((s) => s.card.march.circulation.bloodProducts)
  const addBloodProduct = useTC3Store((s) => s.addBloodProduct)
  const removeBloodProduct = useTC3Store((s) => s.removeBloodProduct)

  // --- UI state ---
  const [editing, setEditing] = useState<RowKind | null>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [addMenuPopover, setAddMenuPopover] = useState<string | null>(null) // for med/fluid/blood add popovers
  const anchorRef = useRef<DOMRect | null>(null)
  const fabRef = useRef<HTMLDivElement>(null)

  // --- Draft state for C items ---
  const [draftIV, setDraftIV] = useState<TC3IVAccess>({ id: '', type: 'IV', site: '', gauge: '18g', time: '' })
  const [draftMed, setDraftMed] = useState<TC3Medication>({ id: '', name: '', dose: '', route: 'IV', time: '', category: 'Other' })
  const [draftFluid, setDraftFluid] = useState({ type: '', volume: '', route: 'IV' as MedRoute, time: '' })
  const [draftBlood, setDraftBlood] = useState({ type: '', volume: '', route: 'IV' as MedRoute, time: '' })

  // --- Build flat row list sorted H → A → B → C ---
  const rows: RowKind[] = []

  // H
  tourniquets.forEach(tq => rows.push({ cat: 'H', kind: 'tourniquet', id: tq.id }))
  hemostatics.forEach(h => rows.push({ cat: 'H', kind: 'dressing', id: h.id }))

  // A
  const airwayKeys: AirwayKey[] = ['npa', 'cric', 'ett', 'supraglottic', 'chinLift']
  airwayKeys.forEach(key => { if (airway[key]) rows.push({ cat: 'A', kind: 'airway', key }) })

  // B
  if (respiration.needleDecomp.performed) rows.push({ cat: 'B', kind: 'breathing', key: 'needleDecomp' })
  if (respiration.chestSeal.applied) rows.push({ cat: 'B', kind: 'breathing', key: 'chestSeal' })
  if (respiration.chestTube) rows.push({ cat: 'B', kind: 'breathing', key: 'chestTube' })
  if (respiration.o2) rows.push({ cat: 'B', kind: 'breathing', key: 'o2' })

  // C
  ivAccess.forEach(iv => rows.push({ cat: 'C', kind: 'iv', id: iv.id }))
  medications.forEach(med => rows.push({ cat: 'C', kind: 'med', id: med.id }))
  fluids.forEach((_, i) => rows.push({ cat: 'C', kind: 'fluid', index: i }))
  bloodProducts.forEach((_, i) => rows.push({ cat: 'C', kind: 'blood', index: i }))

  // --- Row click opens edit popover ---
  const openEdit = useCallback((row: RowKind, e: React.MouseEvent) => {
    anchorRef.current = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setEditing(row)
    setShowAddMenu(false)
    setAddMenuPopover(null)
  }, [])

  // --- Close everything ---
  const closeAll = useCallback(() => {
    setEditing(null)
    setShowAddMenu(false)
    setAddMenuPopover(null)
  }, [])

  // --- FAB opens add menu ---
  const handleFab = useCallback(() => {
    if (fabRef.current) anchorRef.current = fabRef.current.getBoundingClientRect()
    setShowAddMenu(true)
    setEditing(null)
    setAddMenuPopover(null)
  }, [])

  // --- Add menu item handler ---
  const handleAddAction = useCallback((action: string) => {
    // Airway toggles — instant add, open edit for type details
    if (action.startsWith('a:')) {
      const key = action.slice(2) as AirwayKey
      updateAirway({ [key]: true })
      setShowAddMenu(false)
      // Open the airway type popover for NPA/CRIC/etc that might need detail
      return
    }
    // Breathing toggles
    if (action.startsWith('b:')) {
      const key = action.slice(2) as BreathingKey
      if (key === 'needleDecomp') {
        updateNeedleDecomp({ performed: true })
        setShowAddMenu(false)
        // Auto-open side picker
        anchorRef.current = fabRef.current?.getBoundingClientRect() ?? null
        setEditing({ cat: 'B', kind: 'breathing', key: 'needleDecomp' })
      } else if (key === 'chestSeal') {
        updateChestSeal({ applied: true })
        setShowAddMenu(false)
        anchorRef.current = fabRef.current?.getBoundingClientRect() ?? null
        setEditing({ cat: 'B', kind: 'breathing', key: 'chestSeal' })
      } else if (key === 'chestTube') {
        updateChestTube(true)
        setShowAddMenu(false)
      } else if (key === 'o2') {
        updateRespirationO2(true)
        setShowAddMenu(false)
        anchorRef.current = fabRef.current?.getBoundingClientRect() ?? null
        setEditing({ cat: 'B', kind: 'breathing', key: 'o2' })
      }
      return
    }
    // H: Tourniquet — create and open edit
    if (action === 'tourniquet') {
      const id = crypto.randomUUID()
      addTourniquet({
        id, location: '', type: 'CAT', tqCategory: 'Extremity',
        time: nowHHMM(),
      })
      setShowAddMenu(false)
      anchorRef.current = fabRef.current?.getBoundingClientRect() ?? null
      setEditing({ cat: 'H', kind: 'tourniquet', id })
      return
    }
    // H: Dressing
    if (action === 'dressing') {
      const id = crypto.randomUUID()
      addHemostatic({
        id, applied: true, type: 'Combat Gauze', location: '', dressingType: 'Hemostatic',
      })
      setShowAddMenu(false)
      anchorRef.current = fabRef.current?.getBoundingClientRect() ?? null
      setEditing({ cat: 'H', kind: 'dressing', id })
      return
    }
    // C: IV/IO
    if (action === 'iv') {
      const iv: TC3IVAccess = { id: crypto.randomUUID(), type: 'IV', site: '', gauge: '18g', time: nowHHMM() }
      setDraftIV(iv)
      setShowAddMenu(false)
      setAddMenuPopover('iv')
      return
    }
    // C: Medication
    if (action === 'med') {
      setDraftMed({ id: '', name: '', dose: '', route: 'IV', time: nowHHMM(), category: 'Other' })
      setShowAddMenu(false)
      setAddMenuPopover('med')
      return
    }
    // C: Fluid
    if (action === 'fluid') {
      setDraftFluid({ type: '', volume: '', route: 'IV', time: nowHHMM() })
      setShowAddMenu(false)
      setAddMenuPopover('fluid')
      return
    }
    // C: Blood
    if (action === 'blood') {
      setDraftBlood({ type: '', volume: '', route: 'IV', time: nowHHMM() })
      setShowAddMenu(false)
      setAddMenuPopover('blood')
      return
    }
  }, [updateAirway, updateNeedleDecomp, updateChestSeal, updateChestTube, updateRespirationO2, addTourniquet, addHemostatic])

  // --- Remove handler for editing popover ---
  const handleRemove = useCallback(() => {
    if (!editing) return
    if (editing.kind === 'tourniquet') removeTourniquet(editing.id)
    else if (editing.kind === 'dressing') removeHemostatic(editing.id)
    else if (editing.kind === 'airway') updateAirway({ [editing.key]: false })
    else if (editing.kind === 'breathing') {
      if (editing.key === 'needleDecomp') updateNeedleDecomp({ performed: false, side: 'none' })
      else if (editing.key === 'chestSeal') updateChestSeal({ applied: false, side: 'none' })
      else if (editing.key === 'chestTube') updateChestTube(false)
      else if (editing.key === 'o2') updateRespirationO2(false)
    }
    else if (editing.kind === 'iv') removeIVAccess(editing.id)
    else if (editing.kind === 'med') removeMedication(editing.id)
    else if (editing.kind === 'fluid') removeFluid(editing.index)
    else if (editing.kind === 'blood') removeBloodProduct(editing.index)
    setEditing(null)
  }, [editing, removeTourniquet, removeHemostatic, updateAirway, updateNeedleDecomp, updateChestSeal, updateChestTube, updateRespirationO2, removeIVAccess, removeMedication, removeFluid, removeBloodProduct])

  // --- Done handlers for C add popovers ---
  const handleDoneIV = useCallback(() => { addIVAccess(draftIV); closeAll() }, [draftIV, addIVAccess, closeAll])
  const handleDoneMed = useCallback(() => {
    if (!draftMed.name.trim()) { closeAll(); return }
    addMedication({ ...draftMed, id: crypto.randomUUID() }); closeAll()
  }, [draftMed, addMedication, closeAll])
  const handleDoneFluid = useCallback(() => {
    if (!draftFluid.type.trim()) { closeAll(); return }
    addFluid(draftFluid); closeAll()
  }, [draftFluid, addFluid, closeAll])
  const handleDoneBlood = useCallback(() => {
    if (!draftBlood.type.trim()) { closeAll(); return }
    addBloodProduct(draftBlood); closeAll()
  }, [draftBlood, addBloodProduct, closeAll])

  // --- Quick-add helpers ---
  const handleQuickAddMed = useCallback((med: { name: string; dose: string; route: MedRoute }, category: MedCategory) => {
    addMedication({ id: crypto.randomUUID(), name: med.name, dose: med.dose, route: med.route, time: nowHHMM(), category })
    closeAll()
  }, [addMedication, closeAll])
  const handleQuickAddFluid = useCallback((type: string, volume: string) => {
    addFluid({ type, volume, route: 'IV', time: nowHHMM() }); closeAll()
  }, [addFluid, closeAll])
  const handleQuickAddBlood = useCallback((type: string, volume: string) => {
    addBloodProduct({ type, volume, route: 'IV', time: nowHHMM() }); closeAll()
  }, [addBloodProduct, closeAll])

  // --- Edit popovers for C items (tap existing row) ---
  const handleEditDoneIV = useCallback(() => {
    if (!editing || editing.kind !== 'iv') return
    removeIVAccess(editing.id); addIVAccess(draftIV); setEditing(null)
  }, [editing, draftIV, removeIVAccess, addIVAccess])
  const handleEditDoneMed = useCallback(() => {
    if (!editing || editing.kind !== 'med') return
    removeMedication(editing.id); addMedication({ ...draftMed }); setEditing(null)
  }, [editing, draftMed, removeMedication, addMedication])
  const handleEditDoneFluid = useCallback(() => {
    if (!editing || editing.kind !== 'fluid') return
    removeFluid(editing.index); addFluid(draftFluid); setEditing(null)
  }, [editing, draftFluid, removeFluid, addFluid])
  const handleEditDoneBlood = useCallback(() => {
    if (!editing || editing.kind !== 'blood') return
    removeBloodProduct(editing.index); addBloodProduct(draftBlood); setEditing(null)
  }, [editing, draftBlood, removeBloodProduct, addBloodProduct])

  // --- Open edit for C items loads draft ---
  const openEditC = useCallback((row: RowKind, e: React.MouseEvent) => {
    anchorRef.current = (e.currentTarget as HTMLElement).getBoundingClientRect()
    if (row.kind === 'iv') {
      const iv = ivAccess.find(v => v.id === row.id)
      if (iv) setDraftIV({ ...iv })
    } else if (row.kind === 'med') {
      const med = medications.find(m => m.id === row.id)
      if (med) setDraftMed({ ...med })
    } else if (row.kind === 'fluid') {
      setDraftFluid({ ...fluids[row.index] })
    } else if (row.kind === 'blood') {
      setDraftBlood({ ...bloodProducts[row.index] })
    }
    setEditing(row)
    setShowAddMenu(false)
    setAddMenuPopover(null)
  }, [ivAccess, medications, fluids, bloodProducts])

  // --- Resolve current popover content ---
  let popoverPreview: React.ReactNode = null
  let popoverActions: { key: string; label: string; icon: typeof Check; onAction: () => void; variant?: 'default' | 'danger' }[] = []

  if (editing) {
    const removeAction = { key: 'remove', label: 'Remove', icon: X, onAction: handleRemove, variant: 'danger' as const }
    const doneAction = { key: 'done', label: 'Done', icon: Check, onAction: () => setEditing(null) }

    if (editing.kind === 'tourniquet') {
      popoverPreview = <TourniquetPreview id={editing.id} />
      popoverActions = [removeAction, doneAction]
    } else if (editing.kind === 'dressing') {
      popoverPreview = <DressingPreview id={editing.id} />
      popoverActions = [removeAction, doneAction]
    } else if (editing.kind === 'airway') {
      popoverPreview = <AirwayTypePreview />
      popoverActions = [removeAction, doneAction]
    } else if (editing.kind === 'breathing') {
      if (editing.key === 'needleDecomp') popoverPreview = <NeedleDecompPreview />
      else if (editing.key === 'chestSeal') popoverPreview = <ChestSealPreview />
      else if (editing.key === 'o2') popoverPreview = <O2Preview />
      // chestTube has no sub-fields — just remove/done
      popoverActions = [removeAction, doneAction]
    } else if (editing.kind === 'iv') {
      const handleIVSite = (label: string, region: BodyRegion | '') => {
        setDraftIV(d => ({ ...d, site: label }))
        if (!region) return
        const center = getRegionCenter(region)
        if (!center) return
        const existingMarker = markers.find(m => m.id === draftIV.id)
        if (existingMarker) {
          updateMarker(draftIV.id, { bodyRegion: region, x: center.x, y: center.y })
        } else {
          addMarker({
            id: draftIV.id, x: center.x, y: center.y, bodyRegion: region,
            injuries: [], treatments: [], procedures: [draftIV.type as 'IV' | 'IO'],
            gauge: draftIV.gauge, tqType: 'CAT', tqCategory: 'Extremity',
            dressingType: 'Hemostatic', priority: '',
            dateTime: draftIV.time
              ? `${new Date().toISOString().slice(0, 11)}${draftIV.time}`
              : new Date().toISOString().slice(0, 16),
            description: '',
          })
        }
      }
      popoverPreview = (
        <div className="px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            <SectionHeader>Access Type</SectionHeader>
            <PillSelector options={ROUTE_OPTIONS} value={draftIV.type} onChange={(v) => setDraftIV(d => ({ ...d, type: v }))} />
          </div>
          <div className="space-y-1.5">
            <SectionHeader>Site</SectionHeader>
            <LocationRegionPicker value={draftIV.site} onChange={handleIVSite} />
          </div>
          <div className="space-y-1.5">
            <SectionHeader>Gauge</SectionHeader>
            <input type="text" value={draftIV.gauge}
              onChange={(e) => setDraftIV(d => ({ ...d, gauge: e.target.value }))}
              placeholder="e.g. 18g"
              className={inputCls} />
          </div>
        </div>
      )
      popoverActions = [removeAction, { key: 'done', label: 'Done', icon: Check, onAction: handleEditDoneIV }]
    } else if (editing.kind === 'med') {
      popoverPreview = (
        <div className="px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            <SectionHeader>Medication</SectionHeader>
            <input type="text" autoFocus value={draftMed.name}
              onChange={(e) => setDraftMed(d => ({ ...d, name: e.target.value }))}
              placeholder="Medication name"
              className={inputCls} />
          </div>
          <div className="flex gap-2">
            <input type="text" value={draftMed.dose}
              onChange={(e) => setDraftMed(d => ({ ...d, dose: e.target.value }))}
              placeholder="Dose"
              className={`flex-1 px-4 py-2.5 rounded-full text-sm text-primary bg-themewhite border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none transition-all placeholder:text-tertiary`} />
            <select value={draftMed.route}
              onChange={(e) => setDraftMed(d => ({ ...d, route: e.target.value as MedRoute }))}
              className={selectCls}>
              {MED_ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <select value={draftMed.category}
            onChange={(e) => setDraftMed(d => ({ ...d, category: e.target.value as MedCategory }))}
            className={`w-full ${selectCls}`}>
            <option value="Analgesic">Analgesic</option>
            <option value="Antibiotic">Antibiotic</option>
            <option value="Other">Other</option>
          </select>
          <div className="space-y-1.5">
            <SectionHeader>Time</SectionHeader>
            <input type="text" value={draftMed.time}
              onChange={(e) => setDraftMed(d => ({ ...d, time: e.target.value }))}
              placeholder="HH:MM"
              className={inputCls} />
          </div>
        </div>
      )
      popoverActions = [removeAction, { key: 'done', label: 'Done', icon: Check, onAction: handleEditDoneMed }]
    } else if (editing.kind === 'fluid') {
      popoverPreview = (
        <div className="px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            <SectionHeader>Fluid Type</SectionHeader>
            <input type="text" autoFocus value={draftFluid.type}
              onChange={(e) => setDraftFluid(d => ({ ...d, type: e.target.value }))}
              placeholder="e.g. Normal Saline"
              className={inputCls} />
          </div>
          <div className="flex gap-2">
            <input type="text" value={draftFluid.volume}
              onChange={(e) => setDraftFluid(d => ({ ...d, volume: e.target.value }))}
              placeholder="Volume"
              className={`flex-1 px-4 py-2.5 rounded-full text-sm text-primary bg-themewhite border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none transition-all placeholder:text-tertiary`} />
            <select value={draftFluid.route}
              onChange={(e) => setDraftFluid(d => ({ ...d, route: e.target.value as MedRoute }))}
              className={selectCls}>
              {MED_ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <SectionHeader>Time</SectionHeader>
            <input type="text" value={draftFluid.time}
              onChange={(e) => setDraftFluid(d => ({ ...d, time: e.target.value }))}
              placeholder="HH:MM"
              className={inputCls} />
          </div>
        </div>
      )
      popoverActions = [removeAction, { key: 'done', label: 'Done', icon: Check, onAction: handleEditDoneFluid }]
    } else if (editing.kind === 'blood') {
      popoverPreview = (
        <div className="px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            <SectionHeader>Blood Product</SectionHeader>
            <input type="text" autoFocus value={draftBlood.type}
              onChange={(e) => setDraftBlood(d => ({ ...d, type: e.target.value }))}
              placeholder="e.g. Whole Blood"
              className={inputCls} />
          </div>
          <div className="flex gap-2">
            <input type="text" value={draftBlood.volume}
              onChange={(e) => setDraftBlood(d => ({ ...d, volume: e.target.value }))}
              placeholder="Volume"
              className={`flex-1 px-4 py-2.5 rounded-full text-sm text-primary bg-themewhite border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none transition-all placeholder:text-tertiary`} />
            <select value={draftBlood.route}
              onChange={(e) => setDraftBlood(d => ({ ...d, route: e.target.value as MedRoute }))}
              className={selectCls}>
              {MED_ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <SectionHeader>Time</SectionHeader>
            <input type="text" value={draftBlood.time}
              onChange={(e) => setDraftBlood(d => ({ ...d, time: e.target.value }))}
              placeholder="HH:MM"
              className={inputCls} />
          </div>
        </div>
      )
      popoverActions = [removeAction, { key: 'done', label: 'Done', icon: Check, onAction: handleEditDoneBlood }]
    }
  }

  // --- Add menu popovers (for C items that need forms) ---
  const chipCls = 'px-3 py-1.5 text-[10pt] font-medium rounded-full border border-themeblue3/10 bg-themewhite2 text-primary hover:bg-themeredred/5 hover:border-themeredred/20 transition-all active:scale-95'

  if (addMenuPopover === 'iv') {
    popoverPreview = (
      <div className="px-4 py-3 space-y-3">
        <div className="space-y-1.5">
          <SectionHeader>Access Type</SectionHeader>
          <PillSelector options={ROUTE_OPTIONS} value={draftIV.type} onChange={(v) => setDraftIV(d => ({ ...d, type: v }))} />
        </div>
        <div className="space-y-1.5">
          <SectionHeader>Site</SectionHeader>
          <LocationRegionPicker value={draftIV.site} onChange={(label) => setDraftIV(d => ({ ...d, site: label }))} />
        </div>
        <div className="space-y-1.5">
          <SectionHeader>Gauge</SectionHeader>
          <input type="text" value={draftIV.gauge}
            onChange={(e) => setDraftIV(d => ({ ...d, gauge: e.target.value }))}
            placeholder="e.g. 18g"
            className={inputCls} />
        </div>
      </div>
    )
    popoverActions = [{ key: 'done', label: 'Done', icon: Check, onAction: handleDoneIV }]
  } else if (addMenuPopover === 'med') {
    popoverPreview = (
      <div className="px-4 py-3 space-y-3">
        {CATEGORIZED_MEDS.map((group) => (
          <div key={group.category} className="space-y-1.5">
            <SectionHeader>{group.label}</SectionHeader>
            <div className="flex flex-wrap gap-1.5">
              {group.meds.map((med, i) => (
                <button key={i} onClick={() => handleQuickAddMed(med, group.category)} className={chipCls}>
                  {med.name} {med.dose} {med.route}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="border-t border-tertiary/10 pt-3 space-y-2">
          <SectionHeader>Custom</SectionHeader>
          <input type="text" value={draftMed.name}
            onChange={(e) => setDraftMed(d => ({ ...d, name: e.target.value }))}
            placeholder="Medication name"
            className={inputCls} />
          <div className="flex gap-2">
            <input type="text" value={draftMed.dose}
              onChange={(e) => setDraftMed(d => ({ ...d, dose: e.target.value }))}
              placeholder="Dose"
              className={`flex-1 px-4 py-2.5 rounded-full text-sm text-primary bg-themewhite border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none transition-all placeholder:text-tertiary`} />
            <select value={draftMed.route}
              onChange={(e) => setDraftMed(d => ({ ...d, route: e.target.value as MedRoute }))}
              className={selectCls}>
              {MED_ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <select value={draftMed.category}
            onChange={(e) => setDraftMed(d => ({ ...d, category: e.target.value as MedCategory }))}
            className={`w-full ${selectCls}`}>
            <option value="Analgesic">Analgesic</option>
            <option value="Antibiotic">Antibiotic</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
    )
    popoverActions = [{ key: 'done', label: 'Done', icon: Check, onAction: handleDoneMed }]
  } else if (addMenuPopover === 'fluid') {
    popoverPreview = (
      <div className="px-4 py-3 space-y-3">
        <SectionHeader>Common Fluids</SectionHeader>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_FLUIDS.map((f, i) => (
            <button key={i} onClick={() => handleQuickAddFluid(f.type, f.volume)} className={chipCls}>
              {f.type} {f.volume}
            </button>
          ))}
        </div>
        <div className="border-t border-tertiary/10 pt-3 space-y-2">
          <SectionHeader>Custom</SectionHeader>
          <input type="text" value={draftFluid.type}
            onChange={(e) => setDraftFluid(d => ({ ...d, type: e.target.value }))}
            placeholder="Fluid type"
            className={inputCls} />
          <input type="text" value={draftFluid.volume}
            onChange={(e) => setDraftFluid(d => ({ ...d, volume: e.target.value }))}
            placeholder="Volume"
            className={inputCls} />
        </div>
      </div>
    )
    popoverActions = [{ key: 'done', label: 'Done', icon: Check, onAction: handleDoneFluid }]
  } else if (addMenuPopover === 'blood') {
    popoverPreview = (
      <div className="px-4 py-3 space-y-3">
        <SectionHeader>Common Blood Products</SectionHeader>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_BLOOD.map((b, i) => (
            <button key={i} onClick={() => handleQuickAddBlood(b.type, b.volume)} className={chipCls}>
              {b.type} {b.volume}
            </button>
          ))}
        </div>
      </div>
    )
    popoverActions = [{ key: 'done', label: 'Done', icon: Check, onAction: handleDoneBlood }]
  }

  const isPopoverOpen = editing !== null || addMenuPopover !== null

  // --- Filter add menu to hide already-active airway/breathing toggles ---
  const filteredAddMenu = ADD_MENU.filter(item => {
    if (item.action.startsWith('a:')) {
      const key = item.action.slice(2) as AirwayKey
      return !airway[key]
    }
    if (item.action.startsWith('b:')) {
      const key = item.action.slice(2) as BreathingKey
      if (key === 'needleDecomp') return !respiration.needleDecomp.performed
      if (key === 'chestSeal') return !respiration.chestSeal.applied
      if (key === 'chestTube') return !respiration.chestTube
      if (key === 'o2') return !respiration.o2
    }
    return true
  })

  // --- Render row ---
  function renderRow(row: RowKind, idx: number, isLast: boolean) {
    const isC = row.kind === 'iv' || row.kind === 'med' || row.kind === 'fluid' || row.kind === 'blood'
    const onClick = isC ? (e: React.MouseEvent) => openEditC(row, e) : (e: React.MouseEvent) => openEdit(row, e)

    let icon: MarchCat = 'H'
    let primary = ''
    let secondary = ''
    let trailing = ''

    if (row.kind === 'tourniquet') {
      const tq = tourniquets.find(t => t.id === row.id)!
      icon = 'H'
      primary = `Tourniquet · ${tq.tqCategory}`
      secondary = [tq.type, tq.location].filter(Boolean).join(' · ')
      trailing = tq.time
    } else if (row.kind === 'dressing') {
      const h = hemostatics.find(d => d.id === row.id)!
      icon = 'H'
      primary = `${h.dressingType} Dressing`
      secondary = [h.type, h.location].filter(Boolean).join(' · ')
    } else if (row.kind === 'airway') {
      icon = 'A'
      primary = AIRWAY_LABELS[row.key]
      secondary = airway.airwayType
    } else if (row.kind === 'breathing') {
      icon = 'B'
      primary = BREATHING_LABELS[row.key]
      if (row.key === 'needleDecomp' && respiration.needleDecomp.side !== 'none')
        secondary = respiration.needleDecomp.side.charAt(0).toUpperCase() + respiration.needleDecomp.side.slice(1)
      else if (row.key === 'chestSeal' && respiration.chestSeal.side !== 'none')
        secondary = respiration.chestSeal.side.charAt(0).toUpperCase() + respiration.chestSeal.side.slice(1)
      else if (row.key === 'o2' && respiration.o2Method)
        secondary = respiration.o2Method
    } else if (row.kind === 'iv') {
      const iv = ivAccess.find(v => v.id === row.id)!
      icon = 'C'
      primary = `${iv.type} Access`
      secondary = [iv.gauge, iv.site || 'No site'].filter(Boolean).join(' · ')
    } else if (row.kind === 'med') {
      const med = medications.find(m => m.id === row.id)!
      icon = 'C'
      primary = med.name
      secondary = `${med.dose} ${med.route}`
      trailing = med.time
    } else if (row.kind === 'fluid') {
      const f = fluids[row.index]
      icon = 'C'
      primary = f.type
      secondary = `${f.volume} · ${f.route}`
      trailing = f.time
    } else if (row.kind === 'blood') {
      const b = bloodProducts[row.index]
      icon = 'C'
      primary = b.type
      secondary = `${b.volume} · ${b.route}`
      trailing = b.time
    }

    return (
      <button key={idx} type="button" onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-themeblue2/5 active:scale-[0.98] transition-all border-b border-primary/6 last:border-0 ${isLast ? 'pr-32' : ''}`}>
        <MarchIcon cat={icon} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary truncate">{primary}</p>
          {secondary && <p className="text-[9pt] text-secondary mt-0.5 truncate">{secondary}</p>}
        </div>
        {!isLast && trailing && <span className="text-[9pt] text-secondary shrink-0">{trailing}</span>}
        {!isLast && <ChevronRight size={16} className="text-tertiary shrink-0" />}
      </button>
    )
  }

  return (
    <div data-tour="tc3-march">
      <Section title="Interventions">
        <div className="relative rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          {rows.length === 0 ? (
            <p className="text-sm text-tertiary py-7 text-center">No interventions added</p>
          ) : (
            rows.map((row, idx) => renderRow(row, idx, idx === rows.length - 1))
          )}
          <div
            ref={fabRef}
            onClick={handleFab}
            className="absolute right-0 bottom-0 w-32 h-full flex items-center justify-end pr-2 pb-2 z-10 cursor-pointer"
            aria-hidden
          >
            <ActionPill shadow="sm">
              <ActionButton icon={Plus} label="Add intervention" onClick={handleFab} />
            </ActionPill>
          </div>
        </div>
      </Section>

      {/* Add menu popover */}
      <PreviewOverlay
        isOpen={showAddMenu}
        onClose={closeAll}
        anchorRect={anchorRef.current}
        preview={
          <div className="py-1">
            {(['H', 'A', 'B', 'C'] as MarchCat[]).map(cat => {
              const items = filteredAddMenu.filter(i => i.cat === cat)
              if (items.length === 0) return null
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 px-4 pt-2 pb-1">
                    <MarchBadge cat={cat} />
                    <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider">
                      {cat === 'H' ? 'Hemorrhage' : cat === 'A' ? 'Airway' : cat === 'B' ? 'Breathing' : 'Circulation'}
                    </p>
                  </div>
                  <div className="px-2 pb-1 space-y-0.5">
                    {items.map(item => (
                      <button
                        key={item.action}
                        type="button"
                        onClick={() => handleAddAction(item.action)}
                        className="flex items-center w-full text-left py-1.5 px-2 rounded-lg transition-colors active:scale-[0.98] hover:bg-tertiary/5"
                      >
                        <span className="text-sm text-primary min-w-0 truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        }
        actions={[]}
      />

      {/* Edit / Add-form popover */}
      <PreviewOverlay
        isOpen={isPopoverOpen}
        onClose={closeAll}
        anchorRect={anchorRef.current}
        preview={popoverPreview}
        actions={popoverActions}
        previewMaxHeight="65dvh"
      />
    </div>
  )
})
