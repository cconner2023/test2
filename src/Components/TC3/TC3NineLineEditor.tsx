import { useMemo } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
import {
  MEDEVAC_PRECEDENCE_LABELS,
  MEDEVAC_EQUIPMENT_LABELS,
  MEDEVAC_MARKING_LABELS,
  MEDEVAC_NATIONALITY_LABELS,
  SMOKE_COLORS,
  type MedevacRequest,
  type MedevacPrecedence,
  type MedevacEquipment,
  type MedevacMarking,
  type MedevacNationality,
  type MedevacWoundEntry,
  medevacPatientTotal,
} from '../../Types/MedevacTypes'
import type { MedevacLine } from '../Medevac/MedevacCard'

type Setter = <K extends keyof MedevacRequest>(field: K, value: MedevacRequest[K] | undefined) => void

interface TC3NineLineEditorProps {
  isOpen: boolean
  line: MedevacLine | null
  anchorRect: DOMRect | null
  data: MedevacRequest
  /** Set or clear an override on the session (undefined removes). */
  setOverride: Setter
  /** Notify parent the L3 total grew so it can sync the MASCAL queue. */
  onL3GrowDelta?: (delta: number) => void
  onClose: () => void
}

const LINE_TITLES: Record<MedevacLine, string> = {
  l1: 'L1 — Pickup Site',
  l2: 'L2 — Radio',
  l3: 'L3 — Patient Precedence',
  l4: 'L4 — Equipment',
  l5: 'L5 — Patient Type',
  l6: 'L6 — Wounds / Injuries',
  l7: 'L7 — Marking Method',
  l8: 'L8 — Nationality',
  l9: 'L9 — Terrain',
}

// ── Primitives ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, mono }: { value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 rounded-lg bg-themewhite2 border border-tertiary/15 text-primary text-sm focus:outline-none focus:border-themeblue2/40 ${mono ? 'font-mono tracking-wider' : ''}`}
    />
  )
}

function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg bg-themewhite2 border border-tertiary/15 text-primary text-sm focus:outline-none focus:border-themeblue2/40 resize-none"
    />
  )
}

function Stepper({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-full bg-themewhite2 border border-tertiary/15 flex items-center justify-center text-tertiary active:scale-95"
        aria-label="Decrease"
      >
        <Minus size={14} />
      </button>
      <span className="w-8 text-center text-sm font-semibold text-primary tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-full bg-themewhite2 border border-tertiary/15 flex items-center justify-center text-tertiary active:scale-95"
        aria-label="Increase"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[10pt] font-medium transition-colors ${
        active
          ? 'bg-themeblue2 text-white'
          : 'bg-themewhite2 text-tertiary border border-tertiary/15'
      }`}
    >
      {children}
    </button>
  )
}

// ── Per-line editors ───────────────────────────────────────────────────────

function L1Editor({ data, set }: { data: MedevacRequest; set: Setter }) {
  return (
    <div className="space-y-3">
      <Field label="MGRS Grid">
        <TextInput value={data.l1} onChange={v => set('l1', v)} placeholder="e.g. 18S UJ 23456 78901" mono />
      </Field>
      <Field label="Description (optional)">
        <TextInput value={data.l1d ?? ''} onChange={v => set('l1d', v || undefined)} placeholder="LZ name, terrain note" />
      </Field>
    </div>
  )
}

function L2Editor({ data, set }: { data: MedevacRequest; set: Setter }) {
  return (
    <div className="space-y-3">
      <Field label="Frequency">
        <TextInput value={data.l2f} onChange={v => set('l2f', v)} placeholder="e.g. 38.90" mono />
      </Field>
      <Field label="Call Sign">
        <TextInput value={data.l2c} onChange={v => set('l2c', v)} placeholder="e.g. Dustoff 6" />
      </Field>
      <Field label="Suffix (optional)">
        <TextInput value={data.l2s ?? ''} onChange={v => set('l2s', v || undefined)} />
      </Field>
    </div>
  )
}

function L3Editor({ data, set, onGrow }: { data: MedevacRequest; set: Setter; onGrow?: (delta: number) => void }) {
  const total = medevacPatientTotal(data)
  const order: MedevacPrecedence[] = ['B', 'C', 'D', 'E']
  const update = (p: MedevacPrecedence, n: number) => {
    const before = total
    const next = { ...data.l3 }
    if (n <= 0) delete next[p]
    else next[p] = n
    set('l3', next)
    const after = Object.values(next).reduce((s, v) => s + (v ?? 0), 0)
    if (onGrow && after > before) onGrow(after - before)
  }
  return (
    <div className="space-y-2">
      <p className="text-[9pt] text-tertiary italic px-1">All Urgent → B (Urgent Surgical) per current doctrine.</p>
      {order.map(p => (
        <div key={p} className="flex items-center justify-between px-3 py-2 rounded-lg bg-themewhite2">
          <span className="text-sm text-primary font-medium">{p} — {MEDEVAC_PRECEDENCE_LABELS[p]}</span>
          <Stepper value={data.l3[p] ?? 0} onChange={n => update(p, n)} />
        </div>
      ))}
      <div className="flex items-center justify-between px-3 py-1.5 mt-1">
        <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest">Total</span>
        <span className="text-sm font-semibold text-primary">{total}</span>
      </div>
    </div>
  )
}

function L4Editor({ data, set }: { data: MedevacRequest; set: Setter }) {
  const all: MedevacEquipment[] = ['A', 'B', 'C', 'D']
  const toggle = (e: MedevacEquipment) => {
    const has = data.l4.includes(e)
    let next = has ? data.l4.filter(x => x !== e) : [...data.l4.filter(x => x !== 'A'), e]
    if (next.length === 0) next = ['A']
    if (e === 'A') next = ['A']
    set('l4', next)
  }
  return (
    <div className="flex flex-wrap gap-2">
      {all.map(e => (
        <Chip key={e} active={data.l4.includes(e)} onClick={() => toggle(e)}>
          {e} — {MEDEVAC_EQUIPMENT_LABELS[e]}
        </Chip>
      ))}
    </div>
  )
}

function L5Editor({ data, set }: { data: MedevacRequest; set: Setter }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-themewhite2">
        <span className="text-sm text-primary font-medium">Litter</span>
        <Stepper value={data.l5l} onChange={n => set('l5l', n)} />
      </div>
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-themewhite2">
        <span className="text-sm text-primary font-medium">Ambulatory</span>
        <Stepper value={data.l5a} onChange={n => set('l5a', n)} />
      </div>
    </div>
  )
}

function L6Editor({ data, set }: { data: MedevacRequest; set: Setter }) {
  // Always peacetime in TC3-derived 9-line; edit the wound list.
  const wounds = data.l6wounds ?? []
  const update = (next: MedevacWoundEntry[]) => set('l6wounds', next)
  const addBlank = () => update([...wounds, { id: `w-${Date.now()}`, text: '' }])
  const setText = (id: string, text: string) => update(wounds.map(w => w.id === id ? { ...w, text } : w))
  const remove = (id: string) => update(wounds.filter(w => w.id !== id))

  return (
    <div className="space-y-2">
      {wounds.length === 0 && (
        <p className="text-[10pt] text-tertiary italic px-1">No wounds documented. Tap + to add.</p>
      )}
      {wounds.map(w => (
        <div key={w.id} className="flex items-center gap-2">
          <TextInput value={w.text} onChange={t => setText(w.id, t)} placeholder="e.g. 1x GSW (Right thigh)" />
          <button
            type="button"
            onClick={() => remove(w.id)}
            className="w-8 h-8 rounded-full bg-themeredred/8 text-themeredred flex items-center justify-center active:scale-95 shrink-0"
            aria-label="Remove wound"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div className="flex justify-end pt-1">
        <ActionPill shadow="sm">
          <ActionButton icon={Plus} label="Add wound entry" onClick={addBlank} />
        </ActionPill>
      </div>
    </div>
  )
}

function L7Editor({ data, set }: { data: MedevacRequest; set: Setter }) {
  const all: MedevacMarking[] = ['A', 'B', 'C', 'D', 'E']
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {all.map(m => (
          <Chip key={m} active={data.l7 === m} onClick={() => set('l7', m)}>
            {m} — {MEDEVAC_MARKING_LABELS[m]}
          </Chip>
        ))}
      </div>
      {data.l7 === 'C' && (
        <Field label="Smoke Color">
          <div className="flex flex-wrap gap-2">
            {SMOKE_COLORS.map(c => (
              <Chip key={c} active={data.l7c === c} onClick={() => set('l7c', c)}>{c}</Chip>
            ))}
          </div>
        </Field>
      )}
      {data.l7 === 'E' && (
        <Field label="Other (describe)">
          <TextInput value={data.l7o ?? ''} onChange={v => set('l7o', v || undefined)} />
        </Field>
      )}
    </div>
  )
}

function L8Editor({ data, set }: { data: MedevacRequest; set: Setter }) {
  const order: MedevacNationality[] = ['A', 'B', 'C', 'D', 'E']
  const update = (n: MedevacNationality, count: number) => {
    const next = { ...data.l8 }
    if (count <= 0) delete next[n]
    else next[n] = count
    set('l8', next)
  }
  return (
    <div className="space-y-2">
      {order.map(n => (
        <div key={n} className="flex items-center justify-between px-3 py-2 rounded-lg bg-themewhite2">
          <span className="text-sm text-primary font-medium">{n} — {MEDEVAC_NATIONALITY_LABELS[n]}</span>
          <Stepper value={data.l8[n] ?? 0} onChange={c => update(n, c)} />
        </div>
      ))}
    </div>
  )
}

function L9Editor({ data, set }: { data: MedevacRequest; set: Setter }) {
  return (
    <Field label="Terrain Description">
      <TextArea value={data.l9p ?? ''} onChange={v => set('l9p', v || undefined)} placeholder="e.g. Open field 50m N of road, slight slope, no obstacles" rows={4} />
    </Field>
  )
}

// ── Shell ──────────────────────────────────────────────────────────────────

export function TC3NineLineEditor({ isOpen, line, anchorRect, data, setOverride, onL3GrowDelta, onClose }: TC3NineLineEditorProps) {
  const body = useMemo(() => {
    if (!line) return null
    switch (line) {
      case 'l1': return <L1Editor data={data} set={setOverride} />
      case 'l2': return <L2Editor data={data} set={setOverride} />
      case 'l3': return <L3Editor data={data} set={setOverride} onGrow={onL3GrowDelta} />
      case 'l4': return <L4Editor data={data} set={setOverride} />
      case 'l5': return <L5Editor data={data} set={setOverride} />
      case 'l6': return <L6Editor data={data} set={setOverride} />
      case 'l7': return <L7Editor data={data} set={setOverride} />
      case 'l8': return <L8Editor data={data} set={setOverride} />
      case 'l9': return <L9Editor data={data} set={setOverride} />
    }
  }, [line, data, setOverride, onL3GrowDelta])

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={anchorRect}
      title={line ? LINE_TITLES[line] : '9-Line'}
      maxWidth={380}
    >
      <div className="px-4 py-4">{body}</div>
    </PreviewOverlay>
  )
}
