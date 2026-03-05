import { memo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import type { TC3Medication, MedRoute } from '../../Types/TC3Types'

const MED_ROUTES: MedRoute[] = ['IV', 'IM', 'IO', 'PO', 'IN', 'PR', 'topical']

const COMMON_MEDS = [
  { name: 'Ketamine', dose: '50mg', route: 'IV' as MedRoute },
  { name: 'Ketamine', dose: '300mg', route: 'IM' as MedRoute },
  { name: 'Fentanyl', dose: '50mcg', route: 'IV' as MedRoute },
  { name: 'Morphine', dose: '5mg', route: 'IV' as MedRoute },
  { name: 'TXA', dose: '1g', route: 'IV' as MedRoute },
  { name: 'Ertapenem', dose: '1g', route: 'IV' as MedRoute },
  { name: 'Moxifloxacin', dose: '400mg', route: 'PO' as MedRoute },
  { name: 'Ondansetron', dose: '4mg', route: 'IV' as MedRoute },
  { name: 'Acetaminophen', dose: '500mg', route: 'PO' as MedRoute },
  { name: 'Meloxicam', dose: '15mg', route: 'PO' as MedRoute },
]

export const MedicationsForm = memo(function MedicationsForm() {
  const medications = useTC3Store((s) => s.card.medications)
  const addMedication = useTC3Store((s) => s.addMedication)
  const removeMedication = useTC3Store((s) => s.removeMedication)

  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customDose, setCustomDose] = useState('')
  const [customRoute, setCustomRoute] = useState<MedRoute>('IV')

  const handleQuickAdd = (med: typeof COMMON_MEDS[0]) => {
    const newMed: TC3Medication = {
      id: crypto.randomUUID(),
      name: med.name,
      dose: med.dose,
      route: med.route,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
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
    }
    addMedication(newMed)
    setCustomName('')
    setCustomDose('')
    setCustomRoute('IV')
    setShowCustom(false)
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Medications Administered</h3>
        <p className="text-[11px] text-tertiary/70">DD 1380 Section 5 — Record all medications given</p>
      </div>

      {/* Administered medications list */}
      {medications.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Given</p>
          {medications.map((med) => (
            <div key={med.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-tertiary/15 bg-themewhite2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-primary">{med.name} {med.dose}</p>
                <p className="text-[10px] text-tertiary/60">{med.route} @ {med.time}</p>
              </div>
              <button onClick={() => removeMedication(med.id)} className="p-1 hover:bg-themeredred/10 rounded transition-colors shrink-0">
                <X size={14} className="text-themeredred/60" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quick-add common meds */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Quick Add</p>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_MEDS.map((med, i) => (
            <button
              key={i}
              onClick={() => handleQuickAdd(med)}
              className="px-2.5 py-1.5 text-[11px] rounded-lg border border-tertiary/15 bg-themewhite2 text-tertiary hover:bg-themeredred/5 hover:border-themeredred/20 transition-all"
            >
              {med.name} {med.dose} {med.route}
            </button>
          ))}
        </div>
      </div>

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
