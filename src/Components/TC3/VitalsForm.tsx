import { memo, useState, useRef, useEffect, type ReactNode } from 'react'
import { Plus, X, Check, TrendingUp } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { PreviewOverlay } from '../PreviewOverlay'
import { BloodPressureInput, DatePickerInput } from '../FormInputs'
import { ActionButton } from '../ActionButton'
import { ActionPill } from '../ActionPill'
import { EmptyState } from '../EmptyState'
import type { TC3VitalSet, AVPU } from '../../Types/TC3Types'

const AVPU_OPTIONS: AVPU[] = ['A', 'V', 'P', 'U']

/* ── GCS component descriptors ── */
const EYE_LABELS: Record<number, string>    = { 1: 'None', 2: 'To Pain', 3: 'To Voice', 4: 'Spontaneous' }
const VERBAL_LABELS: Record<number, string> = { 1: 'None', 2: 'Sounds', 3: 'Words', 4: 'Confused', 5: 'Oriented' }
const MOTOR_LABELS: Record<number, string>  = { 1: 'None', 2: 'Extension', 3: 'Flexion', 4: 'Withdraws', 5: 'Localizes', 6: 'Obeys' }

/* ── Generic value cell — matches the PE-block VitalSignsCalculator grid square
   (label top-left, conversion/hint top-right, value below). ── */
function VCell({ label, hint, hintClass = 'text-tertiary', className, bare, children }: {
  label: string
  hint?: string | null
  hintClass?: string
  className?: string
  bare?: boolean
  children: ReactNode
}) {
  return (
    <div className={`flex flex-col gap-0.5 px-3 py-2 ${bare ? '' : 'border-b border-primary/6 last:border-0'} ${className ?? ''}`}>
      <div className="flex items-baseline justify-between gap-2 min-w-0">
        <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest shrink-0">{label}</span>
        {hint && <span className={`text-[8.5pt] font-medium truncate ${hintClass}`}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

/* ── GCS full-width cell — label + value + wrapping explanation + −/+ ── */
function GcsCell({ label, value, max, labels, onChange }: {
  label: string
  value: number
  max: number
  labels: Record<number, string>
  onChange: (v: number) => void
}) {
  const canDec = value > 0
  const canInc = value < max
  const btn = (active: boolean) =>
    `w-8 h-8 rounded-full flex items-center justify-center text-base font-bold active:scale-95 transition-all ${
      active ? 'bg-tertiary/10 text-primary hover:bg-tertiary/15' : 'bg-tertiary/4 text-tertiary/25 cursor-not-allowed'
    }`
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-primary/6 last:border-0">
      <span className="w-14 text-[9pt] font-semibold text-tertiary uppercase tracking-widest shrink-0">{label}</span>
      <div className="flex-1 min-w-0">
        {value > 0 ? (
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-bold text-primary">{value}</span>
            <span className="text-[8.5pt] text-tertiary">{labels[value]}</span>
          </div>
        ) : (
          <span className="text-sm text-tertiary/40">—</span>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <button type="button" onClick={() => canDec && onChange(value - 1)} className={btn(canDec)}>−</button>
        <button type="button" onClick={() => canInc && onChange(value + 1)} className={btn(canInc)}>+</button>
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

const TEMP_ROUTE_OPTIONS = ['oral', 'rectal'] as const

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

/* ── Compact LMP chip for the trend grid (weeks/days ago) ── */
function lmpChip(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.floor((today.getTime() - d.getTime()) / 86_400_000)
  if (days < 0) return '—'
  const w = Math.floor(days / 7)
  return w > 0 ? `${w}w` : `${days}d`
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
function VitalsTrend({ sets, bio, onSelect }: { sets: TC3VitalSet[]; bio: { ht: string; wt: string; lmp: string }; onSelect: (id: string) => void }) {
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

  // Constant casualty rows — graphed alongside the per-set vitals; only shown
  // once a value is listed. Same value carries across every column (no delta).
  type RenderRow =
    | { kind: 'dyn'; key: RowKey; label: string }
    | { kind: 'bio'; key: string; label: string; value: string }
  const bioRows: RenderRow[] = [
    bio.ht ? { kind: 'bio' as const, key: 'Ht', label: 'Ht', value: bio.ht } : null,
    bio.wt ? { kind: 'bio' as const, key: 'Wt', label: 'Wt', value: bio.wt } : null,
    bio.lmp ? { kind: 'bio' as const, key: 'LMP', label: 'LMP', value: lmpChip(bio.lmp) } : null,
  ].filter(Boolean) as RenderRow[]
  const allRows: RenderRow[] = [...rows.map(r => ({ kind: 'dyn' as const, key: r.key, label: r.label })), ...bioRows]

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
          {allRows.map((row, ri) => (
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
            {allRows.map((row, ri) => {
              const border = ri > 0 ? 'border-t border-tertiary/8' : ''
              // Constant casualty row — same value in every column, no delta.
              if (row.kind === 'bio') {
                return (
                  <div
                    key={row.key}
                    className={`h-8 flex items-center justify-center text-[9pt] text-secondary ${border}`}
                  >
                    {row.value}
                  </div>
                )
              }
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
                  className={`h-8 flex items-center justify-center gap-0.5 text-[9pt] ${border}`}
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
  const ht = useTC3Store((s) => s.card.casualty.ht)
  const wt = useTC3Store((s) => s.card.casualty.wt)
  const lmp = useTC3Store((s) => s.card.casualty.lmp)
  const updateCasualty = useTC3Store((s) => s.updateCasualty)

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

  const sbp = parseSystolic(vs.bp)

  const tempF = parseFloat(vs.temp ?? '')
  const tempC = vs.temp && !isNaN(tempF) ? ((tempF - 32) * 5 / 9).toFixed(1) : null
  const htNum = parseFloat(ht)
  const htHint = ht && !isNaN(htNum) ? `${(htNum * 2.54).toFixed(0)}cm · ${Math.floor(htNum / 12)}'${Math.round(htNum % 12)}"` : null
  const wtNum = parseFloat(wt)
  const wtHint = wt && !isNaN(wtNum) ? `${(wtNum * 0.453592).toFixed(0)}kg` : null
  const todayIso = new Date().toISOString().slice(0, 10)
  const cellInput = 'w-full bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-base md:text-sm'

  // BMI derived from Ht/Wt (inches + lbs → BMI)
  const bmiVal = ht && wt && !isNaN(htNum) && !isNaN(wtNum) && htNum > 0 ? (wtNum / (htNum * htNum)) * 703 : null
  const bmiCat = bmiVal == null ? null
    : bmiVal < 18.5 ? { label: 'Underweight', color: 'text-themeyellow' }
    : bmiVal < 25 ? { label: 'Normal', color: 'text-themegreen' }
    : bmiVal < 30 ? { label: 'Overweight', color: 'text-themeyellow' }
    : { label: 'Obese', color: 'text-themeredred' }

  // LMP hint — weeks/days ago, flag if late
  const lmpInfo = (() => {
    if (!lmp) return null
    const d = new Date(lmp + 'T00:00:00')
    if (isNaN(d.getTime())) return null
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const days = Math.floor((today.getTime() - d.getTime()) / 86_400_000)
    if (days < 0) return { text: 'Future date', color: 'text-tertiary' }
    const w = Math.floor(days / 7), rd = days % 7
    const text = w > 0 ? `${w}w ${rd}d ago` : `${days}d ago`
    return days > 35 ? { text: `${text} · late`, color: 'text-themeyellow' } : { text, color: 'text-tertiary' }
  })()

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {/* Time */}
      <VCell label="Time">
        <input type="text" value={vs.time} onChange={(e) => handleChange('time', e.target.value)} placeholder="HH:MM" className={cellInput} />
      </VCell>

      {/* AVPU — no header; auto-fills GCS */}
      <div className="flex items-stretch border-b border-primary/6">
        {AVPU_OPTIONS.map((opt, i) => (
          <button
            key={opt}
            type="button"
            onClick={() => handleAVPU(opt)}
            className={`flex-1 flex flex-col items-center justify-center px-2 py-2 transition-colors ${
              i > 0 ? 'border-l border-primary/6' : ''
            } ${avpu === opt ? 'bg-themeredred' : 'active:bg-tertiary/5'}`}
          >
            <span className={`text-sm font-bold ${avpu === opt ? 'text-white' : 'text-primary'}`}>{opt}</span>
            <span className={`text-[8pt] ${avpu === opt ? 'text-white/80' : 'text-tertiary'}`}>{AVPU_LABELS[opt]}</span>
          </button>
        ))}
      </div>

      {/* GCS — full-width rows so the explanation can wrap */}
      <GcsCell label="Eye"    value={gcs?.eye    ?? 0} max={4} labels={EYE_LABELS}    onChange={(v) => handleGCS('eye',    String(v))} />
      <GcsCell label="Verbal" value={gcs?.verbal ?? 0} max={5} labels={VERBAL_LABELS} onChange={(v) => handleGCS('verbal', String(v))} />
      <GcsCell label="Motor"  value={gcs?.motor  ?? 0} max={6} labels={MOTOR_LABELS}  onChange={(v) => handleGCS('motor',  String(v))} />
      {gcsTotal !== null && gcsTotal > 0 && (
        <div className="px-3 py-1.5 border-b border-primary/6">
          <span className="text-[10pt] font-medium text-tertiary uppercase tracking-wide">GCS — {gcsTotal}</span>
        </div>
      )}

      {/* Ht | Wt | BMI — BMI auto-populated from Ht/Wt */}
      <div className="flex items-stretch border-b border-primary/6">
        <VCell bare className="flex-1 min-w-0" label="Ht (in)" hint={htHint}>
          <input type="text" inputMode="decimal" value={ht} onChange={(e) => updateCasualty({ ht: e.target.value })} placeholder="68" className={cellInput} />
        </VCell>
        <VCell bare className="flex-1 min-w-0 border-l border-primary/6" label="Wt (lbs)" hint={wtHint}>
          <input type="text" inputMode="decimal" value={wt} onChange={(e) => updateCasualty({ wt: e.target.value })} placeholder="170" className={cellInput} />
        </VCell>
        <VCell bare className="flex-1 min-w-0 border-l border-primary/6" label="BMI" hint={bmiCat?.label} hintClass={bmiCat?.color}>
          <span className={`text-base md:text-sm font-medium ${bmiCat ? bmiCat.color : 'text-tertiary/40'}`}>{bmiVal != null ? bmiVal.toFixed(1) : '—'}</span>
        </VCell>
      </div>

      {/* LMP — full width with hint */}
      <div className="flex flex-col border-b border-primary/6">
        <div className="flex items-baseline justify-between gap-2 px-3 pt-2 min-w-0">
          <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest shrink-0">LMP</span>
          {lmpInfo && <span className={`text-[8.5pt] font-medium truncate ${lmpInfo.color}`}>{lmpInfo.text}</span>}
        </div>
        <DatePickerInput value={lmp} onChange={(v) => updateCasualty({ lmp: v })} placeholder="Select date" maxDate={todayIso} />
      </div>

      {/* HR | Location */}
      <div className="flex items-stretch border-b border-primary/6">
        <VCell bare className="flex-1 min-w-0" label="HR">
          <input type="text" inputMode="numeric" value={vs.pulse} onChange={(e) => handleChange('pulse', e.target.value)} placeholder="bpm" className={cellInput} />
        </VCell>
        <VCell bare className="flex-1 min-w-0 border-l border-primary/6" label="Location">
          <div className="flex mt-0.5">
            {PULSE_LOCATION_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const newLoc = vs.pulseLocation === opt ? '' : opt
                  const isAutoDefault = BP_AUTO_VALUES.has(vs.bp)
                  const updates: Partial<TC3VitalSet> = { pulseLocation: newLoc }
                  if (newLoc && (!vs.bp || isAutoDefault)) updates.bp = BP_LOCATION_DEFAULTS[newLoc]
                  else if (!newLoc && isAutoDefault) updates.bp = ''
                  updateVitalSet(id, updates)
                }}
                className={`px-3 py-0.5 transition-colors ${vs.pulseLocation === opt ? 'bg-themeblue3' : 'active:bg-tertiary/5'}`}
              >
                <span className={`text-[9pt] ${vs.pulseLocation === opt ? 'text-white font-medium' : 'text-secondary'}`}>{opt}</span>
              </button>
            ))}
          </div>
        </VCell>
      </div>

      {/* BP — full width, shared primitive (bare) */}
      <VCell label="BP (mmHg)" hint={sbp !== null && sbp < 90 ? 'Hypotensive — possible shock' : null} hintClass="text-themeyellow">
        <BloodPressureInput
          bare
          value={vs.bp}
          onChange={(v) => handleChange('bp', v)}
          containerClassName="flex items-center gap-1"
          inputClassName="w-16 bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-base md:text-sm"
          separatorClassName="text-tertiary px-1 shrink-0"
        />
      </VCell>

      {/* Temp (°C conversion) | Route */}
      <div className="flex items-stretch border-b border-primary/6">
        <VCell bare className="flex-1 min-w-0" label="Temp (°F)" hint={tempC ? `${tempC}°C` : null}>
          <input type="text" inputMode="decimal" value={vs.temp ?? ''} onChange={(e) => handleChange('temp', e.target.value)} placeholder="98.6" className={cellInput} />
        </VCell>
        <VCell bare className="flex-1 min-w-0 border-l border-primary/6" label="Route">
          <div className="flex mt-0.5">
            {TEMP_ROUTE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => updateVitalSet(id, { tempRoute: vs.tempRoute === opt ? '' : opt })}
                className={`px-3 py-0.5 transition-colors ${vs.tempRoute === opt ? 'bg-themeblue3' : 'active:bg-tertiary/5'}`}
              >
                <span className={`text-[9pt] capitalize ${vs.tempRoute === opt ? 'text-white font-medium' : 'text-secondary'}`}>{opt}</span>
              </button>
            ))}
          </div>
        </VCell>
      </div>

      {/* SpO2 | RR */}
      <div className="flex items-stretch border-b border-primary/6">
        <VCell bare className="flex-1 min-w-0" label="SpO2">
          <input type="text" inputMode="numeric" value={vs.spo2} onChange={(e) => handleChange('spo2', e.target.value)} placeholder="%" className={cellInput} />
        </VCell>
        <VCell bare className="flex-1 min-w-0 border-l border-primary/6" label="RR">
          <input type="text" inputMode="numeric" value={vs.rr} onChange={(e) => handleChange('rr', e.target.value)} placeholder="/min" className={cellInput} />
        </VCell>
      </div>

      {/* Pain — full width */}
      <VCell label="Pain">
        <input type="text" inputMode="numeric" value={vs.painScale} onChange={(e) => handleChange('painScale', e.target.value)} placeholder="0-10" className={cellInput} />
      </VCell>
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
  const ht = useTC3Store((s) => s.card.casualty.ht)
  const wt = useTC3Store((s) => s.card.casualty.wt)
  const lmp = useTC3Store((s) => s.card.casualty.lmp)

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
      tempRoute: '',
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

      {/* Section card — tappable trend grid (FAB adds, tapping a column edits).
          Ht/Wt/LMP are constant casualty rows graphed alongside the per-set vitals. */}
      {!hasData ? (
        <EmptyState
          title="No vital signs recorded"
          action={{ icon: Plus, label: 'Add vital signs', onClick: handleAddVitals }}
        />
      ) : (
        <div className="relative">
          <VitalsTrend sets={populatedSets} bio={{ ht, wt, lmp }} onSelect={setEditingId} />
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
