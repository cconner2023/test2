import { memo, useState } from 'react'
import { Plus, X, Check, ChevronRight } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { PreviewOverlay } from '../PreviewOverlay'
import type { TC3VitalSet, AVPU } from '../../Types/TC3Types'

const AVPU_OPTIONS: AVPU[] = ['A', 'V', 'P', 'U']
const AVPU_LABELS: Record<AVPU, string> = {
  A: 'Alert',
  V: 'Voice',
  P: 'Pain',
  U: 'Unresponsive',
}

/* ── AVPU ↔ GCS bidirectional mapping ── */

const AVPU_GCS_DEFAULTS: Record<AVPU, { eye: number; verbal: number; motor: number }> = {
  A: { eye: 4, verbal: 5, motor: 6 }, // 15
  V: { eye: 3, verbal: 4, motor: 6 }, // 13
  P: { eye: 2, verbal: 2, motor: 4 }, //  8
  U: { eye: 1, verbal: 1, motor: 1 }, //  3
}

function gcsToAVPU(total: number): AVPU {
  if (total >= 15) return 'A'
  if (total >= 13) return 'V'
  if (total >= 9) return 'P'
  return 'U'
}

/* ── Popover preview — AVPU + GCS (linked) + vital fields ── */
function VitalSetPreviewContent({ id }: { id: string }) {
  const vs = useTC3Store((s) => s.card.vitals.find((v) => v.id === id))
  const updateVitalSet = useTC3Store((s) => s.updateVitalSet)
  const avpu = useTC3Store((s) => s.card.avpu)
  const gcs = useTC3Store((s) => s.card.gcs)
  const setAVPU = useTC3Store((s) => s.setAVPU)
  const setGCS = useTC3Store((s) => s.setGCS)

  if (!vs) return null

  const handleChange = (field: keyof TC3VitalSet, value: string) => {
    updateVitalSet(id, { [field]: value })
  }

  // AVPU → auto-fill GCS defaults
  const handleAVPU = (opt: AVPU) => {
    if (avpu === opt) {
      setAVPU('')
      return
    }
    setAVPU(opt)
    setGCS(AVPU_GCS_DEFAULTS[opt])
  }

  // GCS change → auto-update AVPU from total
  const handleGCS = (field: 'eye' | 'verbal' | 'motor', raw: string) => {
    const v = parseInt(raw) || 0
    const next = {
      eye: field === 'eye' ? v : gcs?.eye ?? 0,
      verbal: field === 'verbal' ? v : gcs?.verbal ?? 0,
      motor: field === 'motor' ? v : gcs?.motor ?? 0,
    }
    setGCS(next)
    const total = next.eye + next.verbal + next.motor
    if (total > 0) setAVPU(gcsToAVPU(total))
  }

  const gcsTotal = gcs ? gcs.eye + gcs.verbal + gcs.motor : null

  const inputClass =
    'w-full text-xs px-2 py-1 rounded border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary'

  return (
    <div className="p-2.5 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
      {/* AVPU */}
      <div className="mb-2.5">
        <label className="text-[9px] text-tertiary/50 block mb-1">AVPU</label>
        <div className="flex gap-1">
          {AVPU_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleAVPU(opt)}
              className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all border
                ${avpu === opt
                  ? 'bg-themeredred text-white border-themeredred'
                  : 'border-tertiary/15 text-tertiary hover:bg-tertiary/5'
                }`}
            >
              <div>{opt}</div>
              <div className="text-[8px] font-normal opacity-70">{AVPU_LABELS[opt]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* GCS — linked to AVPU */}
      <div className="mb-2.5">
        <label className="text-[9px] text-tertiary/50 block mb-1">
          GCS{gcsTotal ? ` — ${gcsTotal}` : ''}
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          <div>
            <label className="text-[8px] text-tertiary/40 block mb-0.5">Eye (1-4)</label>
            <input
              type="number"
              min={1} max={4}
              value={gcs?.eye ?? ''}
              onChange={(e) => handleGCS('eye', e.target.value)}
              className={`${inputClass} text-center`}
            />
          </div>
          <div>
            <label className="text-[8px] text-tertiary/40 block mb-0.5">Verbal (1-5)</label>
            <input
              type="number"
              min={1} max={5}
              value={gcs?.verbal ?? ''}
              onChange={(e) => handleGCS('verbal', e.target.value)}
              className={`${inputClass} text-center`}
            />
          </div>
          <div>
            <label className="text-[8px] text-tertiary/40 block mb-0.5">Motor (1-6)</label>
            <input
              type="number"
              min={1} max={6}
              value={gcs?.motor ?? ''}
              onChange={(e) => handleGCS('motor', e.target.value)}
              className={`${inputClass} text-center`}
            />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-tertiary/10 my-2" />

      {/* Time */}
      <div className="mb-2">
        <label className="text-[9px] text-tertiary/50 block mb-0.5">Time</label>
        <input
          type="text"
          value={vs.time}
          onChange={(e) => handleChange('time', e.target.value)}
          className={inputClass}
        />
      </div>

      {/* 2-column grid of vital fields */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-tertiary/50 block mb-0.5">Pulse</label>
          <input type="text" value={vs.pulse} onChange={(e) => handleChange('pulse', e.target.value)}
            placeholder="HR" className={inputClass} />
        </div>
        <div>
          <label className="text-[9px] text-tertiary/50 block mb-0.5">Pulse Location</label>
          <input type="text" value={vs.pulseLocation} onChange={(e) => handleChange('pulseLocation', e.target.value)}
            placeholder="Radial, Carotid..." className={inputClass} />
        </div>
        <div>
          <label className="text-[9px] text-tertiary/50 block mb-0.5">BP</label>
          <input type="text" value={vs.bp} onChange={(e) => handleChange('bp', e.target.value)}
            placeholder="120/80" className={inputClass} />
        </div>
        <div>
          <label className="text-[9px] text-tertiary/50 block mb-0.5">RR</label>
          <input type="text" value={vs.rr} onChange={(e) => handleChange('rr', e.target.value)}
            placeholder="RR" className={inputClass} />
        </div>
        <div>
          <label className="text-[9px] text-tertiary/50 block mb-0.5">SpO2</label>
          <input type="text" value={vs.spo2} onChange={(e) => handleChange('spo2', e.target.value)}
            placeholder="%" className={inputClass} />
        </div>
        <div>
          <label className="text-[9px] text-tertiary/50 block mb-0.5">Pain Scale</label>
          <input type="text" value={vs.painScale} onChange={(e) => handleChange('painScale', e.target.value)}
            placeholder="0-10" className={inputClass} />
        </div>
      </div>
    </div>
  )
}

/* ── Build chip summary text ── */
function buildChipSummary(vs: TC3VitalSet): string {
  const parts: string[] = []
  if (vs.pulse) parts.push(`HR ${vs.pulse}`)
  if (vs.bp) parts.push(vs.bp)
  if (vs.spo2) parts.push(`SpO2 ${vs.spo2}%`)
  return parts.length > 0 ? parts.join(' \u00b7 ') : ''
}

function vitalSetHasData(vs: TC3VitalSet): boolean {
  return !!(vs.pulse || vs.pulseLocation || vs.bp || vs.rr || vs.spo2 || vs.painScale)
}

export const VitalsForm = memo(function VitalsForm() {
  const vitals = useTC3Store((s) => s.card.vitals)
  const addVitalSet = useTC3Store((s) => s.addVitalSet)
  const removeVitalSet = useTC3Store((s) => s.removeVitalSet)
  const avpu = useTC3Store((s) => s.card.avpu)
  const gcs = useTC3Store((s) => s.card.gcs)
  const setAVPU = useTC3Store((s) => s.setAVPU)
  const setGCS = useTC3Store((s) => s.setGCS)

  const [editingId, setEditingId] = useState<string | null>(null)

  // Only consider populated if real data exists — not just empty shell sets
  const populatedSets = vitals.filter(vitalSetHasData)
  const hasData = populatedSets.length > 0 || !!avpu || !!gcs

  const handleAddVitals = () => {
    const newSet: TC3VitalSet = {
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      pulse: '',
      pulseLocation: '',
      bp: '',
      rr: '',
      spo2: '',
      avpu: 'A',
      painScale: '',
    }
    addVitalSet(newSet)
    setEditingId(newSet.id)
  }

  // Clean up empty sets when popover closes
  const handleClose = () => {
    if (editingId) {
      const closing = vitals.find((v) => v.id === editingId)
      if (closing && !vitalSetHasData(closing) && !avpu && !gcs) {
        removeVitalSet(editingId)
      }
    }
    setEditingId(null)
  }

  // Remove set + clear AVPU/GCS if it was the last one
  const handleRemove = () => {
    if (!editingId) return
    removeVitalSet(editingId)
    const remaining = vitals.filter((v) => v.id !== editingId)
    if (remaining.filter(vitalSetHasData).length === 0) {
      setAVPU('')
      setGCS(null)
    }
    setEditingId(null)
  }

  const editingSet = editingId ? vitals.find((v) => v.id === editingId) : null
  const gcsTotal = gcs ? gcs.eye + gcs.verbal + gcs.motor : null

  return (
    <div>
      {/* Section header */}
      <div className="mb-2">
        <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">
          Signs & Symptoms
        </p>
      </div>

      {/* Empty state */}
      {!hasData && (
        <div className="flex flex-col items-center gap-2 py-6">
          <button type="button" onClick={handleAddVitals}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40">
            <Plus size={14} />
          </button>
          <p className="text-[10px] text-tertiary/40">Add vital signs</p>
        </div>
      )}

      {/* Populated — unified card with AVPU/GCS header + vital set chips */}
      {hasData && (
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          {/* AVPU / GCS summary row */}
          <button
            type="button"
            onClick={() => {
              if (vitals.length > 0) setEditingId(vitals[0].id)
              else handleAddVitals()
            }}
            className="w-full flex items-center gap-3 px-4 py-3.5 transition-all active:scale-95 hover:bg-themeblue2/5"
          >
            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              {avpu && (
                <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white shrink-0 ${
                  avpu === 'A' ? 'bg-themegreen' :
                  avpu === 'V' ? 'bg-amber-500' :
                  avpu === 'P' ? 'bg-orange-500' : 'bg-themeredred'
                }`}>
                  {avpu} — {AVPU_LABELS[avpu]}
                </span>
              )}
              {gcsTotal !== null && (
                <span className="text-[11px] text-tertiary/70">
                  GCS: {gcsTotal} (E{gcs!.eye} V{gcs!.verbal} M{gcs!.motor})
                </span>
              )}
              {populatedSets.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-themeredred/10 text-themeredred font-medium shrink-0">
                  {populatedSets.length} set{populatedSets.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <ChevronRight size={16} className="text-tertiary/40 shrink-0" />
          </button>

          {/* Vital set chips — only sets with data */}
          {populatedSets.length > 0 && populatedSets.map((vs, idx) => (
            <button
              key={vs.id}
              type="button"
              onClick={() => setEditingId(vs.id)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-themeblue2/5 active:scale-95 transition-colors border-t border-tertiary/6"
            >
              <span className="text-xs font-medium text-primary shrink-0">Set #{idx + 1}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-tertiary/8 text-tertiary/60 shrink-0">
                {vs.time}
              </span>
              <span className="text-[10px] text-tertiary/60 truncate min-w-0">
                {buildChipSummary(vs)}
              </span>
              <span className="flex-1" />
              <ChevronRight size={14} className="text-tertiary/30 shrink-0" />
            </button>
          ))}

          {/* Add another set — inline at bottom of card */}
          <button
            type="button"
            onClick={handleAddVitals}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] text-tertiary/50 hover:text-primary hover:bg-themeblue2/5 transition-colors border-t border-tertiary/6"
          >
            <Plus size={12} /> Add set
          </button>
        </div>
      )}

      {/* Popover for editing a vital set (includes AVPU + GCS + vitals) */}
      {editingSet && (
        <PreviewOverlay
          isOpen={!!editingId}
          onClose={handleClose}
          anchorRect={null}
          preview={<VitalSetPreviewContent id={editingSet.id} />}
          actions={[
            {
              key: 'remove',
              label: 'Remove',
              icon: X,
              onAction: handleRemove,
              variant: 'danger',
            },
            {
              key: 'done',
              label: 'Done',
              icon: Check,
              onAction: handleClose,
            },
          ]}
        />
      )}
    </div>
  )
})
