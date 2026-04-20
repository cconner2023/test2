import { useEffect, useCallback } from 'react'
import { Plus, MapPin, Check, RefreshCw } from 'lucide-react'
import { Section, SectionCard } from '../Section'
import { useIsMobile } from '../../Hooks/useIsMobile'
import type {
  MedevacRequest,
  MedevacPrecedence,
  MedevacEquipment,
  MedevacNationality,
} from '../../Types/MedevacTypes'
import {
  emptyMedevacRequest,
  MEDEVAC_PRECEDENCE_LABELS,
  MEDEVAC_EQUIPMENT_LABELS,
  MEDEVAC_SECURITY_LABELS,
  MEDEVAC_MARKING_LABELS,
  MEDEVAC_NATIONALITY_LABELS,
  MEDEVAC_NBC_LABELS,
  SMOKE_COLORS,
  medevacPatientTotal,
} from '../../Types/MedevacTypes'

interface MedevacFormProps {
  value?: MedevacRequest | null
  onChange: (req: MedevacRequest) => void
}

export function MedevacForm({ value, onChange }: MedevacFormProps) {
  const isMobile = useIsMobile()

  // ── Empty state ────────────────────────────────────────────────────────
  if (!value) {
    return (
      <div className="flex flex-col items-center gap-2 py-6">
        <button
          type="button"
          onClick={() => onChange(emptyMedevacRequest())}
          className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40"
        >
          <Plus size={14} />
        </button>
        <p className="text-[10px] text-tertiary/40">Start 9-line</p>
      </div>
    )
  }

  const req = value
  const update = (patch: Partial<MedevacRequest>) => onChange({ ...req, ...patch })

  return <MedevacFormInner req={req} update={update} isMobile={isMobile} onChange={onChange} />
}

// ── Inner form (populated) ─────────────────────────────────────────────────
function MedevacFormInner({
  req,
  update,
  isMobile,
  onChange,
}: {
  req: MedevacRequest
  update: (patch: Partial<MedevacRequest>) => void
  isMobile: boolean
  onChange: (req: MedevacRequest) => void
}) {
  // ── L5 auto-sync from L3 ───────────────────────────────────────────────
  const l3total = medevacPatientTotal(req)
  const l5IsAutoSynced = req.l5l === l3total && req.l5a === 0

  useEffect(() => {
    // Auto-fill L5 from L3 only when L5 is at zero (not yet manually set)
    if (req.l5l === 0 && req.l5a === 0 && l3total > 0) {
      onChange({ ...req, l5l: l3total })
    }
  }, [l3total]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared classes ─────────────────────────────────────────────────────
  const inputCx = `w-full rounded-full border border-themeblue3/10 bg-themewhite2 text-primary placeholder:text-tertiary/30 focus:border-themeblue1/30 focus:outline-none transition-all duration-200 ${
    isMobile ? 'py-2.5 px-4 text-sm' : 'py-2 px-3 text-xs'
  }`

  const rowCx = `flex items-center justify-between border-b border-primary/6 last:border-0 ${
    isMobile ? 'px-4 py-3' : 'px-3 py-2.5'
  }`

  // ── Primitives ─────────────────────────────────────────────────────────

  function SelectRow({ code, label, selected, onSelect, danger, multi }: {
    code: string; label: string; selected: boolean
    onSelect: () => void; danger?: boolean; multi?: boolean
  }) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`w-full text-left transition-all active:scale-[0.98] ${rowCx} ${
          selected ? (danger ? 'bg-themeredred/5' : 'bg-themeblue3/5') : ''
        }`}
      >
        <div>
          <span className="text-[10px] font-bold text-tertiary/40 mr-2">{code}</span>
          <span className={`${isMobile ? 'text-sm' : 'text-xs'} ${
            selected
              ? danger ? 'text-themeredred font-medium' : 'text-themeblue3 font-medium'
              : 'text-secondary'
          }`}>{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {multi && selected && <span className="text-[10px] text-tertiary/40">✓</span>}
          {!multi && selected && <Check size={13} className={danger ? 'text-themeredred' : 'text-themeblue3'} />}
        </div>
      </button>
    )
  }

  function CountRow({ code, label, val, onChg, hint }: {
    code?: string; label: string; val: number; onChg: (n: number) => void; hint?: string
  }) {
    return (
      <div className={rowCx}>
        <div>
          {code && <span className="text-[10px] font-bold text-tertiary/40 mr-2">{code}</span>}
          <span className={`text-secondary ${isMobile ? 'text-sm' : 'text-xs'}`}>{label}</span>
          {hint && <span className="text-[10px] text-tertiary/30 ml-2">{hint}</span>}
        </div>
        <input
          type="number"
          min={0}
          value={val || ''}
          placeholder="0"
          onChange={e => onChg(Math.max(0, parseInt(e.target.value) || 0))}
          className={`w-14 text-center rounded-full border border-themeblue3/10 bg-themewhite3 text-primary focus:border-themeblue1/30 focus:outline-none transition-all ${
            isMobile ? 'py-1.5 text-sm' : 'py-1 text-xs'
          }`}
        />
      </div>
    )
  }

  function InlineRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className={rowCx}>
        <span className="text-[10px] font-semibold text-tertiary/40 uppercase tracking-widest w-20 shrink-0">{label}</span>
        {children}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* LINE 1 */}
      <Section title="Line 1 — Pickup Site" className="mb-0">
        <SectionCard>
          <div className={rowCx}>
            <input
              type="text"
              value={req.l1}
              onChange={e => update({ l1: e.target.value.toUpperCase() })}
              placeholder="MGRS grid"
              className="flex-1 bg-transparent font-mono tracking-wider text-primary placeholder:text-tertiary/30 focus:outline-none text-sm"
            />
            <button
              type="button"
              title="Select from map"
              className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-tertiary/40 active:scale-95 transition-all hover:text-themeblue3"
            >
              <MapPin size={15} />
            </button>
          </div>
          <div className={rowCx}>
            <input
              type="text"
              value={req.l1d ?? ''}
              onChange={e => update({ l1d: e.target.value })}
              placeholder="Description (optional)"
              className={`flex-1 bg-transparent text-primary placeholder:text-tertiary/30 focus:outline-none ${isMobile ? 'text-sm' : 'text-xs'}`}
            />
          </div>
        </SectionCard>
      </Section>

      {/* LINE 2 */}
      <Section title="Line 2 — Radio" className="mb-0">
        <SectionCard>
          <InlineRow label="Freq">
            <input
              type="text"
              value={req.l2f}
              onChange={e => update({ l2f: e.target.value })}
              placeholder="46.50"
              className={`flex-1 text-right bg-transparent text-primary placeholder:text-tertiary/30 focus:outline-none ${isMobile ? 'text-sm' : 'text-xs'}`}
            />
          </InlineRow>
          <InlineRow label="Call Sign">
            <input
              type="text"
              value={req.l2c}
              onChange={e => update({ l2c: e.target.value.toUpperCase() })}
              placeholder="DUSTOFF 6"
              className={`flex-1 text-right bg-transparent text-primary placeholder:text-tertiary/30 focus:outline-none ${isMobile ? 'text-sm' : 'text-xs'}`}
            />
          </InlineRow>
          <InlineRow label="Suffix">
            <input
              type="text"
              value={req.l2s ?? ''}
              onChange={e => update({ l2s: e.target.value.toUpperCase() })}
              placeholder="Alpha"
              className={`flex-1 text-right bg-transparent text-primary placeholder:text-tertiary/30 focus:outline-none ${isMobile ? 'text-sm' : 'text-xs'}`}
            />
          </InlineRow>
        </SectionCard>
      </Section>

      {/* LINE 3 */}
      <Section title="Line 3 — Patients by Precedence" className="mb-0">
        <SectionCard>
          {(['A','B','C','D','E'] as MedevacPrecedence[]).map(p => (
            <CountRow
              key={p}
              code={p}
              label={MEDEVAC_PRECEDENCE_LABELS[p]}
              val={req.l3[p] ?? 0}
              onChg={n => update({ l3: { ...req.l3, [p]: n || undefined } })}
            />
          ))}
        </SectionCard>
      </Section>

      {/* LINE 4 */}
      <Section title="Line 4 — Special Equipment" className="mb-0">
        <SectionCard>
          {(['A','B','C','D'] as MedevacEquipment[]).map(eq => (
            <SelectRow
              key={eq}
              code={eq}
              label={MEDEVAC_EQUIPMENT_LABELS[eq]}
              selected={req.l4.includes(eq)}
              onSelect={() => {
                if (eq === 'A') { update({ l4: ['A'] }); return }
                const cur = req.l4.filter(e => e !== 'A')
                const next = cur.includes(eq) ? cur.filter(e => e !== eq) : [...cur, eq]
                update({ l4: next.length === 0 ? ['A'] : next })
              }}
              multi={eq !== 'A'}
            />
          ))}
        </SectionCard>
      </Section>

      {/* LINE 5 */}
      <Section title="Line 5 — Patients by Type" className="mb-0">
        <SectionCard>
          <CountRow
            code="L"
            label="Litter"
            val={req.l5l}
            onChg={n => update({ l5l: n })}
          />
          <CountRow
            code="A"
            label="Ambulatory"
            val={req.l5a}
            onChg={n => update({ l5a: n })}
          />
        </SectionCard>
        {/* Sync hint */}
        {l3total > 0 && (
          <div className="flex items-center justify-between mt-1 px-1">
            <span className="text-[10px] text-tertiary/40">
              L3 total: {l3total} patient{l3total !== 1 ? 's' : ''}
            </span>
            {!l5IsAutoSynced && (
              <button
                type="button"
                onClick={() => update({ l5l: l3total, l5a: 0 })}
                className="flex items-center gap-1 text-[10px] text-themeblue3/60 active:scale-95 transition-all hover:text-themeblue3"
              >
                <RefreshCw size={10} />
                Sync from L3
              </button>
            )}
          </div>
        )}
      </Section>

      {/* LINE 6 */}
      <Section title="Line 6 — Security at Pickup Site" className="mb-0">
        <SectionCard>
          {(['N','P','E','X'] as const).map(s => (
            <SelectRow
              key={s}
              code={s}
              label={MEDEVAC_SECURITY_LABELS[s]}
              selected={req.l6 === s}
              danger={s === 'E' || s === 'X'}
              onSelect={() => update({ l6: s })}
            />
          ))}
        </SectionCard>
      </Section>

      {/* LINE 7 */}
      <Section title="Line 7 — Method of Marking" className="mb-0">
        <SectionCard>
          {(['A','B','C','D','E'] as const).map(m => (
            <SelectRow
              key={m}
              code={m}
              label={MEDEVAC_MARKING_LABELS[m]}
              selected={req.l7 === m}
              onSelect={() => update({ l7: m, l7c: undefined, l7o: undefined })}
            />
          ))}
        </SectionCard>
        {req.l7 === 'C' && (
          <div className="flex flex-wrap gap-1.5 mt-2 px-1">
            {SMOKE_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => update({ l7c: color })}
                className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-all active:scale-95 ${
                  req.l7c === color
                    ? 'bg-themeblue3/10 border-themeblue3/30 text-themeblue3'
                    : 'bg-themewhite2 border-themeblue3/10 text-secondary'
                }`}
              >
                {color}
              </button>
            ))}
          </div>
        )}
        {req.l7 === 'E' && (
          <input
            type="text"
            value={req.l7o ?? ''}
            onChange={e => update({ l7o: e.target.value })}
            placeholder="Describe marking method"
            className={inputCx + ' mt-2'}
          />
        )}
      </Section>

      {/* LINE 8 */}
      <Section title="Line 8 — Patient Nationality / Status" className="mb-0">
        <SectionCard>
          {(['A','B','C','D','E'] as MedevacNationality[]).map(nat => (
            <SelectRow
              key={nat}
              code={nat}
              label={MEDEVAC_NATIONALITY_LABELS[nat]}
              selected={req.l8.includes(nat)}
              multi
              onSelect={() => {
                const next = req.l8.includes(nat)
                  ? req.l8.filter(n => n !== nat)
                  : [...req.l8, nat]
                update({ l8: next.length === 0 ? ['A'] : next })
              }}
            />
          ))}
        </SectionCard>
      </Section>

      {/* LINE 9 */}
      <Section title="Line 9 — NBC Contamination" className="mb-0">
        <SectionCard>
          {(['N','B','C','R'] as const).map(n => (
            <SelectRow
              key={n}
              code={n}
              label={MEDEVAC_NBC_LABELS[n]}
              selected={req.l9 === n}
              danger={n !== 'N'}
              onSelect={() => update({ l9: n })}
            />
          ))}
        </SectionCard>
      </Section>

    </div>
  )
}
