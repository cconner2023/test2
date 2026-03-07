import { memo } from 'react'
import { Plus, X } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import type { TC3Tourniquet, TC3Hemostatic, TourniquetType, TQCategory, DressingType, NeedleDecompSide } from '../../Types/TC3Types'
import { getRegionLabel } from '../../Utilities/bodyRegionMap'

const TOURNIQUET_TYPES: TourniquetType[] = ['CAT', 'SOFT-T', 'other']
const TQ_CATEGORIES: TQCategory[] = ['Extremity', 'Junctional', 'Truncal']
const DRESSING_TYPES: DressingType[] = ['Hemostatic', 'Pressure', 'Other']
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

// ── C: Hemorrhage Control ─────────────────────
const HemorrhagePanel = memo(function HemorrhagePanel() {
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
      tqCategory: 'Extremity',
    }
    addTourniquet(tq)
  }

  const handleAddDressing = () => {
    const h: TC3Hemostatic = {
      id: crypto.randomUUID(),
      applied: true,
      type: 'Combat Gauze',
      location: '',
      dressingType: 'Hemostatic',
    }
    addHemostatic(h)
  }

  return (
    <div className="space-y-4">
      {/* TQ Section */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">C: TQ (Tourniquets)</p>
        {tourniquets.map((tq) => (
          <div key={tq.id} className="space-y-2 px-3 py-2 rounded-lg border border-tertiary/15 bg-themewhite2">
            <div className="flex items-center gap-2">
              {/* Category */}
              <div className="flex gap-1">
                {TQ_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => useTC3Store.getState().updateTourniquet(tq.id, { tqCategory: cat })}
                    className={`px-2 py-1 rounded text-[10px] font-medium border transition-all
                      ${tq.tqCategory === cat
                        ? 'border-themeredred/25 bg-themeredred/10 text-primary'
                        : 'border-tertiary/15 text-tertiary/60'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <InjuryBadge injuryId={tq.injuryId} />
              <button onClick={() => removeTourniquet(tq.id)} className="ml-auto p-1 hover:bg-themeredred/10 rounded transition-colors">
                <X size={14} className="text-themeredred/60" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={tq.type}
                onChange={(e) => useTC3Store.getState().updateTourniquet(tq.id, { type: e.target.value as TourniquetType })}
                className="text-xs bg-transparent border border-tertiary/20 rounded px-1.5 py-1 outline-none text-tertiary"
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
            </div>
          </div>
        ))}
        <button
          onClick={handleAddTourniquet}
          className="flex items-center gap-1.5 text-[11px] text-themeredred hover:text-themeredred/80 transition-colors px-1 py-1"
        >
          <Plus size={14} /> <span>Add Tourniquet</span>
        </button>
      </div>

      {/* Dressing Section */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Dressing</p>
        {hemostatics.map((h) => (
          <div key={h.id} className="space-y-2 px-3 py-2 rounded-lg border border-tertiary/15 bg-themewhite2">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {DRESSING_TYPES.map(dt => (
                  <button
                    key={dt}
                    onClick={() => useTC3Store.getState().updateHemostatic(h.id, { dressingType: dt })}
                    className={`px-2 py-1 rounded text-[10px] font-medium border transition-all
                      ${h.dressingType === dt
                        ? 'border-themeredred/25 bg-themeredred/10 text-primary'
                        : 'border-tertiary/15 text-tertiary/60'
                      }`}
                  >
                    {dt}
                  </button>
                ))}
              </div>
              <InjuryBadge injuryId={h.injuryId} />
              <button onClick={() => removeHemostatic(h.id)} className="ml-auto p-1 hover:bg-themeredred/10 rounded transition-colors">
                <X size={14} className="text-themeredred/60" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={h.type}
                onChange={(e) => useTC3Store.getState().updateHemostatic(h.id, { type: e.target.value })}
                placeholder="Type (Combat Gauze, etc.)"
                className="flex-1 text-xs px-2 py-1 rounded border border-tertiary/20 bg-themewhite outline-none text-tertiary"
              />
              <input
                type="text"
                value={h.location}
                onChange={(e) => useTC3Store.getState().updateHemostatic(h.id, { location: e.target.value })}
                placeholder="Location"
                className="flex-1 text-xs px-2 py-1 rounded border border-tertiary/20 bg-themewhite outline-none text-tertiary"
              />
            </div>
          </div>
        ))}
        <button
          onClick={handleAddDressing}
          className="flex items-center gap-1.5 text-[11px] text-themeredred hover:text-themeredred/80 transition-colors px-1 py-1"
        >
          <Plus size={14} /> <span>Add Dressing</span>
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
    <div className="space-y-3">
      <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">A: Airway</p>
      <div className="space-y-2">
        <CheckField label="Intact / No intervention" checked={airway.intact} onChange={(v) => updateAirway({ intact: v })} />
        <CheckField label="NPA (Nasopharyngeal Airway)" checked={airway.npa} onChange={(v) => updateAirway({ npa: v })} />
        <CheckField label="CRIC (Cricothyrotomy)" checked={airway.cric} onChange={(v) => updateAirway({ cric: v })} />
        <CheckField label="ET-Tube (Endotracheal)" checked={airway.ett} onChange={(v) => updateAirway({ ett: v })} />
        <CheckField label="SGA (Supraglottic Airway)" checked={airway.supraglottic} onChange={(v) => updateAirway({ supraglottic: v })} />
      </div>
      {/* Airway Type field */}
      <div className="space-y-1">
        <label className="text-[10px] text-tertiary/50">Type</label>
        <input
          type="text"
          value={airway.airwayType}
          onChange={(e) => updateAirway({ airwayType: e.target.value })}
          placeholder="Airway type / size..."
          className="w-full text-xs px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
        />
      </div>
    </div>
  )
})

// ── B: Breathing / Respiration ────────────────
const BreathingPanel = memo(function BreathingPanel() {
  const respiration = useTC3Store((s) => s.card.march.respiration)
  const updateNeedleDecomp = useTC3Store((s) => s.updateNeedleDecomp)
  const updateChestSeal = useTC3Store((s) => s.updateChestSeal)
  const updateChestTube = useTC3Store((s) => s.updateChestTube)
  const updateRespirationO2 = useTC3Store((s) => s.updateRespirationO2)

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">B: Breathing</p>
      <div className="space-y-2">
        {/* O2 */}
        <CheckField
          label="O2 (Supplemental Oxygen)"
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

        {/* Needle-D */}
        <CheckField
          label="Needle-D (Needle Decompression)"
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

        {/* Chest-Tube */}
        <CheckField
          label="Chest-Tube"
          checked={respiration.chestTube}
          onChange={(v) => updateChestTube(v)}
        />

        {/* Chest-Seal */}
        <CheckField
          label="Chest-Seal"
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
    </div>
  )
})

// ── Main Treatments Form (replaces MARCH tabs) ──
export const MARCHForm = memo(function MARCHForm() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Treatments</h3>
        <p className="text-[11px] text-tertiary/70">DD 1380 — Tactical treatment (C / A / B)</p>
      </div>

      {/* C: Hemorrhage Control */}
      <HemorrhagePanel />

      {/* A: Airway */}
      <AirwayPanel />

      {/* B: Breathing */}
      <BreathingPanel />
    </div>
  )
})
