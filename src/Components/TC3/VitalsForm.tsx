import { memo, useState, useRef, useEffect } from 'react'
import { Plus, X, Check, TrendingUp } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { PreviewOverlay } from '../PreviewOverlay'
import { TextInput } from '../FormInputs'
import { ActionButton } from '../ActionButton'
import { ActionPill } from '../ActionPill'
import { EmptyState } from '../EmptyState'
import type { TC3VitalSet, AVPU } from '../../Types/TC3Types'

const AVPU_OPTIONS: AVPU[] = ['A', 'V', 'P', 'U']

/* ── GCS component descriptors ── */
const EYE_LABELS: Record<number, string>    = { 1: 'None', 2: 'To Pain', 3: 'To Voice', 4: 'Spontaneous' }
const VERBAL_LABELS: Record<number, string> = { 1: 'None', 2: 'Sounds', 3: 'Words', 4: 'Confused', 5: 'Oriented' }
const MOTOR_LABELS: Record<number, string>  = { 1: 'None', 2: 'Extension', 3: 'Flexion', 4: 'Withdraws', 5: 'Localizes', 6: 'Obeys' }

function GCSStepperRow({ label, value, max, labels, onChange }: {
  label: string
  value: number
  max: number
  labels: Record<number, string>
  onChange: (v: number) => void
}) {
  const canDec = value > 0
  const canInc = value < max
  return (
    <div className="flex items-center gap-3 rounded-full bg-tertiary/6 pl-4 pr-1.5 py-1.5">
      {/* Label + value on the left */}
      <span className="w-12 text-[9pt] font-medium text-tertiary uppercase tracking-wide shrink-0">{label}</span>
      <div className="flex-1 flex flex-col min-w-0">
        {value > 0 ? (
          <>
            <span className="text-sm font-bold text-primary leading-none">{value}</span>
            <span className="text-[8pt] text-tertiary mt-0.5 leading-none truncate">{labels[value]}</span>
          </>
        ) : (
          <span className="text-sm text-tertiary/40">—</span>
        )}
      </div>
      {/* − + grouped on the right */}
      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={() => canDec && onChange(value - 1)}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all text-base font-bold active:scale-95 ${
            canDec ? 'bg-tertiary/10 text-primary hover:bg-tertiary/15' : 'bg-tertiary/4 text-tertiary/25 cursor-not-allowed'
          }`}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => canInc && onChange(value + 1)}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all text-base font-bold active:scale-95 ${
            canInc ? 'bg-tertiary/10 text-primary hover:bg-tertiary/15' : 'bg-tertiary/4 text-tertiary/25 cursor-not-allowed'
          }`}
        >
          +
        </button>
      </div>
    </div>
  )
}
const AVPU_LABELS: Record<AVPU, string> = {
  A: 'Alert',
  V: 'Voice',
  P: 'Pain',
  U: 'Unresponsive',
}

const PULSE_LOCATION_OPTIONS = ['C', 'R', 'F'] as const
type PulseLocation = typeof PULSE_LOCATION_OPTIONS[number]

const BP_INPUT_CLASS = 'w-full px-4 py-2.5 rounded-full text-primary text-sm border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 bg-themewhite dark:bg-themewhite3 focus:outline-none transition-all duration-300 placeholder:text-tertiary'

/** Estimated minimum systolic by palpable pulse site (TCCC) */
const BP_LOCATION_DEFAULTS: Record<PulseLocation, string> = {
  R: '80/p',
  F: '70/p',
  C: '60/p',
}
const BP_AUTO_VALUES = new Set(Object.values(BP_LOCATION_DEFAULTS))

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

/* ── Parse systolic from bp field ── */
function parseSystolic(bp: string): number | null {
  if (!bp) return null
  const sys = bp.split('/')[0]?.trim() ?? ''
  const n = parseInt(sys)
  return isNaN(n) ? null : n
}

/* ── Signs & Symptoms trend grid — one tappable column per vital set ──
   Horizontal scroll (newest column at the right, in view by default — scroll
   left for earlier sets, same scroll feel as the Troops-to-Task timeline).
   Tapping a column opens that set's editor. */
function VitalsTrend({ sets, onSelect }: { sets: TC3VitalSet[]; onSelect: (id: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Jump to the most-recent column on mount and whenever a set is added —
  // reuses the Troops-to-Task pattern of setting scrollLeft directly.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [sets.length])

  type RowKey = 'HR' | 'SBP' | 'SpO2' | 'SI' | 'GCS' | 'Temp' | 'Pain'

  function getVal(vs: TC3VitalSet, key: RowKey): number | null {
    if (key === 'HR') { const n = parseInt(vs.pulse); return isNaN(n) ? null : n }
    if (key === 'SBP') return parseSystolic(vs.bp)
    if (key === 'SpO2') { const n = parseInt(vs.spo2); return isNaN(n) ? null : n }
    if (key === 'SI') {
      const hr = parseInt(vs.pulse)
      const sbp = parseSystolic(vs.bp)
      if (!isNaN(hr) && hr > 0 && sbp !== null && sbp > 0) return hr / sbp
      return null
    }
    if (key === 'GCS') return vs.gcs ? vs.gcs.eye + vs.gcs.verbal + vs.gcs.motor : null
    if (key === 'Temp') { const n = parseFloat(vs.temp ?? ''); return isNaN(n) ? null : n }
    if (key === 'Pain') { const n = parseInt(vs.painScale); return isNaN(n) ? null : n }
    return null
  }

  function siColor(si: number | null): string {
    if (si === null) return 'text-tertiary'
    if (si > 1.0) return 'text-themeredred'
    if (si >= 0.9) return 'text-amber-500'
    return 'text-themegreen'
  }

  function delta(key: RowKey, curr: number | null, prev: number | null): { arrow: string; color: string } {
    if (curr === null || prev === null) return { arrow: '', color: '' }
    const diff = curr - prev
    const threshold = key === 'SI' ? 0.01 : key === 'Temp' ? 0.1 : 1
    if (Math.abs(diff) < threshold) return { arrow: '→', color: 'text-tertiary' }
    const up = diff > 0
    if (key === 'HR' || key === 'SI' || key === 'Pain') {
      return up ? { arrow: '↑', color: 'text-themeredred' } : { arrow: '↓', color: 'text-themegreen' }
    }
    if (key === 'SpO2' || key === 'GCS') {
      return up ? { arrow: '↑', color: 'text-themegreen' } : { arrow: '↓', color: 'text-themeredred' }
    }
    // SBP, Temp — neutral
    return up ? { arrow: '↑', color: 'text-secondary' } : { arrow: '↓', color: 'text-secondary' }
  }

  const rows: { key: RowKey; label: string }[] = [
    { key: 'HR',   label: 'HR' },
    { key: 'SBP',  label: 'SBP' },
    { key: 'SpO2', label: 'SpO₂' },
    { key: 'SI',   label: 'SI' },
    { key: 'GCS',  label: 'GCS' },
    { key: 'Temp', label: 'Temp' },
    { key: 'Pain', label: 'Pain' },
  ]

  return (
    <div
      ref={scrollRef}
      className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-x-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      <div className="flex min-w-max">
        {/* Sticky label column */}
        <div className="sticky left-0 z-10 shrink-0 bg-themewhite2 border-r border-tertiary/8">
          <div className="h-7 flex items-center gap-1 px-2.5 text-[9pt] font-medium text-tertiary uppercase tracking-wide bg-tertiary/4">
            <TrendingUp size={10} className="shrink-0" />
            Trend
          </div>
          {rows.map((row, ri) => (
            <div
              key={row.key}
              className={`h-8 flex items-center px-2.5 text-[9pt] font-medium text-tertiary ${ri > 0 ? 'border-t border-tertiary/8' : ''}`}
            >
              {row.label}
            </div>
          ))}
        </div>

        {/* One tappable column per vital set */}
        {sets.map((vs, ci) => (
          <button
            key={vs.id}
            type="button"
            onClick={() => onSelect(vs.id)}
            className="shrink-0 w-[4.75rem] text-center border-l border-tertiary/8 hover:bg-themeblue2/5 active:scale-95 transition-colors"
          >
            <div className="h-7 flex items-center justify-center px-1 text-[9pt] font-medium text-tertiary uppercase tracking-wide bg-tertiary/4 truncate">
              {vs.time || '—'}
            </div>
            {rows.map((row, ri) => {
              const curr = getVal(vs, row.key)
              const prev = ci > 0 ? getVal(sets[ci - 1], row.key) : null
              const d = delta(row.key, curr, prev)
              const valColor = row.key === 'SI' ? siColor(curr) : 'text-primary'
              const displayVal = curr === null
                ? '—'
                : row.key === 'SI' ? curr.toFixed(2)
                : row.key === 'Temp' ? curr.toFixed(1)
                : String(Math.round(curr))

              return (
                <div
                  key={row.key}
                  className={`h-8 flex items-center justify-center gap-0.5 text-[9pt] ${ri > 0 ? 'border-t border-tertiary/8' : ''}`}
                >
                  <span className={valColor}>{displayVal}</span>
                  {d.arrow && <span className={d.color}>{d.arrow}</span>}
                </div>
              )
            })}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Popover preview — AVPU + GCS (linked) + vital fields ── */
function VitalSetPreviewContent({ id }: { id: string }) {
  const vs = useTC3Store((s) => s.card.vitals.find((v) => v.id === id))
  const updateVitalSet = useTC3Store((s) => s.updateVitalSet)

  if (!vs) return null

  const avpu = vs.avpu
  const gcs = vs.gcs

  const handleChange = (field: keyof TC3VitalSet, value: string) => {
    updateVitalSet(id, { [field]: value })
  }

  // AVPU → auto-fill GCS defaults, both stored on this set
  const handleAVPU = (opt: AVPU) => {
    if (avpu === opt) {
      updateVitalSet(id, { avpu: '', gcs: null })
      return
    }
    updateVitalSet(id, { avpu: opt, gcs: AVPU_GCS_DEFAULTS[opt] })
  }

  // GCS change → auto-update AVPU from total
  const handleGCS = (field: 'eye' | 'verbal' | 'motor', raw: string) => {
    const v = parseInt(raw) || 0
    const next = {
      eye: field === 'eye' ? v : gcs?.eye ?? 0,
      verbal: field === 'verbal' ? v : gcs?.verbal ?? 0,
      motor: field === 'motor' ? v : gcs?.motor ?? 0,
    }
    const total = next.eye + next.verbal + next.motor
    updateVitalSet(id, total > 0 ? { gcs: next, avpu: gcsToAVPU(total) } : { gcs: next })
  }

  const gcsTotal = gcs ? gcs.eye + gcs.verbal + gcs.motor : null

  const bpSys = vs.bp.split('/')[0]?.trim() ?? ''
  const bpDia = vs.bp.split('/')[1]?.trim() ?? ''

  return (
    <div className="px-4 py-3 space-y-3" onClick={(e) => e.stopPropagation()}>
      {/* AVPU */}
      <div>
        <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest">AVPU</span>
        <div className="mt-1.5 flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {AVPU_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleAVPU(opt)}
              className={`shrink-0 px-4 py-1.5 transition-colors ${
                avpu === opt ? 'bg-themeredred' : 'active:bg-tertiary/5'
              }`}
            >
              <span className={`text-[9pt] transition-colors ${
                avpu === opt ? 'text-white font-medium' : 'text-secondary'
              }`}>
                {opt}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* GCS steppers */}
      <div className="space-y-2">
        <GCSStepperRow label="Eye"    value={gcs?.eye    ?? 0} max={4} labels={EYE_LABELS}    onChange={(v) => handleGCS('eye',    String(v))} />
        <GCSStepperRow label="Verbal" value={gcs?.verbal ?? 0} max={5} labels={VERBAL_LABELS} onChange={(v) => handleGCS('verbal', String(v))} />
        <GCSStepperRow label="Motor"  value={gcs?.motor  ?? 0} max={6} labels={MOTOR_LABELS}  onChange={(v) => handleGCS('motor',  String(v))} />
        {gcsTotal !== null && gcsTotal > 0 && (
          <p className="text-[10pt] font-medium text-tertiary uppercase tracking-wide pl-1 pt-0.5">GCS — {gcsTotal}</p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-tertiary/10" />

      {/* Time */}
      <TextInput label="Time" value={vs.time} onChange={(v) => handleChange('time', v)} placeholder="HH:MM" />

      {/* Pulse + Location pills */}
      <div className="grid grid-cols-2 gap-2">
        <TextInput label="Pulse" value={vs.pulse} onChange={(v) => handleChange('pulse', v)} placeholder="HR" inputMode="numeric" />
        <div>
          <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest">Location</span>
          <div className="mt-1.5 flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {PULSE_LOCATION_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const newLoc = vs.pulseLocation === opt ? '' : opt
                  const isAutoDefault = BP_AUTO_VALUES.has(vs.bp)
                  const updates: Partial<TC3VitalSet> = { pulseLocation: newLoc }
                  if (newLoc && (!vs.bp || isAutoDefault)) {
                    updates.bp = BP_LOCATION_DEFAULTS[newLoc]
                  } else if (!newLoc && isAutoDefault) {
                    updates.bp = ''
                  }
                  updateVitalSet(id, updates)
                }}
                className={`shrink-0 px-4 py-1.5 transition-colors ${
                  vs.pulseLocation === opt ? 'bg-themeblue3' : 'active:bg-tertiary/5'
                }`}
              >
                <span className={`text-[9pt] transition-colors ${
                  vs.pulseLocation === opt ? 'text-white font-medium' : 'text-secondary'
                }`}>
                  {opt}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* BP — side-by-side with / separator (VS calculator pattern) */}
      <div>
        <span className="text-[10pt] font-medium text-tertiary uppercase tracking-wide">BP (mmHg)</span>
        <div className="flex items-center gap-1.5 mt-1">
          <input
            type="text" inputMode="numeric"
            value={bpSys}
            onChange={(e) => handleChange('bp', `${e.target.value}/${bpDia}`)}
            placeholder="120"
            className={BP_INPUT_CLASS}
          />
          <span className="text-[10pt] text-secondary shrink-0">/</span>
          <input
            type="text" inputMode="numeric"
            value={bpDia}
            onChange={(e) => handleChange('bp', `${bpSys}/${e.target.value}`)}
            placeholder="80"
            className={BP_INPUT_CLASS}
          />
        </div>
      </div>

      {/* Remaining vitals */}
      <div className="grid grid-cols-2 gap-2">
        <TextInput label="RR" value={vs.rr} onChange={(v) => handleChange('rr', v)} placeholder="/min" inputMode="numeric" />
        <TextInput label="SpO2" value={vs.spo2} onChange={(v) => handleChange('spo2', v)} placeholder="%" inputMode="numeric" />
        <TextInput label="Temp" value={vs.temp ?? ''} onChange={(v) => handleChange('temp', v)} placeholder="°F" inputMode="decimal" />
        <TextInput label="Pain" value={vs.painScale} onChange={(v) => handleChange('painScale', v)} placeholder="0-10" inputMode="numeric" />
      </div>
    </div>
  )
}

function vitalSetHasData(vs: TC3VitalSet): boolean {
  return !!(vs.pulse || vs.pulseLocation || vs.bp || vs.rr || vs.spo2 || vs.painScale || vs.avpu || vs.gcs)
}

export const VitalsForm = memo(function VitalsForm() {
  const vitals = useTC3Store((s) => s.card.vitals)
  const addVitalSet = useTC3Store((s) => s.addVitalSet)
  const removeVitalSet = useTC3Store((s) => s.removeVitalSet)

  const [editingId, setEditingId] = useState<string | null>(null)

  const populatedSets = vitals.filter(vitalSetHasData)
  const hasData = populatedSets.length > 0

  const handleAddVitals = () => {
    const newSet: TC3VitalSet = {
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      pulse: '',
      pulseLocation: '',
      bp: '',
      rr: '',
      spo2: '',
      avpu: '',
      painScale: '',
      temp: '',
      gcs: null,
    }
    addVitalSet(newSet)
    setEditingId(newSet.id)
  }

  // Clean up empty sets when popover closes
  const handleClose = () => {
    if (editingId) {
      const closing = vitals.find((v) => v.id === editingId)
      if (closing && !vitalSetHasData(closing)) {
        removeVitalSet(editingId)
      }
    }
    setEditingId(null)
  }

  const handleRemove = () => {
    if (!editingId) return
    removeVitalSet(editingId)
    setEditingId(null)
  }

  const editingSet = editingId ? vitals.find((v) => v.id === editingId) : null

  return (
    <div data-tour="tc3-vitals">
      {/* Section header */}
      <div className="mb-2">
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">
          Signs & Symptoms
        </p>
      </div>

      {/* Section card — tappable trend grid (FAB adds, tapping a column edits) */}
      {!hasData ? (
        <EmptyState
          title="No vital signs recorded"
          action={{ icon: Plus, label: 'Add vital signs', onClick: handleAddVitals }}
        />
      ) : (
        <div className="relative">
          <VitalsTrend sets={populatedSets} onSelect={setEditingId} />
          <ActionPill shadow="sm" placement="overlay">
            <ActionButton icon={Plus} label="Add vital signs" onClick={handleAddVitals} />
          </ActionPill>
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
