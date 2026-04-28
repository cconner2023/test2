import { useEffect, useCallback, useState, useRef } from 'react'
import { MapPin, Check, ChevronRight, ChevronLeft, RefreshCw, Loader, X, Plus } from 'lucide-react'
import { forward } from 'mgrs'
import { SectionCard } from '../Section'
import { TextInput } from '../FormInputs'
import { PreviewOverlay } from '../PreviewOverlay'
import type { ContextMenuAction } from '../PreviewOverlay'
import { useIsMobile } from '../../Hooks/useIsMobile'
import type {
  MedevacRequest,
  MedevacMode,
  MedevacWoundEntry,
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
  medevacNationalityTotal,
} from '../../Types/MedevacTypes'
import { ActionPill } from '../ActionPill'

interface MedevacFormProps {
  value?: MedevacRequest | null
  onChange: (req: MedevacRequest) => void
}

const SMOKE_COLOR_HEX: Record<typeof SMOKE_COLORS[number], string> = {
  Violet: '#7B2D8E',
  Green:  '#00A651',
  Yellow: '#FFD300',
  Red:    '#ED1C24',
  Orange: '#F7941D',
  White:  '#FFFFFF',
}

// ── Line metadata ──────────────────────────────────────────────────────────
const LINE_TITLES_BASE = [
  '',
  'Pickup Site',
  'Radio',
  'Patients by Precedence',
  'Special Equipment',
  'Patients by Type',
  '', // 6 — dynamic
  'Method of Marking',
  'Patient Nationality',
  '', // 9 — dynamic
]

function getLineTitle(line: number, mode: 'wartime' | 'peacetime'): string {
  if (line === 6) return mode === 'wartime' ? 'Security at Pickup' : 'Wound / Injury Info'
  if (line === 9) return mode === 'wartime' ? 'NBC Contamination' : 'Terrain Description'
  return LINE_TITLES_BASE[line]
}

// ── Summary helpers ────────────────────────────────────────────────────────
function lineSummary(line: number, req: MedevacRequest): { text: string; blank: boolean } {
  switch (line) {
    case 1:
      if (!req.l1) return { text: '—', blank: true }
      return { text: req.l1 + (req.l1d ? ` · ${req.l1d}` : ''), blank: false }
    case 2: {
      const parts = [req.l2f, req.l2c, req.l2s].filter(Boolean)
      return parts.length === 0
        ? { text: '—', blank: true }
        : { text: parts.join(' / '), blank: false }
    }
    case 3: {
      const total = medevacPatientTotal(req)
      if (total === 0) return { text: '—', blank: true }
      const s = (['A','B','C','D','E'] as MedevacPrecedence[])
        .filter(p => (req.l3[p] ?? 0) > 0)
        .map(p => `${req.l3[p]}${p}`).join(', ')
      return { text: `${total} · ${s}`, blank: false }
    }
    case 4:
      if (req.l4.length === 1 && req.l4[0] === 'A') return { text: 'None', blank: true }
      return { text: req.l4.join(', '), blank: false }
    case 5:
      if (req.l5l === 0 && req.l5a === 0) return { text: '—', blank: true }
      return {
        text: [req.l5l > 0 && `${req.l5l}L`, req.l5a > 0 && `${req.l5a}A`].filter(Boolean).join(' / '),
        blank: false,
      }
    case 6:
      if (req.mode === 'peacetime') {
        const w = req.l6wounds ?? []
        if (w.length === 0) return { text: '—', blank: true }
        const first = w[0].text
        return { text: w.length > 1 ? `${first} +${w.length - 1}` : first, blank: false }
      }
      return req.l6 === 'N'
        ? { text: 'No Enemy', blank: true }
        : { text: MEDEVAC_SECURITY_LABELS[req.l6], blank: false }
    case 7: {
      const label = MEDEVAC_MARKING_LABELS[req.l7]
      const extra = req.l7 === 'C' && req.l7c ? ` · ${req.l7c}`
        : req.l7 === 'E' && req.l7o ? ` · ${req.l7o}` : ''
      const blank = req.l7 === 'C' && !req.l7c
      return { text: label + extra, blank }
    }
    case 8: {
      const l8total = medevacNationalityTotal(req)
      if (l8total === 0) return { text: '—', blank: true }
      const s = (['A','B','C','D','E'] as MedevacNationality[])
        .filter(n => (req.l8[n] ?? 0) > 0)
        .map(n => `${req.l8[n]}${n}`).join(', ')
      return { text: s, blank: false }
    }
    case 9:
      if (req.mode === 'peacetime') {
        return req.l9p ? { text: req.l9p, blank: false } : { text: '—', blank: true }
      }
      return req.l9 === 'N'
        ? { text: 'None', blank: true }
        : { text: MEDEVAC_NBC_LABELS[req.l9], blank: false }
    default:
      return { text: '—', blank: true }
  }
}

// ── Public component ───────────────────────────────────────────────────────
export function MedevacForm({ value, onChange }: MedevacFormProps) {
  const isMobile = useIsMobile()
  const req = value ?? emptyMedevacRequest()
  const update = (patch: Partial<MedevacRequest>) => onChange({ ...req, ...patch })

  return <MedevacFormInner req={req} update={update} isMobile={isMobile} onChange={onChange} />
}

// ── Master list view ───────────────────────────────────────────────────────
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
  const [activeLine, setActiveLine] = useState<number | null>(null)
  const anchorRef = useRef<DOMRect | null>(null)

  // L5 + L8 must always sum to L3 total
  const l3total = medevacPatientTotal(req)
  useEffect(() => {
    const patch: Partial<MedevacRequest> = {}

    if (l3total > 0 && req.l5l + req.l5a !== l3total) {
      const newL = Math.min(req.l5l, l3total)
      patch.l5l = newL
      patch.l5a = l3total - newL
    }

    if (l3total > 0 && medevacNationalityTotal(req) !== l3total) {
      const nonA = (['B','C','D','E'] as MedevacNationality[])
        .reduce((s, n) => s + (req.l8[n] ?? 0), 0)
      patch.l8 = { ...req.l8, A: Math.max(0, l3total - nonA) }
    }

    if (Object.keys(patch).length > 0) onChange({ ...req, ...patch })
  }, [l3total]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRowTap = useCallback((line: number, e: React.MouseEvent<HTMLButtonElement>) => {
    anchorRef.current = e.currentTarget.getBoundingClientRect()
    setActiveLine(line)
  }, [])

  const closeAll = useCallback(() => {
    setActiveLine(null)
  }, [])

  const clearLine = useCallback((line: number) => {
    switch (line) {
      case 1: update({ l1: '', l1d: undefined }); break
      case 2: update({ l2f: '', l2c: '', l2s: undefined }); break
      case 3: update({ l3: {} }); break
      case 4: update({ l4: ['A'] }); break
      case 5: update({ l5l: 0, l5a: 0 }); break
      case 6: update(req.mode === 'peacetime' ? { l6wounds: [] } : { l6: 'N' }); break
      case 7: update({ l7: 'C', l7c: undefined, l7o: undefined }); break
      case 8: update({ l8: {} }); break
      case 9: update(req.mode === 'peacetime' ? { l9p: undefined } : { l9: 'N' }); break
    }
  }, [update])

  const rowCx = `w-full flex items-center gap-3 text-left border-b border-primary/6 last:border-0 transition-all active:scale-[0.98] hover:bg-themeblue2/5 ${
    isMobile ? 'px-4 py-3.5' : 'px-3 py-3'
  }`

  return (
    <div className="space-y-3">

      {/* Mode toggle */}
      <div className="flex items-center justify-end">
        <ActionPill>
          {(['wartime', 'peacetime'] as MedevacMode[]).map(m => {
            const isActive = req.mode === m
            return (
              <button
                key={m}
                type="button"
                aria-label={m === 'wartime' ? 'Wartime' : 'Peacetime'}
                title={m === 'wartime' ? 'Wartime' : 'Peacetime'}
                onClick={() => update({ mode: m })}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 text-[10pt] font-bold ${
                  isActive ? 'bg-themeblue2 text-white' : 'bg-themeblue2/8 text-primary'
                }`}
              >
                {m === 'wartime' ? 'W' : 'P'}
              </button>
            )
          })}
        </ActionPill>
      </div>

      {/* 9-row master list */}
      <SectionCard>
        {([1,2,3,4,5,6,7,8,9] as const).map(line => {
          const { text, blank } = lineSummary(line, req)
          return (
            <button
              key={line}
              type="button"
              onClick={e => handleRowTap(line, e)}
              className={rowCx}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                <span className="text-[10pt] font-bold text-tertiary">{line}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`${isMobile ? 'text-sm' : 'text-[10pt]'} font-medium text-secondary`}>
                  {getLineTitle(line, req.mode)}
                </p>
              </div>
              <p className={`${isMobile ? 'text-sm' : 'text-[10pt]'} text-right max-w-[45%] truncate ${
                blank ? 'text-tertiary' : 'text-primary font-medium'
              }`}>
                {text}
              </p>
              <ChevronRight size={14} className="text-tertiary shrink-0" />
            </button>
          )
        })}
      </SectionCard>

      {/* Per-line editor */}
      <PreviewOverlay
        isOpen={activeLine !== null}
        onClose={closeAll}
        anchorRect={anchorRef.current}
        title={activeLine !== null ? `L${activeLine} — ${getLineTitle(activeLine, req.mode)}` : ''}
        preview={
          activeLine !== null ? (
            <LineEditor
              line={activeLine}
              req={req}
              update={update}
              isMobile={isMobile}
            />
          ) : null
        }
        actions={activeLine !== null ? ((): ContextMenuAction[] => {
          const isBlank = lineSummary(activeLine, req).blank
          return [
            {
              key: 'prev',
              label: 'Previous line',
              icon: ChevronLeft,
              variant: activeLine > 1 ? 'default' : 'disabled',
              closesOnAction: false,
              onAction: () => setActiveLine(a => (a ?? 1) > 1 ? (a ?? 1) - 1 : a),
            },
            {
              key: 'next',
              label: 'Next line',
              icon: ChevronRight,
              variant: activeLine < 9 ? 'default' : 'disabled',
              closesOnAction: false,
              onAction: () => setActiveLine(a => (a ?? 9) < 9 ? (a ?? 9) + 1 : a),
            },
            ...(!isBlank ? [
              {
                key: 'clear',
                label: 'Clear line',
                icon: RefreshCw,
                variant: 'danger' as const,
                closesOnAction: false,
                onAction: () => clearLine(activeLine),
              },
              {
                key: 'accept',
                label: 'Accept',
                icon: Check,
                onAction: () => {},
              },
            ] : []),
          ]
        })() : []}
      />
    </div>
  )
}

// ── Wound list editor (L6 peacetime) ──────────────────────────────────────
function WoundListEditor({ req, update }: {
  req: MedevacRequest
  update: (patch: Partial<MedevacRequest>) => void
  isMobile: boolean
}) {
  const [rows, setRows] = useState<string[]>(() => [
    ...(req.l6wounds ?? []).map(w => w.text),
    '',
  ])

  function syncUp(next: string[]) {
    setRows(next)
    update({ l6wounds: next.filter(Boolean).map(text => ({ id: crypto.randomUUID(), text })) })
  }

  function updateRow(idx: number, val: string) {
    const next = [...rows]
    next[idx] = val
    syncUp(next)
  }

  function addRow() {
    setRows(prev => [...prev, ''])
  }

  function removeRow(idx: number) {
    syncUp(rows.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-1.5">
      {rows.map((val, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <TextInput
              value={val}
              onChange={v => updateRow(idx, v)}
              placeholder="Wound / injury"
            />
          </div>
          {idx === rows.length - 1 ? (
            <button
              type="button"
              onClick={addRow}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-themeblue3 text-white active:scale-95 transition-all"
            >
              <Plus size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => removeRow(idx)}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
            >
              <X size={13} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Per-line editor ────────────────────────────────────────────────────────
function LineEditor({
  line, req, update, isMobile,
}: {
  line: number
  req: MedevacRequest
  update: (patch: Partial<MedevacRequest>) => void
  isMobile: boolean
}) {
  const [locating, setLocating] = useState(false)

  function handleLocate() {
    if (!('geolocation' in navigator)) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const mgrs = forward([coords.longitude, coords.latitude], 5)
        update({ l1: mgrs })
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const inputCx = `w-full rounded-full border border-themeblue3/10 bg-themewhite2 text-primary placeholder:text-tertiary focus:border-themeblue1/30 focus:outline-none transition-all duration-200 ${
    isMobile ? 'py-2.5 px-4 text-sm' : 'py-2 px-3 text-[10pt]'
  }`

  const rowCx = `flex items-center justify-between border-b border-primary/6 last:border-0 ${
    isMobile ? 'px-4 py-3' : 'px-3 py-2.5'
  }`

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
          <span className="text-[9pt] font-bold text-tertiary mr-2">{code}</span>
          <span className={`${isMobile ? 'text-sm' : 'text-[10pt]'} ${
            selected
              ? danger ? 'text-themeredred font-medium' : 'text-primary font-medium'
              : 'text-secondary'
          }`}>{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {multi && selected && <span className="text-[9pt] text-tertiary">✓</span>}
          {!multi && selected && <Check size={13} className={danger ? 'text-themeredred' : 'text-primary'} />}
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
          {code && <span className="text-[9pt] font-bold text-tertiary mr-2">{code}</span>}
          <span className={`text-secondary ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>{label}</span>
          {hint && <span className="text-[9pt] text-tertiary ml-2">{hint}</span>}
        </div>
        <input
          type="number"
          min={0}
          value={val || ''}
          placeholder="0"
          onChange={e => onChg(Math.max(0, parseInt(e.target.value) || 0))}
          className={`w-14 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none ${
            isMobile ? 'text-base' : 'text-[10pt]'
          }`}
        />
      </div>
    )
  }

  function InlineRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className={rowCx}>
        <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">{label}</span>
        {children}
      </div>
    )
  }

  const l3total = medevacPatientTotal(req)

  switch (line) {
    case 1:
      return (
        <div>
          <div className={rowCx}>
            <input
              type="text"
              value={req.l1}
              onChange={e => update({ l1: e.target.value.toUpperCase() })}
              placeholder="MGRS grid"
              className="flex-1 bg-transparent font-mono tracking-wider text-primary placeholder:text-tertiary focus:outline-none text-sm"
            />
            <button
              type="button"
              title="Use current location"
              onClick={handleLocate}
              disabled={locating}
              className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all hover:text-primary disabled:opacity-40"
            >
              {locating
                ? <Loader size={15} className="animate-spin" />
                : <MapPin size={15} />
              }
            </button>
          </div>
          <div className={rowCx}>
            <input
              type="text"
              value={req.l1d ?? ''}
              onChange={e => update({ l1d: e.target.value })}
              placeholder="Description (optional)"
              className={`flex-1 bg-transparent text-primary placeholder:text-tertiary focus:outline-none ${isMobile ? 'text-sm' : 'text-[10pt]'}`}
            />
          </div>
        </div>
      )

    case 2:
      return (
        <div>
          <InlineRow label="Freq">
            <input
              type="text"
              value={req.l2f}
              onChange={e => update({ l2f: e.target.value })}
              placeholder="46.50"
              className={`flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none ${isMobile ? 'text-sm' : 'text-[10pt]'}`}
            />
          </InlineRow>
          <InlineRow label="Call Sign">
            <input
              type="text"
              value={req.l2c}
              onChange={e => update({ l2c: e.target.value.toUpperCase() })}
              placeholder="DUSTOFF 6"
              className={`flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none ${isMobile ? 'text-sm' : 'text-[10pt]'}`}
            />
          </InlineRow>
          <InlineRow label="Suffix">
            <input
              type="text"
              value={req.l2s ?? ''}
              onChange={e => update({ l2s: e.target.value.toUpperCase() })}
              placeholder="Alpha"
              className={`flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none ${isMobile ? 'text-sm' : 'text-[10pt]'}`}
            />
          </InlineRow>
        </div>
      )

    case 3:
      return (
        <div>
          {(['A','B','C','D','E'] as MedevacPrecedence[]).map(p => (
            <CountRow
              key={p}
              code={p}
              label={MEDEVAC_PRECEDENCE_LABELS[p]}
              val={req.l3[p] ?? 0}
              onChg={n => update({ l3: { ...req.l3, [p]: n || undefined } })}
            />
          ))}
        </div>
      )

    case 4:
      return (
        <div>
          {(['A','B','C','D'] as MedevacEquipment[]).map(eq => (
            <SelectRow
              key={eq}
              code={eq}
              label={MEDEVAC_EQUIPMENT_LABELS[eq]}
              selected={req.l4.includes(eq)}
              multi={eq !== 'A'}
              onSelect={() => {
                if (eq === 'A') { update({ l4: ['A'] }); return }
                const cur = req.l4.filter(e => e !== 'A')
                const next = cur.includes(eq) ? cur.filter(e => e !== eq) : [...cur, eq]
                update({ l4: next.length === 0 ? ['A'] : next })
              }}
            />
          ))}
        </div>
      )

    case 5:
      return (
        <div>
          <CountRow
            code="L" label="Litter" val={req.l5l}
            onChg={n => {
              const newL = Math.min(n, l3total)
              update({ l5l: newL, l5a: Math.max(0, l3total - newL) })
            }}
          />
          <CountRow
            code="A" label="Ambulatory" val={req.l5a}
            onChg={n => {
              const newA = Math.min(n, l3total)
              update({ l5l: Math.max(0, l3total - newA), l5a: newA })
            }}
          />
        </div>
      )

    case 6:
      if (req.mode === 'peacetime') {
        return (
          <div className={isMobile ? 'px-4 py-3' : 'px-3 py-2.5'}>
            <WoundListEditor req={req} update={update} isMobile={isMobile} />
          </div>
        )
      }
      return (
        <div>
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
        </div>
      )

    case 7:
      return (
        <div>
          {(['A','B','C','D','E'] as const).map(m => (
            <SelectRow
              key={m}
              code={m}
              label={MEDEVAC_MARKING_LABELS[m]}
              selected={req.l7 === m}
              onSelect={() => update({ l7: m, l7c: undefined, l7o: undefined })}
            />
          ))}
          {req.l7 === 'C' && (
            <div className="flex justify-center px-4 py-3">
              <ActionPill>
                {SMOKE_COLORS.map(color => {
                  const isActive = req.l7c === color
                  const isWhite = color === 'White'
                  return (
                    <button
                      key={color}
                      type="button"
                      aria-label={color}
                      title={color}
                      onClick={() => update({ l7c: color })}
                      style={{ backgroundColor: SMOKE_COLOR_HEX[color] }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                        isWhite ? 'border border-tertiary/20' : ''
                      } ${
                        isActive ? 'ring-2 ring-themeblue2 ring-offset-2 ring-offset-themewhite' : ''
                      }`}
                    />
                  )
                })}
              </ActionPill>
            </div>
          )}
          {req.l7 === 'E' && (
            <div className="px-4 py-3">
              <input
                type="text"
                value={req.l7o ?? ''}
                onChange={e => update({ l7o: e.target.value })}
                placeholder="Describe marking method"
                className={inputCx}
              />
            </div>
          )}
        </div>
      )

    case 8:
      return (
        <div>
          {(['A','B','C','D','E'] as MedevacNationality[]).map(nat => (
            <CountRow
              key={nat}
              code={nat}
              label={MEDEVAC_NATIONALITY_LABELS[nat]}
              val={req.l8[nat] ?? 0}
              onChg={n => {
                const capped = Math.min(n, l3total)
                if (nat === 'A') {
                  update({ l8: { ...req.l8, A: capped || undefined } })
                } else {
                  const otherNonA = (['B','C','D','E'] as MedevacNationality[])
                    .filter(k => k !== nat)
                    .reduce((s, k) => s + (req.l8[k] ?? 0), 0)
                  const newA = Math.max(0, l3total - capped - otherNonA)
                  update({ l8: { ...req.l8, [nat]: capped || undefined, A: newA || undefined } })
                }
              }}
            />
          ))}
        </div>
      )

    case 9:
      if (req.mode === 'peacetime') {
        return (
          <div className="px-4 py-3">
            <textarea
              value={req.l9p ?? ''}
              onChange={e => update({ l9p: e.target.value })}
              placeholder="Detailed terrain feature description at pickup site"
              rows={4}
              className={`w-full rounded-xl border border-themeblue3/10 bg-themewhite2 text-primary placeholder:text-tertiary focus:border-themeblue1/30 focus:outline-none transition-all duration-200 resize-none px-3 py-2 ${isMobile ? 'text-sm' : 'text-[10pt]'}`}
            />
          </div>
        )
      }
      return (
        <div>
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
        </div>
      )

    default:
      return null
  }
}
