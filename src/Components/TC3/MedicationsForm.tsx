import { memo, useState, useCallback } from 'react'
import { X, Check, ChevronRight, Plus } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { ContextMenuPreview } from '../ContextMenuPreview'
import type { TC3Medication, TC3IVAccess, MedRoute, MedCategory } from '../../Types/TC3Types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MED_ROUTES: MedRoute[] = ['IV', 'IM', 'IO', 'PO', 'IN', 'PR', 'topical']

const CATEGORIZED_MEDS: { category: MedCategory; label: string; meds: { name: string; dose: string; route: MedRoute }[] }[] = [
  {
    category: 'Analgesic',
    label: 'Analgesic',
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
    category: 'Antibiotic',
    label: 'Antibiotic',
    meds: [
      { name: 'Moxifloxacin', dose: '400mg', route: 'PO' },
      { name: 'Ertapenem', dose: '1g', route: 'IV' },
    ],
  },
  {
    category: 'Other',
    label: 'Other',
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

const ROUTE_OPTIONS: ('IV' | 'IO')[] = ['IV', 'IO']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowHHMM() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
}

type EditingType = 'med' | 'fluid' | 'blood' | 'iv' | null
type AddingType = 'med' | 'fluid' | 'blood' | 'iv' | null

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MedicationsForm = memo(function MedicationsForm() {
  // --- Store selectors ---
  const medications = useTC3Store((s) => s.card.medications)
  const addMedication = useTC3Store((s) => s.addMedication)
  const removeMedication = useTC3Store((s) => s.removeMedication)

  const fluids = useTC3Store((s) => s.card.march.circulation.fluids)
  const addFluid = useTC3Store((s) => s.addFluid)
  const removeFluid = useTC3Store((s) => s.removeFluid)

  const bloodProducts = useTC3Store((s) => s.card.march.circulation.bloodProducts)
  const addBloodProduct = useTC3Store((s) => s.addBloodProduct)
  const removeBloodProduct = useTC3Store((s) => s.removeBloodProduct)

  const ivAccess = useTC3Store((s) => s.card.march.circulation.ivAccess)
  const addIVAccess = useTC3Store((s) => s.addIVAccess)
  const removeIVAccess = useTC3Store((s) => s.removeIVAccess)

  // --- Popover state ---
  const [editingType, setEditingType] = useState<EditingType>(null)
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [addingType, setAddingType] = useState<AddingType>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  // --- Draft state for add/edit popovers ---
  const [draftMed, setDraftMed] = useState<TC3Medication>({ id: '', name: '', dose: '', route: 'IV', time: '', category: 'Other' })
  const [draftFluid, setDraftFluid] = useState({ type: '', volume: '', route: 'IV' as MedRoute, time: '' })
  const [draftBlood, setDraftBlood] = useState({ type: '', volume: '', route: 'IV' as MedRoute, time: '' })
  const [draftIV, setDraftIV] = useState<TC3IVAccess>({ id: '', type: 'IV', site: '', gauge: '18g' })

  // --- Helpers to capture anchor rect from click event ---
  const captureRect = useCallback((e: React.MouseEvent) => {
    setAnchorRect((e.currentTarget as HTMLElement).getBoundingClientRect())
  }, [])

  // --- Close popover ---
  const closePopover = useCallback(() => {
    setEditingType(null)
    setEditingId(null)
    setAddingType(null)
    setAnchorRect(null)
  }, [])

  // --- Add handlers ---
  const handleAddIV = useCallback((e: React.MouseEvent) => {
    captureRect(e)
    const iv: TC3IVAccess = { id: crypto.randomUUID(), type: 'IV', site: '', gauge: '18g', time: nowHHMM() }
    setDraftIV(iv)
    setAddingType('iv')
  }, [captureRect])

  const handleAddMed = useCallback((e: React.MouseEvent) => {
    captureRect(e)
    setDraftMed({ id: '', name: '', dose: '', route: 'IV', time: nowHHMM(), category: 'Other' })
    setAddingType('med')
  }, [captureRect])

  const handleAddFluid = useCallback((e: React.MouseEvent) => {
    captureRect(e)
    setDraftFluid({ type: '', volume: '', route: 'IV', time: nowHHMM() })
    setAddingType('fluid')
  }, [captureRect])

  const handleAddBlood = useCallback((e: React.MouseEvent) => {
    captureRect(e)
    setDraftBlood({ type: '', volume: '', route: 'IV', time: nowHHMM() })
    setAddingType('blood')
  }, [captureRect])

  // --- Edit handlers (tap existing chip) ---
  const handleEditIV = useCallback((iv: TC3IVAccess, e: React.MouseEvent) => {
    captureRect(e)
    setDraftIV({ ...iv })
    setEditingType('iv')
    setEditingId(iv.id)
  }, [captureRect])

  const handleEditMed = useCallback((med: TC3Medication, e: React.MouseEvent) => {
    captureRect(e)
    setDraftMed({ ...med })
    setEditingType('med')
    setEditingId(med.id)
  }, [captureRect])

  const handleEditFluid = useCallback((fluid: typeof fluids[0], index: number, e: React.MouseEvent) => {
    captureRect(e)
    setDraftFluid({ ...fluid })
    setEditingType('fluid')
    setEditingId(index)
  }, [captureRect])

  const handleEditBlood = useCallback((blood: typeof bloodProducts[0], index: number, e: React.MouseEvent) => {
    captureRect(e)
    setDraftBlood({ ...blood })
    setEditingType('blood')
    setEditingId(index)
  }, [captureRect])

  // --- Done handlers (save from popover) ---
  const handleDoneIV = useCallback(() => {
    if (addingType === 'iv') {
      addIVAccess(draftIV)
    } else if (editingType === 'iv' && typeof editingId === 'string') {
      removeIVAccess(editingId)
      addIVAccess(draftIV)
    }
    closePopover()
  }, [addingType, editingType, editingId, draftIV, addIVAccess, removeIVAccess, closePopover])

  const handleDoneMed = useCallback(() => {
    if (addingType === 'med') {
      if (!draftMed.name.trim()) { closePopover(); return }
      addMedication({ ...draftMed, id: crypto.randomUUID() })
    } else if (editingType === 'med' && typeof editingId === 'string') {
      removeMedication(editingId)
      addMedication({ ...draftMed })
    }
    closePopover()
  }, [addingType, editingType, editingId, draftMed, addMedication, removeMedication, closePopover])

  const handleDoneFluid = useCallback(() => {
    if (addingType === 'fluid') {
      if (!draftFluid.type.trim()) { closePopover(); return }
      addFluid(draftFluid)
    } else if (editingType === 'fluid' && typeof editingId === 'number') {
      removeFluid(editingId)
      addFluid(draftFluid)
    }
    closePopover()
  }, [addingType, editingType, editingId, draftFluid, addFluid, removeFluid, closePopover])

  const handleDoneBlood = useCallback(() => {
    if (addingType === 'blood') {
      if (!draftBlood.type.trim()) { closePopover(); return }
      addBloodProduct(draftBlood)
    } else if (editingType === 'blood' && typeof editingId === 'number') {
      removeBloodProduct(editingId)
      addBloodProduct(draftBlood)
    }
    closePopover()
  }, [addingType, editingType, editingId, draftBlood, addBloodProduct, removeBloodProduct, closePopover])

  // --- Remove handlers ---
  const handleRemoveIV = useCallback(() => {
    if (typeof editingId === 'string') removeIVAccess(editingId)
    closePopover()
  }, [editingId, removeIVAccess, closePopover])

  const handleRemoveMed = useCallback(() => {
    if (typeof editingId === 'string') removeMedication(editingId)
    closePopover()
  }, [editingId, removeMedication, closePopover])

  const handleRemoveFluid = useCallback(() => {
    if (typeof editingId === 'number') removeFluid(editingId)
    closePopover()
  }, [editingId, removeFluid, closePopover])

  const handleRemoveBlood = useCallback(() => {
    if (typeof editingId === 'number') removeBloodProduct(editingId)
    closePopover()
  }, [editingId, removeBloodProduct, closePopover])

  // --- Quick-add (add + close, no edit popover) ---
  const handleQuickAddMed = useCallback((med: { name: string; dose: string; route: MedRoute }, category: MedCategory) => {
    addMedication({
      id: crypto.randomUUID(),
      name: med.name,
      dose: med.dose,
      route: med.route,
      time: nowHHMM(),
      category,
    })
    closePopover()
  }, [addMedication, closePopover])

  const handleQuickAddFluid = useCallback((type: string, volume: string) => {
    addFluid({ type, volume, route: 'IV', time: nowHHMM() })
    closePopover()
  }, [addFluid, closePopover])

  const handleQuickAddBlood = useCallback((type: string, volume: string) => {
    addBloodProduct({ type, volume, route: 'IV', time: nowHHMM() })
    closePopover()
  }, [addBloodProduct, closePopover])

  // --- Group medications by category ---
  const groupedMeds = medications.reduce<Record<MedCategory, TC3Medication[]>>((acc, med) => {
    const cat = med.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(med)
    return acc
  }, { Analgesic: [], Antibiotic: [], Other: [] })

  // --- Determine which popover is open ---
  const popoverType = addingType || editingType
  const isAdding = addingType !== null

  // -----------------------------------------------------------------------
  // Popover previews
  // -----------------------------------------------------------------------

  const ivPopoverPreview = (
    <div className="p-4 space-y-3">
      <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">IV/IO Access</p>
      <div className="space-y-2">
        <div className="flex gap-2">
          <select
            value={draftIV.type}
            onChange={(e) => setDraftIV(d => ({ ...d, type: e.target.value as 'IV' | 'IO' }))}
            className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary"
          >
            {ROUTE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <input
          type="text"
          value={draftIV.site}
          onChange={(e) => setDraftIV(d => ({ ...d, site: e.target.value }))}
          placeholder="Site (e.g. R AC)"
          className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
          autoFocus
        />
        <input
          type="text"
          value={draftIV.gauge}
          onChange={(e) => setDraftIV(d => ({ ...d, gauge: e.target.value }))}
          placeholder="Gauge (e.g. 18g)"
          className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
        />
      </div>
    </div>
  )

  const medAddPopoverPreview = (
    <div className="p-4 space-y-3">
      {CATEGORIZED_MEDS.map((group) => (
        <div key={group.category} className="space-y-1.5">
          <p className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase">{group.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.meds.map((med, i) => (
              <button
                key={i}
                onClick={() => handleQuickAddMed(med, group.category)}
                className="px-2.5 py-1.5 text-[11px] rounded-lg border border-tertiary/15 bg-themewhite2 text-tertiary hover:bg-themeredred/5 hover:border-themeredred/20 transition-all"
              >
                {med.name} {med.dose} {med.route}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="border-t border-tertiary/10 pt-3 space-y-2">
        <p className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase">Custom</p>
        <input
          type="text"
          value={draftMed.name}
          onChange={(e) => setDraftMed(d => ({ ...d, name: e.target.value }))}
          placeholder="Medication name"
          className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={draftMed.dose}
            onChange={(e) => setDraftMed(d => ({ ...d, dose: e.target.value }))}
            placeholder="Dose"
            className="flex-1 text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
          />
          <select
            value={draftMed.route}
            onChange={(e) => setDraftMed(d => ({ ...d, route: e.target.value as MedRoute }))}
            className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary"
          >
            {MED_ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <select
          value={draftMed.category}
          onChange={(e) => setDraftMed(d => ({ ...d, category: e.target.value as MedCategory }))}
          className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary"
        >
          <option value="Analgesic">Analgesic</option>
          <option value="Antibiotic">Antibiotic</option>
          <option value="Other">Other</option>
        </select>
      </div>
    </div>
  )

  const medEditPopoverPreview = (
    <div className="p-4 space-y-2">
      <input
        type="text"
        value={draftMed.name}
        onChange={(e) => setDraftMed(d => ({ ...d, name: e.target.value }))}
        placeholder="Medication name"
        className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
        autoFocus
      />
      <div className="flex gap-2">
        <input
          type="text"
          value={draftMed.dose}
          onChange={(e) => setDraftMed(d => ({ ...d, dose: e.target.value }))}
          placeholder="Dose"
          className="flex-1 text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
        />
        <select
          value={draftMed.route}
          onChange={(e) => setDraftMed(d => ({ ...d, route: e.target.value as MedRoute }))}
          className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary"
        >
          {MED_ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <select
        value={draftMed.category}
        onChange={(e) => setDraftMed(d => ({ ...d, category: e.target.value as MedCategory }))}
        className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary"
      >
        <option value="Analgesic">Analgesic</option>
        <option value="Antibiotic">Antibiotic</option>
        <option value="Other">Other</option>
      </select>
      <input
        type="text"
        value={draftMed.time}
        onChange={(e) => setDraftMed(d => ({ ...d, time: e.target.value }))}
        placeholder="Time (HH:MM)"
        className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
      />
    </div>
  )

  const fluidAddPopoverPreview = (
    <div className="p-4 space-y-3">
      <p className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase">Common Fluids</p>
      <div className="flex flex-wrap gap-1.5">
        {COMMON_FLUIDS.map((f, i) => (
          <button
            key={i}
            onClick={() => handleQuickAddFluid(f.type, f.volume)}
            className="px-2.5 py-1.5 text-[11px] rounded-lg border border-tertiary/15 bg-themewhite2 text-tertiary hover:bg-themeredred/5 hover:border-themeredred/20 transition-all"
          >
            {f.type} {f.volume}
          </button>
        ))}
      </div>
      <div className="border-t border-tertiary/10 pt-3 space-y-2">
        <p className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase">Custom</p>
        <input
          type="text"
          value={draftFluid.type}
          onChange={(e) => setDraftFluid(d => ({ ...d, type: e.target.value }))}
          placeholder="Fluid type"
          className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
        />
        <input
          type="text"
          value={draftFluid.volume}
          onChange={(e) => setDraftFluid(d => ({ ...d, volume: e.target.value }))}
          placeholder="Volume"
          className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
        />
      </div>
    </div>
  )

  const fluidEditPopoverPreview = (
    <div className="p-4 space-y-2">
      <input
        type="text"
        value={draftFluid.type}
        onChange={(e) => setDraftFluid(d => ({ ...d, type: e.target.value }))}
        placeholder="Fluid type"
        className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
        autoFocus
      />
      <input
        type="text"
        value={draftFluid.volume}
        onChange={(e) => setDraftFluid(d => ({ ...d, volume: e.target.value }))}
        placeholder="Volume"
        className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
      />
      <select
        value={draftFluid.route}
        onChange={(e) => setDraftFluid(d => ({ ...d, route: e.target.value as MedRoute }))}
        className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary"
      >
        {MED_ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <input
        type="text"
        value={draftFluid.time}
        onChange={(e) => setDraftFluid(d => ({ ...d, time: e.target.value }))}
        placeholder="Time (HH:MM)"
        className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
      />
    </div>
  )

  const bloodAddPopoverPreview = (
    <div className="p-4 space-y-3">
      <p className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase">Common Blood Products</p>
      <div className="flex flex-wrap gap-1.5">
        {COMMON_BLOOD.map((b, i) => (
          <button
            key={i}
            onClick={() => handleQuickAddBlood(b.type, b.volume)}
            className="px-2.5 py-1.5 text-[11px] rounded-lg border border-tertiary/15 bg-themewhite2 text-tertiary hover:bg-themeredred/5 hover:border-themeredred/20 transition-all"
          >
            {b.type} {b.volume}
          </button>
        ))}
      </div>
    </div>
  )

  const bloodEditPopoverPreview = (
    <div className="p-4 space-y-2">
      <input
        type="text"
        value={draftBlood.type}
        onChange={(e) => setDraftBlood(d => ({ ...d, type: e.target.value }))}
        placeholder="Blood product type"
        className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
        autoFocus
      />
      <input
        type="text"
        value={draftBlood.volume}
        onChange={(e) => setDraftBlood(d => ({ ...d, volume: e.target.value }))}
        placeholder="Volume"
        className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
      />
      <select
        value={draftBlood.route}
        onChange={(e) => setDraftBlood(d => ({ ...d, route: e.target.value as MedRoute }))}
        className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary"
      >
        {MED_ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <input
        type="text"
        value={draftBlood.time}
        onChange={(e) => setDraftBlood(d => ({ ...d, time: e.target.value }))}
        placeholder="Time (HH:MM)"
        className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
      />
    </div>
  )

  // --- Resolve current popover ---
  let currentPreview: React.ReactNode = null
  let currentActions: { key: string; label: string; icon: typeof Check; onAction: () => void; variant?: 'default' | 'danger' }[] = []

  if (popoverType === 'iv') {
    currentPreview = ivPopoverPreview
    currentActions = isAdding
      ? [{ key: 'done', label: 'Done', icon: Check, onAction: handleDoneIV }]
      : [{ key: 'remove', label: 'Remove', icon: X, onAction: handleRemoveIV, variant: 'danger' }, { key: 'done', label: 'Done', icon: Check, onAction: handleDoneIV }]
  } else if (popoverType === 'med') {
    currentPreview = isAdding ? medAddPopoverPreview : medEditPopoverPreview
    currentActions = isAdding
      ? [{ key: 'done', label: 'Done', icon: Check, onAction: handleDoneMed }]
      : [{ key: 'remove', label: 'Remove', icon: X, onAction: handleRemoveMed, variant: 'danger' }, { key: 'done', label: 'Done', icon: Check, onAction: handleDoneMed }]
  } else if (popoverType === 'fluid') {
    currentPreview = isAdding ? fluidAddPopoverPreview : fluidEditPopoverPreview
    currentActions = isAdding
      ? [{ key: 'done', label: 'Done', icon: Check, onAction: handleDoneFluid }]
      : [{ key: 'remove', label: 'Remove', icon: X, onAction: handleRemoveFluid, variant: 'danger' }, { key: 'done', label: 'Done', icon: Check, onAction: handleDoneFluid }]
  } else if (popoverType === 'blood') {
    currentPreview = isAdding ? bloodAddPopoverPreview : bloodEditPopoverPreview
    currentActions = isAdding
      ? [{ key: 'done', label: 'Done', icon: Check, onAction: handleDoneBlood }]
      : [{ key: 'remove', label: 'Remove', icon: X, onAction: handleRemoveBlood, variant: 'danger' }, { key: 'done', label: 'Done', icon: Check, onAction: handleDoneBlood }]
  }

  // --- Check for content in each group ---
  const hasIV = ivAccess.length > 0
  const hasMeds = medications.length > 0
  const hasFluids = fluids.length > 0
  const hasBlood = bloodProducts.length > 0

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Medications & Fluids</h3>
        <p className="text-[11px] text-tertiary/70">DD 1380 — Meds, IV/IO, Fluids, Blood Products</p>
      </div>

      {/* IV/IO Access chips */}
      {hasIV && (
        <div className="space-y-1.5">
          <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">IV/IO Access</p>
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/8">
            {ivAccess.map((iv) => (
              <button
                key={iv.id}
                onClick={(e) => handleEditIV(iv, e)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-themeblue2/5 active:scale-95 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-themegreen shrink-0" />
                <span className="text-xs font-medium text-primary">{iv.type}</span>
                <span className="text-xs text-tertiary/70">{iv.gauge}</span>
                <span className="text-xs text-tertiary/70 truncate">{iv.site || 'No site'}</span>
                <ChevronRight size={14} className="text-tertiary/30 ml-auto shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Medications chips — grouped by category */}
      {hasMeds && (
        <div className="space-y-1.5">
          <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Medications</p>
          {(['Analgesic', 'Antibiotic', 'Other'] as MedCategory[]).map(cat => {
            const meds = groupedMeds[cat]
            if (!meds || meds.length === 0) return null
            return (
              <div key={cat} className="space-y-1">
                <p className="text-[9px] font-semibold text-themeredred/60 tracking-wider uppercase pl-1">{cat}</p>
                <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/8">
                  {meds.map((med) => (
                    <button
                      key={med.id}
                      onClick={(e) => handleEditMed(med, e)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-themeblue2/5 active:scale-95 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-themeblue2 shrink-0" />
                      <span className="text-xs font-medium text-primary truncate">{med.name}</span>
                      <span className="text-xs text-tertiary/70">{med.dose}</span>
                      <span className="text-xs text-tertiary/70">{med.route}</span>
                      <span className="text-[10px] text-tertiary/60">{med.time}</span>
                      <ChevronRight size={14} className="text-tertiary/30 ml-auto shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Fluids chips */}
      {hasFluids && (
        <div className="space-y-1.5">
          <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Fluids</p>
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/8">
            {fluids.map((f, i) => (
              <button
                key={i}
                onClick={(e) => handleEditFluid(f, i, e)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-themeblue2/5 active:scale-95 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                <span className="text-xs font-medium text-primary truncate">{f.type}</span>
                <span className="text-xs text-tertiary/70">{f.volume}</span>
                <span className="text-xs text-tertiary/70">{f.route}</span>
                <span className="text-[10px] text-tertiary/60">{f.time}</span>
                <ChevronRight size={14} className="text-tertiary/30 ml-auto shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Blood Products chips */}
      {hasBlood && (
        <div className="space-y-1.5">
          <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Blood Products</p>
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/8">
            {bloodProducts.map((b, i) => (
              <button
                key={i}
                onClick={(e) => handleEditBlood(b, i, e)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-themeblue2/5 active:scale-95 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-themeredred shrink-0" />
                <span className="text-xs font-medium text-primary truncate">{b.type}</span>
                <span className="text-xs text-tertiary/70">{b.volume}</span>
                <span className="text-xs text-tertiary/70">{b.route}</span>
                <span className="text-[10px] text-tertiary/60">{b.time}</span>
                <ChevronRight size={14} className="text-tertiary/30 ml-auto shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasIV && !hasMeds && !hasFluids && !hasBlood && (
        <div className="rounded-2xl border border-dashed border-tertiary/15 bg-themewhite2/50 py-6 flex flex-col items-center gap-1.5">
          <p className="text-[10px] text-tertiary/40">No items added yet</p>
        </div>
      )}

      {/* Add buttons */}
      <div className="flex flex-wrap gap-3">
        <button onClick={handleAddIV} className="flex items-center gap-1.5 text-[11px] text-tertiary/60 hover:text-primary transition-colors">
          <span className="w-6 h-6 rounded-full flex items-center justify-center bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40 shrink-0">
            <Plus size={11} />
          </span>
          IV/IO
        </button>
        <button onClick={handleAddMed} className="flex items-center gap-1.5 text-[11px] text-tertiary/60 hover:text-primary transition-colors">
          <span className="w-6 h-6 rounded-full flex items-center justify-center bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40 shrink-0">
            <Plus size={11} />
          </span>
          Medication
        </button>
        <button onClick={handleAddFluid} className="flex items-center gap-1.5 text-[11px] text-tertiary/60 hover:text-primary transition-colors">
          <span className="w-6 h-6 rounded-full flex items-center justify-center bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40 shrink-0">
            <Plus size={11} />
          </span>
          Fluid
        </button>
        <button onClick={handleAddBlood} className="flex items-center gap-1.5 text-[11px] text-tertiary/60 hover:text-primary transition-colors">
          <span className="w-6 h-6 rounded-full flex items-center justify-center bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40 shrink-0">
            <Plus size={11} />
          </span>
          Blood Product
        </button>
      </div>

      {/* Unified popover */}
      <ContextMenuPreview
        isVisible={popoverType !== null}
        onClose={closePopover}
        anchorRect={anchorRect}
        preview={currentPreview}
        actions={currentActions}
      />
    </div>
  )
})
