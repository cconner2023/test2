import { memo, useState, useCallback, useRef } from 'react'
import { Plus, X, Check, ChevronRight } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { ContextMenuPreview } from '../ContextMenuPreview'
import { getRegionLabel } from '../../Utilities/bodyRegionMap'
import type {
  TC3Tourniquet, TC3Hemostatic, TC3IVAccess, TC3Medication,
  TourniquetType, TQCategory, DressingType, NeedleDecompSide,
  MedRoute, MedCategory,
} from '../../Types/TC3Types'

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

// ── MARCH category badge ─────────────────────────
type MarchCat = 'H' | 'A' | 'B' | 'C'
const MARCH_COLORS: Record<MarchCat, string> = {
  H: 'bg-themeredred/15 text-themeredred',
  A: 'bg-amber-500/15 text-amber-600',
  B: 'bg-sky-500/15 text-sky-600',
  C: 'bg-themegreen/15 text-themegreen',
}

function MarchBadge({ cat }: { cat: MarchCat }) {
  return (
    <span className={`text-[8px] font-bold w-4 h-4 rounded flex items-center justify-center shrink-0 ${MARCH_COLORS[cat]}`}>
      {cat}
    </span>
  )
}

// ── Helpers ───────────────────────────────────────
function nowHHMM() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
}

function PillSelector<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt} type="button" onClick={() => onChange(opt)}
          className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all
            ${value === opt
              ? 'border-themeredred/25 bg-themeredred/10 text-primary'
              : 'border-tertiary/15 text-tertiary/60 hover:bg-tertiary/5'
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
    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-themeredred/10 text-themeredred font-medium whitespace-nowrap">
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
  if (!tq) return null
  return (
    <div className="p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-1">
        <label className="text-[10px] text-tertiary/50">Category</label>
        <PillSelector options={TQ_CATEGORIES} value={tq.tqCategory} onChange={(v) => updateTourniquet(id, { tqCategory: v })} />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-tertiary/50">Type</label>
        <PillSelector options={TOURNIQUET_TYPES} value={tq.type} onChange={(v) => updateTourniquet(id, { type: v })} />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-tertiary/50">Location</label>
        <input type="text" autoFocus value={tq.location}
          onChange={(e) => updateTourniquet(id, { location: e.target.value })}
          placeholder="Location"
          className="w-full text-xs px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-tertiary/50">Time</label>
        <input type="text" value={tq.time}
          onChange={(e) => updateTourniquet(id, { time: e.target.value })}
          placeholder="Time"
          className="w-full text-xs px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
      </div>
      <InjuryBadge injuryId={tq.injuryId} />
    </div>
  )
}

function DressingPreview({ id }: { id: string }) {
  const h = useTC3Store((s) => s.card.march.massiveHemorrhage.hemostatics.find((d) => d.id === id))
  const updateHemostatic = useTC3Store((s) => s.updateHemostatic)
  if (!h) return null
  return (
    <div className="p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-1">
        <label className="text-[10px] text-tertiary/50">Dressing Type</label>
        <PillSelector options={DRESSING_TYPES} value={h.dressingType} onChange={(v) => updateHemostatic(id, { dressingType: v })} />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-tertiary/50">Type</label>
        <input type="text" value={h.type}
          onChange={(e) => updateHemostatic(id, { type: e.target.value })}
          placeholder="Type (Combat Gauze, etc.)"
          className="w-full text-xs px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-tertiary/50">Location</label>
        <input type="text" autoFocus value={h.location}
          onChange={(e) => updateHemostatic(id, { location: e.target.value })}
          placeholder="Location"
          className="w-full text-xs px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
      </div>
      <InjuryBadge injuryId={h.injuryId} />
    </div>
  )
}

function NeedleDecompPreview() {
  const nd = useTC3Store((s) => s.card.march.respiration.needleDecomp)
  const updateNeedleDecomp = useTC3Store((s) => s.updateNeedleDecomp)
  return (
    <div className="p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      <label className="text-[10px] text-tertiary/50">Side</label>
      <div className="flex gap-2">
        {SIDE_OPTIONS.map((side) => (
          <button key={side} onClick={() => updateNeedleDecomp({ side })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
              ${nd.side === side ? 'border-themeredred/25 bg-themeredred/10 text-primary' : 'border-tertiary/15 text-tertiary hover:bg-tertiary/5'}`}>
            {side.charAt(0).toUpperCase() + side.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )
}

function ChestSealPreview() {
  const cs = useTC3Store((s) => s.card.march.respiration.chestSeal)
  const updateChestSeal = useTC3Store((s) => s.updateChestSeal)
  return (
    <div className="p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      <label className="text-[10px] text-tertiary/50">Side</label>
      <div className="flex gap-2">
        {SIDE_OPTIONS.map((side) => (
          <button key={side} onClick={() => updateChestSeal({ side })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
              ${cs.side === side ? 'border-themeredred/25 bg-themeredred/10 text-primary' : 'border-tertiary/15 text-tertiary hover:bg-tertiary/5'}`}>
            {side.charAt(0).toUpperCase() + side.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )
}

function O2Preview() {
  const resp = useTC3Store((s) => s.card.march.respiration)
  const updateRespirationO2 = useTC3Store((s) => s.updateRespirationO2)
  return (
    <div className="p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      <label className="text-[10px] text-tertiary/50">Method</label>
      <input type="text" autoFocus value={resp.o2Method}
        onChange={(e) => updateRespirationO2(true, e.target.value)}
        placeholder="Method (NRB, NC, BVM...)"
        className="w-full text-xs px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
    </div>
  )
}

function AirwayTypePreview() {
  const airway = useTC3Store((s) => s.card.march.airway)
  const updateAirway = useTC3Store((s) => s.updateAirway)
  return (
    <div className="p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      <label className="text-[10px] text-tertiary/50">Airway Type / Size</label>
      <input type="text" autoFocus value={airway.airwayType}
        onChange={(e) => updateAirway({ airwayType: e.target.value })}
        placeholder="Type / size..."
        className="w-full text-xs px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
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
  const fabRef = useRef<HTMLButtonElement>(null)

  // --- Draft state for C items ---
  const [draftIV, setDraftIV] = useState<TC3IVAccess>({ id: '', type: 'IV', site: '', gauge: '18g' })
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
      const iv: TC3IVAccess = { id: crypto.randomUUID(), type: 'IV', site: '', gauge: '18g' }
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
      popoverPreview = (
        <div className="p-4 space-y-3">
          <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">IV/IO Access</p>
          <div className="space-y-2">
            <div className="flex gap-2">
              <select value={draftIV.type}
                onChange={(e) => setDraftIV(d => ({ ...d, type: e.target.value as 'IV' | 'IO' }))}
                className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary">
                {ROUTE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <input type="text" autoFocus value={draftIV.site}
              onChange={(e) => setDraftIV(d => ({ ...d, site: e.target.value }))}
              placeholder="Site (e.g. R AC)"
              className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
            <input type="text" value={draftIV.gauge}
              onChange={(e) => setDraftIV(d => ({ ...d, gauge: e.target.value }))}
              placeholder="Gauge (e.g. 18g)"
              className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
          </div>
        </div>
      )
      popoverActions = [removeAction, { key: 'done', label: 'Done', icon: Check, onAction: handleEditDoneIV }]
    } else if (editing.kind === 'med') {
      popoverPreview = (
        <div className="p-4 space-y-2">
          <input type="text" autoFocus value={draftMed.name}
            onChange={(e) => setDraftMed(d => ({ ...d, name: e.target.value }))}
            placeholder="Medication name"
            className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
          <div className="flex gap-2">
            <input type="text" value={draftMed.dose}
              onChange={(e) => setDraftMed(d => ({ ...d, dose: e.target.value }))}
              placeholder="Dose"
              className="flex-1 text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
            <select value={draftMed.route}
              onChange={(e) => setDraftMed(d => ({ ...d, route: e.target.value as MedRoute }))}
              className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary">
              {MED_ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <select value={draftMed.category}
            onChange={(e) => setDraftMed(d => ({ ...d, category: e.target.value as MedCategory }))}
            className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary">
            <option value="Analgesic">Analgesic</option>
            <option value="Antibiotic">Antibiotic</option>
            <option value="Other">Other</option>
          </select>
          <input type="text" value={draftMed.time}
            onChange={(e) => setDraftMed(d => ({ ...d, time: e.target.value }))}
            placeholder="Time (HH:MM)"
            className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
        </div>
      )
      popoverActions = [removeAction, { key: 'done', label: 'Done', icon: Check, onAction: handleEditDoneMed }]
    } else if (editing.kind === 'fluid') {
      popoverPreview = (
        <div className="p-4 space-y-2">
          <input type="text" autoFocus value={draftFluid.type}
            onChange={(e) => setDraftFluid(d => ({ ...d, type: e.target.value }))}
            placeholder="Fluid type"
            className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
          <input type="text" value={draftFluid.volume}
            onChange={(e) => setDraftFluid(d => ({ ...d, volume: e.target.value }))}
            placeholder="Volume"
            className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
          <select value={draftFluid.route}
            onChange={(e) => setDraftFluid(d => ({ ...d, route: e.target.value as MedRoute }))}
            className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary">
            {MED_ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input type="text" value={draftFluid.time}
            onChange={(e) => setDraftFluid(d => ({ ...d, time: e.target.value }))}
            placeholder="Time (HH:MM)"
            className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
        </div>
      )
      popoverActions = [removeAction, { key: 'done', label: 'Done', icon: Check, onAction: handleEditDoneFluid }]
    } else if (editing.kind === 'blood') {
      popoverPreview = (
        <div className="p-4 space-y-2">
          <input type="text" autoFocus value={draftBlood.type}
            onChange={(e) => setDraftBlood(d => ({ ...d, type: e.target.value }))}
            placeholder="Blood product type"
            className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
          <input type="text" value={draftBlood.volume}
            onChange={(e) => setDraftBlood(d => ({ ...d, volume: e.target.value }))}
            placeholder="Volume"
            className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
          <select value={draftBlood.route}
            onChange={(e) => setDraftBlood(d => ({ ...d, route: e.target.value as MedRoute }))}
            className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary">
            {MED_ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input type="text" value={draftBlood.time}
            onChange={(e) => setDraftBlood(d => ({ ...d, time: e.target.value }))}
            placeholder="Time (HH:MM)"
            className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
        </div>
      )
      popoverActions = [removeAction, { key: 'done', label: 'Done', icon: Check, onAction: handleEditDoneBlood }]
    }
  }

  // --- Add menu popovers (for C items that need forms) ---
  if (addMenuPopover === 'iv') {
    popoverPreview = (
      <div className="p-4 space-y-3">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">IV/IO Access</p>
        <div className="space-y-2">
          <div className="flex gap-2">
            <select value={draftIV.type}
              onChange={(e) => setDraftIV(d => ({ ...d, type: e.target.value as 'IV' | 'IO' }))}
              className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary">
              {ROUTE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <input type="text" autoFocus value={draftIV.site}
            onChange={(e) => setDraftIV(d => ({ ...d, site: e.target.value }))}
            placeholder="Site (e.g. R AC)"
            className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
          <input type="text" value={draftIV.gauge}
            onChange={(e) => setDraftIV(d => ({ ...d, gauge: e.target.value }))}
            placeholder="Gauge (e.g. 18g)"
            className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
        </div>
      </div>
    )
    popoverActions = [{ key: 'done', label: 'Done', icon: Check, onAction: handleDoneIV }]
  } else if (addMenuPopover === 'med') {
    popoverPreview = (
      <div className="p-4 space-y-3">
        {CATEGORIZED_MEDS.map((group) => (
          <div key={group.category} className="space-y-1.5">
            <p className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase">{group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.meds.map((med, i) => (
                <button key={i} onClick={() => handleQuickAddMed(med, group.category)}
                  className="px-2.5 py-1.5 text-[11px] rounded-lg border border-tertiary/15 bg-themewhite2 text-tertiary hover:bg-themeredred/5 hover:border-themeredred/20 transition-all">
                  {med.name} {med.dose} {med.route}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="border-t border-tertiary/10 pt-3 space-y-2">
          <p className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase">Custom</p>
          <input type="text" value={draftMed.name}
            onChange={(e) => setDraftMed(d => ({ ...d, name: e.target.value }))}
            placeholder="Medication name"
            className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
          <div className="flex gap-2">
            <input type="text" value={draftMed.dose}
              onChange={(e) => setDraftMed(d => ({ ...d, dose: e.target.value }))}
              placeholder="Dose"
              className="flex-1 text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
            <select value={draftMed.route}
              onChange={(e) => setDraftMed(d => ({ ...d, route: e.target.value as MedRoute }))}
              className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary">
              {MED_ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <select value={draftMed.category}
            onChange={(e) => setDraftMed(d => ({ ...d, category: e.target.value as MedCategory }))}
            className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary">
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
      <div className="p-4 space-y-3">
        <p className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase">Common Fluids</p>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_FLUIDS.map((f, i) => (
            <button key={i} onClick={() => handleQuickAddFluid(f.type, f.volume)}
              className="px-2.5 py-1.5 text-[11px] rounded-lg border border-tertiary/15 bg-themewhite2 text-tertiary hover:bg-themeredred/5 hover:border-themeredred/20 transition-all">
              {f.type} {f.volume}
            </button>
          ))}
        </div>
        <div className="border-t border-tertiary/10 pt-3 space-y-2">
          <p className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase">Custom</p>
          <input type="text" value={draftFluid.type}
            onChange={(e) => setDraftFluid(d => ({ ...d, type: e.target.value }))}
            placeholder="Fluid type"
            className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
          <input type="text" value={draftFluid.volume}
            onChange={(e) => setDraftFluid(d => ({ ...d, volume: e.target.value }))}
            placeholder="Volume"
            className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary" />
        </div>
      </div>
    )
    popoverActions = [{ key: 'done', label: 'Done', icon: Check, onAction: handleDoneFluid }]
  } else if (addMenuPopover === 'blood') {
    popoverPreview = (
      <div className="p-4 space-y-3">
        <p className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase">Common Blood Products</p>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_BLOOD.map((b, i) => (
            <button key={i} onClick={() => handleQuickAddBlood(b.type, b.volume)}
              className="px-2.5 py-1.5 text-[11px] rounded-lg border border-tertiary/15 bg-themewhite2 text-tertiary hover:bg-themeredred/5 hover:border-themeredred/20 transition-all">
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
  function renderRow(row: RowKind, idx: number) {
    const isC = row.kind === 'iv' || row.kind === 'med' || row.kind === 'fluid' || row.kind === 'blood'
    const onClick = isC ? (e: React.MouseEvent) => openEditC(row, e) : (e: React.MouseEvent) => openEdit(row, e)

    let content: React.ReactNode = null

    if (row.kind === 'tourniquet') {
      const tq = tourniquets.find(t => t.id === row.id)!
      content = (
        <>
          <MarchBadge cat="H" />
          <span className="text-xs font-medium text-primary">{tq.tqCategory}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-tertiary/8 text-tertiary/70 shrink-0">{tq.type}</span>
          {tq.location && <span className="text-[10px] text-tertiary/60 truncate min-w-0">{tq.location}</span>}
          <span className="flex-1" />
          {tq.time && <span className="text-[10px] text-tertiary/50 shrink-0">{tq.time}</span>}
          <InjuryBadge injuryId={tq.injuryId} />
        </>
      )
    } else if (row.kind === 'dressing') {
      const h = hemostatics.find(d => d.id === row.id)!
      content = (
        <>
          <MarchBadge cat="H" />
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-themeblue2/10 text-themeblue2 shrink-0">{h.dressingType}</span>
          {h.type && <span className="text-xs font-medium text-primary truncate min-w-0">{h.type}</span>}
          {h.location && <span className="text-[10px] text-tertiary/60 truncate min-w-0">{h.location}</span>}
          <span className="flex-1" />
          <InjuryBadge injuryId={h.injuryId} />
        </>
      )
    } else if (row.kind === 'airway') {
      content = (
        <>
          <MarchBadge cat="A" />
          <span className="text-xs font-medium text-primary">{AIRWAY_LABELS[row.key]}</span>
          {airway.airwayType && <span className="text-[10px] text-tertiary/60 truncate min-w-0">{airway.airwayType}</span>}
          <span className="flex-1" />
        </>
      )
    } else if (row.kind === 'breathing') {
      let detail = ''
      if (row.key === 'needleDecomp' && respiration.needleDecomp.side !== 'none')
        detail = respiration.needleDecomp.side.charAt(0).toUpperCase() + respiration.needleDecomp.side.slice(1)
      else if (row.key === 'chestSeal' && respiration.chestSeal.side !== 'none')
        detail = respiration.chestSeal.side.charAt(0).toUpperCase() + respiration.chestSeal.side.slice(1)
      else if (row.key === 'o2' && respiration.o2Method)
        detail = respiration.o2Method
      content = (
        <>
          <MarchBadge cat="B" />
          <span className="text-xs font-medium text-primary">{BREATHING_LABELS[row.key]}</span>
          {detail && <span className="text-[10px] text-tertiary/60 truncate min-w-0">{detail}</span>}
          <span className="flex-1" />
        </>
      )
    } else if (row.kind === 'iv') {
      const iv = ivAccess.find(v => v.id === row.id)!
      content = (
        <>
          <MarchBadge cat="C" />
          <span className="text-xs font-medium text-primary">{iv.type}</span>
          <span className="text-xs text-tertiary/70">{iv.gauge}</span>
          <span className="text-xs text-tertiary/70 truncate">{iv.site || 'No site'}</span>
          <span className="flex-1" />
        </>
      )
    } else if (row.kind === 'med') {
      const med = medications.find(m => m.id === row.id)!
      content = (
        <>
          <MarchBadge cat="C" />
          <span className="text-xs font-medium text-primary truncate">{med.name}</span>
          <span className="text-xs text-tertiary/70">{med.dose}</span>
          <span className="text-xs text-tertiary/70">{med.route}</span>
          <span className="flex-1" />
          <span className="text-[10px] text-tertiary/60">{med.time}</span>
        </>
      )
    } else if (row.kind === 'fluid') {
      const f = fluids[row.index]
      content = (
        <>
          <MarchBadge cat="C" />
          <span className="text-xs font-medium text-primary truncate">{f.type}</span>
          <span className="text-xs text-tertiary/70">{f.volume}</span>
          <span className="text-xs text-tertiary/70">{f.route}</span>
          <span className="flex-1" />
          <span className="text-[10px] text-tertiary/60">{f.time}</span>
        </>
      )
    } else if (row.kind === 'blood') {
      const b = bloodProducts[row.index]
      content = (
        <>
          <MarchBadge cat="C" />
          <span className="text-xs font-medium text-primary truncate">{b.type}</span>
          <span className="text-xs text-tertiary/70">{b.volume}</span>
          <span className="text-xs text-tertiary/70">{b.route}</span>
          <span className="flex-1" />
          <span className="text-[10px] text-tertiary/60">{b.time}</span>
        </>
      )
    }

    return (
      <button key={idx} type="button" onClick={onClick}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-themeblue2/5 active:scale-[0.98] transition-all">
        {content}
        <ChevronRight size={14} className="text-tertiary/30 shrink-0" />
      </button>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">
          Interventions
        </p>
        {rows.length > 0 && (
          <button ref={fabRef} type="button" onClick={handleFab}
            className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40">
            <Plus size={13} />
          </button>
        )}
      </div>

      {/* Unified list */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-tertiary/15 bg-themewhite2/50 py-6 flex flex-col items-center gap-1.5">
          <button ref={fabRef} type="button" onClick={handleFab}
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40">
            <Plus size={15} />
          </button>
          <p className="text-[10px] text-tertiary/40">Add intervention</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/8">
          {rows.map((row, idx) => renderRow(row, idx))}
          {/* Inline add at bottom — matches VitalsForm pattern */}
          <button ref={fabRef} type="button" onClick={handleFab}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] text-tertiary/50 hover:text-primary hover:bg-themeblue2/5 transition-colors">
            <Plus size={12} /> Add
          </button>
        </div>
      )}

      {/* Add menu popover */}
      <ContextMenuPreview
        isVisible={showAddMenu}
        onClose={closeAll}
        anchorRect={anchorRef.current}
        preview={
          <div className="p-3 space-y-2">
            {(['H', 'A', 'B', 'C'] as MarchCat[]).map(cat => {
              const items = filteredAddMenu.filter(i => i.cat === cat)
              if (items.length === 0) return null
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center gap-1.5 px-1">
                    <MarchBadge cat={cat} />
                    <span className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase">
                      {cat === 'H' ? 'Hemorrhage' : cat === 'A' ? 'Airway' : cat === 'B' ? 'Breathing' : 'Circulation'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map(item => (
                      <button key={item.action} onClick={() => handleAddAction(item.action)}
                        className="px-2.5 py-1.5 text-[11px] rounded-lg border border-tertiary/15 bg-themewhite text-tertiary hover:bg-themeredred/5 hover:border-themeredred/20 transition-all">
                        {item.label}
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
      <ContextMenuPreview
        isVisible={isPopoverOpen}
        onClose={closeAll}
        anchorRect={anchorRef.current}
        preview={popoverPreview}
        actions={popoverActions}
      />
    </div>
  )
})
