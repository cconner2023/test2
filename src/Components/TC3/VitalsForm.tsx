import { memo } from 'react'
import { Plus, X } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import type { TC3VitalSet, AVPU } from '../../Types/TC3Types'

const AVPU_OPTIONS: AVPU[] = ['A', 'V', 'P', 'U']
const AVPU_LABELS: Record<AVPU, string> = {
  A: 'Alert',
  V: 'Voice',
  P: 'Pain',
  U: 'Unresponsive',
}

export const VitalsForm = memo(function VitalsForm() {
  const vitals = useTC3Store((s) => s.card.vitals)
  const addVitalSet = useTC3Store((s) => s.addVitalSet)
  const updateVitalSet = useTC3Store((s) => s.updateVitalSet)
  const removeVitalSet = useTC3Store((s) => s.removeVitalSet)

  // Mental status (top-level card fields)
  const avpu = useTC3Store((s) => s.card.avpu)
  const gcs = useTC3Store((s) => s.card.gcs)
  const setAVPU = useTC3Store((s) => s.setAVPU)
  const setGCS = useTC3Store((s) => s.setGCS)

  const handleAddVitals = () => {
    const newSet: TC3VitalSet = {
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      pulse: '',
      bp: '',
      rr: '',
      spo2: '',
      avpu: 'A',
      painScale: '',
    }
    addVitalSet(newSet)
  }

  const handleFieldChange = (id: string, field: keyof TC3VitalSet, value: string) => {
    updateVitalSet(id, { [field]: value })
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Signs & Symptoms</h3>
        <p className="text-[11px] text-tertiary/70">DD 1380 Section 6 & 7 — Vitals, mental status, and assessment</p>
      </div>

      {/* Mental Status — AVPU */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Mental Status (AVPU)</p>
        <div className="flex gap-2">
          {AVPU_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setAVPU(avpu === opt ? '' : opt)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all border
                ${avpu === opt
                  ? 'bg-themeredred text-white border-themeredred'
                  : 'border-tertiary/15 text-tertiary hover:bg-tertiary/5'
                }`}
            >
              <div>{opt}</div>
              <div className="text-[9px] font-normal mt-0.5 opacity-80">{AVPU_LABELS[opt]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* GCS */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">
          Glasgow Coma Scale (GCS){gcs ? ` — Total: ${gcs.eye + gcs.verbal + gcs.motor}` : ''}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-tertiary/60">Eye (1-4)</label>
            <input
              type="number"
              min={1} max={4}
              value={gcs?.eye ?? ''}
              onChange={(e) => {
                const v = parseInt(e.target.value) || 0
                setGCS({ eye: v, verbal: gcs?.verbal ?? 0, motor: gcs?.motor ?? 0 })
              }}
              className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary text-center"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-tertiary/60">Verbal (1-5)</label>
            <input
              type="number"
              min={1} max={5}
              value={gcs?.verbal ?? ''}
              onChange={(e) => {
                const v = parseInt(e.target.value) || 0
                setGCS({ eye: gcs?.eye ?? 0, verbal: v, motor: gcs?.motor ?? 0 })
              }}
              className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary text-center"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-tertiary/60">Motor (1-6)</label>
            <input
              type="number"
              min={1} max={6}
              value={gcs?.motor ?? ''}
              onChange={(e) => {
                const v = parseInt(e.target.value) || 0
                setGCS({ eye: gcs?.eye ?? 0, verbal: gcs?.verbal ?? 0, motor: v })
              }}
              className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary text-center"
            />
          </div>
        </div>
      </div>

      {/* Vital Signs Table */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Vital Sign Sets</p>
        {vitals.map((vs, idx) => (
          <div key={vs.id} className="rounded-lg border border-tertiary/15 bg-themewhite2 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-tertiary/5">
              <span className="text-[10px] font-semibold text-tertiary/50">Set #{idx + 1}</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={vs.time}
                  onChange={(e) => handleFieldChange(vs.id, 'time', e.target.value)}
                  className="w-16 text-[10px] px-1.5 py-0.5 rounded border border-tertiary/20 bg-themewhite outline-none text-tertiary text-center"
                />
                <button onClick={() => removeVitalSet(vs.id)} className="p-0.5 hover:bg-themeredred/10 rounded transition-colors">
                  <X size={12} className="text-themeredred/60" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 px-3 py-2">
              <div className="space-y-0.5">
                <label className="text-[9px] text-tertiary/50">Pulse</label>
                <input type="text" value={vs.pulse} onChange={(e) => handleFieldChange(vs.id, 'pulse', e.target.value)}
                  placeholder="HR" className="w-full text-xs px-2 py-1 rounded border border-tertiary/20 bg-themewhite outline-none text-tertiary" />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] text-tertiary/50">BP</label>
                <input type="text" value={vs.bp} onChange={(e) => handleFieldChange(vs.id, 'bp', e.target.value)}
                  placeholder="120/80" className="w-full text-xs px-2 py-1 rounded border border-tertiary/20 bg-themewhite outline-none text-tertiary" />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] text-tertiary/50">RR</label>
                <input type="text" value={vs.rr} onChange={(e) => handleFieldChange(vs.id, 'rr', e.target.value)}
                  placeholder="RR" className="w-full text-xs px-2 py-1 rounded border border-tertiary/20 bg-themewhite outline-none text-tertiary" />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] text-tertiary/50">SpO2</label>
                <input type="text" value={vs.spo2} onChange={(e) => handleFieldChange(vs.id, 'spo2', e.target.value)}
                  placeholder="%" className="w-full text-xs px-2 py-1 rounded border border-tertiary/20 bg-themewhite outline-none text-tertiary" />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] text-tertiary/50">AVPU</label>
                <select value={vs.avpu} onChange={(e) => handleFieldChange(vs.id, 'avpu', e.target.value)}
                  className="w-full text-xs px-2 py-1 rounded border border-tertiary/20 bg-themewhite outline-none text-tertiary">
                  {AVPU_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] text-tertiary/50">Pain</label>
                <input type="text" value={vs.painScale} onChange={(e) => handleFieldChange(vs.id, 'painScale', e.target.value)}
                  placeholder="0-10" className="w-full text-xs px-2 py-1 rounded border border-tertiary/20 bg-themewhite outline-none text-tertiary" />
              </div>
            </div>
          </div>
        ))}
        <button
          onClick={handleAddVitals}
          className="flex items-center gap-1.5 text-[11px] text-themeredred hover:text-themeredred/80 transition-colors px-1 py-1"
        >
          <Plus size={14} /> <span>Add Vital Signs Set</span>
        </button>
      </div>
    </div>
  )
})
