import { memo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import type { TC3Medication, MedRoute, MedCategory } from '../../Types/TC3Types'

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

export const MedicationsForm = memo(function MedicationsForm() {
  const medications = useTC3Store((s) => s.card.medications)
  const addMedication = useTC3Store((s) => s.addMedication)
  const removeMedication = useTC3Store((s) => s.removeMedication)

  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customDose, setCustomDose] = useState('')
  const [customRoute, setCustomRoute] = useState<MedRoute>('IV')
  const [customCategory, setCustomCategory] = useState<MedCategory>('Other')

  const handleQuickAdd = (med: { name: string; dose: string; route: MedRoute }, category: MedCategory) => {
    const newMed: TC3Medication = {
      id: crypto.randomUUID(),
      name: med.name,
      dose: med.dose,
      route: med.route,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      category,
    }
    addMedication(newMed)
  }

  const handleAddCustom = () => {
    if (!customName.trim()) return
    const newMed: TC3Medication = {
      id: crypto.randomUUID(),
      name: customName.trim(),
      dose: customDose.trim(),
      route: customRoute,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      category: customCategory,
    }
    addMedication(newMed)
    setCustomName('')
    setCustomDose('')
    setCustomRoute('IV')
    setCustomCategory('Other')
    setShowCustom(false)
  }

  // Group administered meds by category for display
  const groupedMeds = medications.reduce<Record<MedCategory, TC3Medication[]>>((acc, med) => {
    const cat = med.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(med)
    return acc
  }, { Analgesic: [], Antibiotic: [], Other: [] })

  const hasAnyMeds = medications.length > 0

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Medications Administered</h3>
        <p className="text-[11px] text-tertiary/70">DD 1380 — Name / Dose / Route / Time</p>
      </div>

      {/* Administered medications grouped by category */}
      {hasAnyMeds && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Given</p>
          {(['Analgesic', 'Antibiotic', 'Other'] as MedCategory[]).map(cat => {
            const meds = groupedMeds[cat]
            if (!meds || meds.length === 0) return null
            return (
              <div key={cat} className="space-y-1.5">
                <p className="text-[9px] font-semibold text-themeredred/60 tracking-wider uppercase">{cat}</p>
                {meds.map((med) => (
                  <div key={med.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-tertiary/15 bg-themewhite2">
                    <div className="flex-1 min-w-0 grid grid-cols-4 gap-1 items-center">
                      <span className="text-xs font-medium text-primary truncate">{med.name}</span>
                      <span className="text-xs text-tertiary/70">{med.dose}</span>
                      <span className="text-xs text-tertiary/70">{med.route}</span>
                      <span className="text-[10px] text-tertiary/60">{med.time}</span>
                    </div>
                    <button onClick={() => removeMedication(med.id)} className="p-1 hover:bg-themeredred/10 rounded transition-colors shrink-0">
                      <X size={14} className="text-themeredred/60" />
                    </button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Quick-add by category */}
      {CATEGORIZED_MEDS.map((group) => (
        <div key={group.category} className="space-y-2">
          <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Quick Add — {group.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.meds.map((med, i) => (
              <button
                key={i}
                onClick={() => handleQuickAdd(med, group.category)}
                className="px-2.5 py-1.5 text-[11px] rounded-lg border border-tertiary/15 bg-themewhite2 text-tertiary hover:bg-themeredred/5 hover:border-themeredred/20 transition-all"
              >
                {med.name} {med.dose} {med.route}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Custom medication */}
      {showCustom ? (
        <div className="space-y-2 px-3 py-3 rounded-lg border border-themeredred/20 bg-themeredred/5">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Medication name"
            className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
            autoFocus
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={customDose}
              onChange={(e) => setCustomDose(e.target.value)}
              placeholder="Dose"
              className="flex-1 text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
            />
            <select
              value={customRoute}
              onChange={(e) => setCustomRoute(e.target.value as MedRoute)}
              className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary"
            >
              {MED_ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value as MedCategory)}
              className="text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none text-tertiary"
            >
              <option value="Analgesic">Analgesic</option>
              <option value="Antibiotic">Antibiotic</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCustom(false)} className="text-[11px] px-3 py-1 rounded-md text-tertiary hover:bg-tertiary/10 transition-colors">
              Cancel
            </button>
            <button onClick={handleAddCustom} className="text-[11px] px-3 py-1 rounded-md bg-themeredred text-white hover:bg-themeredred/90 transition-colors">
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCustom(true)}
          className="flex items-center gap-1.5 text-[11px] text-themeredred hover:text-themeredred/80 transition-colors px-1 py-1"
        >
          <Plus size={14} /> <span>Custom Medication</span>
        </button>
      )}
    </div>
  )
})
