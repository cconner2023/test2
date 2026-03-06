import { memo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import type { TC3Tourniquet, TC3Hemostatic, TC3IVAccess, TourniquetType, IVType, NeedleDecompSide } from '../../Types/TC3Types'
import { getRegionLabel } from '../../Utilities/bodyRegionMap'

type MARCHTab = 'M' | 'A' | 'R' | 'C' | 'H'

const TAB_LABELS: { key: MARCHTab; label: string; full: string }[] = [
  { key: 'M', label: 'M', full: 'Massive Hemorrhage' },
  { key: 'A', label: 'A', full: 'Airway' },
  { key: 'R', label: 'R', full: 'Respiration' },
  { key: 'C', label: 'C', full: 'Circulation' },
  { key: 'H', label: 'H', full: 'Hypothermia' },
]

const TOURNIQUET_TYPES: TourniquetType[] = ['CAT', 'SOFT-T', 'other']
const IV_TYPES: IVType[] = ['IV', 'IO']
const SIDE_OPTIONS: NeedleDecompSide[] = ['none', 'left', 'right', 'bilateral']

const CheckField = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all text-left w-full
      ${checked ? 'border-themeredred/25 bg-themeredred/10' : 'border-tertiary/15 bg-themewhite2'}`}
  >
    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
      ${checked ? 'border-themeredred bg-themeredred' : 'border-tertiary/30'}`}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
    <span className={`text-xs font-medium ${checked ? 'text-primary' : 'text-tertiary'}`}>{label}</span>
  </button>
)

// ── Linked-injury badge ───────────────────────
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

// ── M: Massive Hemorrhage ─────────────────────
const MassiveHemorrhagePanel = memo(function MassiveHemorrhagePanel() {
  const tourniquets = useTC3Store((s) => s.card.march.massiveHemorrhage.tourniquets)
  const hemostatics = useTC3Store((s) => s.card.march.massiveHemorrhage.hemostatics)
  const addTourniquet = useTC3Store((s) => s.addTourniquet)
  const removeTourniquet = useTC3Store((s) => s.removeTourniquet)
  const addHemostatic = useTC3Store((s) => s.addHemostatic)
  const removeHemostatic = useTC3Store((s) => s.removeHemostatic)

  const handleAddTourniquet = () => {
    const tq: TC3Tourniquet = {
      id: crypto.randomUUID(),
      location: '',
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      type: 'CAT',
    }
    addTourniquet(tq)
  }

  return (
    <div className="space-y-4">
      {/* Tourniquets */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Tourniquets</p>
        {tourniquets.map((tq) => (
          <div key={tq.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-tertiary/15 bg-themewhite2">
            <select
              value={tq.type}
              onChange={(e) => useTC3Store.getState().updateTourniquet(tq.id, { type: e.target.value as TourniquetType })}
              className="text-xs bg-transparent border-none outline-none text-tertiary"
            >
              {TOURNIQUET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              type="text"
              value={tq.location}
              onChange={(e) => useTC3Store.getState().updateTourniquet(tq.id, { location: e.target.value })}
              placeholder="Location"
              className="flex-1 text-xs px-2 py-1 rounded border border-tertiary/20 bg-themewhite outline-none text-tertiary"
            />
            <input
              type="text"
              value={tq.time}
              onChange={(e) => useTC3Store.getState().updateTourniquet(tq.id, { time: e.target.value })}
              placeholder="Time"
              className="w-16 text-xs px-2 py-1 rounded border border-tertiary/20 bg-themewhite outline-none text-tertiary"
            />
            <InjuryBadge injuryId={tq.injuryId} />
            <button onClick={() => removeTourniquet(tq.id)} className="p-1 hover:bg-themeredred/10 rounded transition-colors">
              <X size={14} className="text-themeredred/60" />
            </button>
          </div>
        ))}
        <button
          onClick={handleAddTourniquet}
          className="flex items-center gap-1.5 text-[11px] text-themeredred hover:text-themeredred/80 transition-colors px-1 py-1"
        >
          <Plus size={14} /> <span>Add Tourniquet</span>
        </button>
      </div>

      {/* Hemostatics */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Hemostatic Agents</p>
        {hemostatics.map((h) => (
          <div key={h.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-tertiary/15 bg-themewhite2">
            <span className="text-xs text-tertiary">{h.type || 'Hemostatic'} — {h.location || 'N/A'}</span>
            <InjuryBadge injuryId={h.injuryId} />
            <button onClick={() => removeHemostatic(h.id)} className="ml-auto p-1 hover:bg-themeredred/10 rounded transition-colors">
              <X size={14} className="text-themeredred/60" />
            </button>
          </div>
        ))}
        <button
          onClick={() => addHemostatic({ id: crypto.randomUUID(), applied: true, type: 'Combat Gauze', location: '' })}
          className="flex items-center gap-1.5 text-[11px] text-themeredred hover:text-themeredred/80 transition-colors px-1 py-1"
        >
          <Plus size={14} /> <span>Add Hemostatic</span>
        </button>
      </div>
    </div>
  )
})

// ── A: Airway ─────────────────────────────────
const AirwayPanel = memo(function AirwayPanel() {
  const airway = useTC3Store((s) => s.card.march.airway)
  const updateAirway = useTC3Store((s) => s.updateAirway)

  return (
    <div className="space-y-2">
      <CheckField label="Intact / No intervention" checked={airway.intact} onChange={(v) => updateAirway({ intact: v })} />
      <CheckField label="NPA (Nasopharyngeal Airway)" checked={airway.npa} onChange={(v) => updateAirway({ npa: v })} />
      <CheckField label="Cricothyrotomy (Cric)" checked={airway.cric} onChange={(v) => updateAirway({ cric: v })} />
      <CheckField label="ETT (Endotracheal Tube)" checked={airway.ett} onChange={(v) => updateAirway({ ett: v })} />
      <CheckField label="Supraglottic Airway" checked={airway.supraglottic} onChange={(v) => updateAirway({ supraglottic: v })} />
      <CheckField label="Chin Lift / Jaw Thrust" checked={airway.chinLift} onChange={(v) => updateAirway({ chinLift: v })} />
    </div>
  )
})

// ── R: Respiration ────────────────────────────
const RespirationPanel = memo(function RespirationPanel() {
  const respiration = useTC3Store((s) => s.card.march.respiration)
  const updateNeedleDecomp = useTC3Store((s) => s.updateNeedleDecomp)
  const updateChestSeal = useTC3Store((s) => s.updateChestSeal)
  const updateRespirationO2 = useTC3Store((s) => s.updateRespirationO2)

  return (
    <div className="space-y-4">
      {/* Needle Decompression */}
      <div className="space-y-2">
        <CheckField
          label="Needle Decompression"
          checked={respiration.needleDecomp.performed}
          onChange={(v) => updateNeedleDecomp({ performed: v })}
        />
        {respiration.needleDecomp.performed && (
          <div className="pl-6 flex gap-2">
            {SIDE_OPTIONS.filter(s => s !== 'none').map((side) => (
              <button
                key={side}
                onClick={() => updateNeedleDecomp({ side })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                  ${respiration.needleDecomp.side === side
                    ? 'border-themeredred/25 bg-themeredred/10 text-primary'
                    : 'border-tertiary/15 text-tertiary hover:bg-tertiary/5'
                  }`}
              >
                {side.charAt(0).toUpperCase() + side.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chest Seal */}
      <div className="space-y-2">
        <CheckField
          label="Chest Seal"
          checked={respiration.chestSeal.applied}
          onChange={(v) => updateChestSeal({ applied: v })}
        />
        {respiration.chestSeal.applied && (
          <div className="pl-6 flex gap-2">
            {SIDE_OPTIONS.filter(s => s !== 'none').map((side) => (
              <button
                key={side}
                onClick={() => updateChestSeal({ side })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                  ${respiration.chestSeal.side === side
                    ? 'border-themeredred/25 bg-themeredred/10 text-primary'
                    : 'border-tertiary/15 text-tertiary hover:bg-tertiary/5'
                  }`}
              >
                {side.charAt(0).toUpperCase() + side.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* O2 */}
      <div className="space-y-2">
        <CheckField
          label="Supplemental O2"
          checked={respiration.o2}
          onChange={(v) => updateRespirationO2(v)}
        />
        {respiration.o2 && (
          <div className="pl-6">
            <input
              type="text"
              value={respiration.o2Method}
              onChange={(e) => updateRespirationO2(true, e.target.value)}
              placeholder="Method (NRB, NC, BVM...)"
              className="w-full text-xs px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
            />
          </div>
        )}
      </div>
    </div>
  )
})

// ── C: Circulation ────────────────────────────
const CirculationPanel = memo(function CirculationPanel() {
  const circulation = useTC3Store((s) => s.card.march.circulation)
  const addIVAccess = useTC3Store((s) => s.addIVAccess)
  const removeIVAccess = useTC3Store((s) => s.removeIVAccess)

  const handleAddIV = () => {
    const iv: TC3IVAccess = { id: crypto.randomUUID(), type: 'IV', site: '', gauge: '18g' }
    addIVAccess(iv)
  }

  return (
    <div className="space-y-4">
      {/* IV/IO Access */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">IV/IO Access</p>
        {circulation.ivAccess.map((iv) => (
          <div key={iv.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-tertiary/15 bg-themewhite2">
            <select
              value={iv.type}
              onChange={(e) => useTC3Store.getState().removeIVAccess(iv.id) || addIVAccess({ ...iv, type: e.target.value as IVType })}
              className="text-xs bg-transparent border-none outline-none text-tertiary"
            >
              {IV_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              type="text"
              value={iv.site}
              onChange={() => {}}
              placeholder="Site"
              className="flex-1 text-xs px-2 py-1 rounded border border-tertiary/20 bg-themewhite outline-none text-tertiary"
            />
            <span className="text-xs text-tertiary/60">{iv.gauge}</span>
            <button onClick={() => removeIVAccess(iv.id)} className="p-1 hover:bg-themeredred/10 rounded transition-colors">
              <X size={14} className="text-themeredred/60" />
            </button>
          </div>
        ))}
        <button onClick={handleAddIV} className="flex items-center gap-1.5 text-[11px] text-themeredred hover:text-themeredred/80 transition-colors px-1 py-1">
          <Plus size={14} /> <span>Add IV/IO</span>
        </button>
      </div>
    </div>
  )
})

// ── H: Hypothermia ────────────────────────────
const HypothermiaPanel = memo(function HypothermiaPanel() {
  const hypothermia = useTC3Store((s) => s.card.march.hypothermia)
  const updateHypothermia = useTC3Store((s) => s.updateHypothermia)

  return (
    <div className="space-y-3">
      <CheckField
        label="Hypothermia Prevention Measures"
        checked={hypothermia.prevention}
        onChange={(v) => updateHypothermia({ prevention: v })}
      />
      {hypothermia.prevention && (
        <div className="pl-6">
          <input
            type="text"
            value={hypothermia.method}
            onChange={(e) => updateHypothermia({ method: e.target.value })}
            placeholder="Method (Blanket, HPMK, Ready-Heat...)"
            className="w-full text-xs px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
          />
        </div>
      )}
    </div>
  )
})

// ── Main MARCH Form ───────────────────────────
export const MARCHForm = memo(function MARCHForm() {
  const [activeTab, setActiveTab] = useState<MARCHTab>('M')

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">MARCH Protocol</h3>
        <p className="text-[11px] text-tertiary/70">DD 1380 Section 4 — Tactical treatment</p>
      </div>

      {/* MARCH tabs */}
      <div className="flex gap-1 bg-tertiary/5 rounded-xl p-1">
        {TAB_LABELS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all
              ${activeTab === tab.key
                ? 'bg-themeredred text-white shadow-sm'
                : 'text-tertiary hover:bg-tertiary/10'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab subtitle */}
      <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">
        {TAB_LABELS.find(t => t.key === activeTab)?.full}
      </p>

      {/* Tab content */}
      {activeTab === 'M' && <MassiveHemorrhagePanel />}
      {activeTab === 'A' && <AirwayPanel />}
      {activeTab === 'R' && <RespirationPanel />}
      {activeTab === 'C' && <CirculationPanel />}
      {activeTab === 'H' && <HypothermiaPanel />}
    </div>
  )
})
