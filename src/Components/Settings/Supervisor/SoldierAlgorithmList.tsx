import { useMemo, useState } from 'react'
import { ChevronRight, ClipboardCheck, CalendarPlus, CheckCircle2, Circle, CircleDot, XCircle, type LucideIcon } from 'lucide-react'
import { listAlgorithmsWithStp } from '../../../Utilities/algorithmStp'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { ActionPill } from '@/Components/primitives/ActionPill'
import { PreviewOverlay } from '../../PreviewOverlay'
import { readinessBarColor, readinessTextColor } from './supervisorHelpers'
import type { AlgorithmCompetency } from './supervisorHelpers'

// ─── Drill-down signal row ───────────────────────────────────────────────────
// The per-algorithm drill shows three plain-language signals instead of the old
// STP/red-flags/DDX/run competency bars (red flags + DDX aren't GO/NO_GO
// testable). Each row = icon + label + right-aligned status. USR 2026-07-12.
type SignalTone = 'good' | 'warn' | 'bad' | 'muted'

const TONE_TEXT: Record<SignalTone, string> = {
  good: 'text-themegreen',
  warn: 'text-themeyellow',
  bad: 'text-themeredred',
  muted: 'text-tertiary',
}

function SignalRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string
  tone: SignalTone
}) {
  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <Icon size={16} className={`${TONE_TEXT[tone]} shrink-0`} />
      <span className="text-sm text-primary flex-1 min-w-0 truncate">{label}</span>
      <span className={`text-[9pt] font-semibold shrink-0 ${TONE_TEXT[tone]}`}>{value}</span>
    </div>
  )
}

interface SoldierAlgorithmListProps {
  /** This soldier's per-algorithm composite competency (sorted; we regroup). */
  competency: AlgorithmCompetency[]
  /** training_item_ids this soldier has a `read` completion for. An algorithm id
   *  in this set means the medic has run/read that algorithm (logNow). */
  ranAlgorithmIds: Set<string>
  /** Evaluate a whole algorithm — cascades through its STPs + the run dimension. */
  onEvaluateAlgorithm?: (algorithmId: string, algorithmName: string) => void
  /** Schedule algorithm training for this soldier (prefilled calendar event). */
  onScheduleAlgorithm?: (algorithmId: string, algorithmName: string) => void
}

/**
 * The expanded list behind the soldier profile's collapsed "Algorithms" row:
 * every algorithm (A-1…X) this soldier has, grouped under its catData category,
 * each row drilling into the per-dimension breakdown overlay (Evaluate / Schedule).
 * The per-soldier mirror of AlgorithmGapList — pulled out of SoldierProfile so the
 * flat algorithm list no longer lives inline in the profile.
 */
export function SoldierAlgorithmList({
  competency,
  ranAlgorithmIds,
  onEvaluateAlgorithm,
  onScheduleAlgorithm,
}: SoldierAlgorithmListProps) {
  const [detail, setDetail] = useState<{ comp: AlgorithmCompetency; anchor: DOMRect } | null>(null)

  const categories = useMemo(() => {
    const compById = new Map(competency.map((c) => [c.id, c]))
    const out: { category: string; items: AlgorithmCompetency[] }[] = []
    const indexByCategory = new Map<string, number>()
    // catData render order — algorithms come out A-1…X within each category.
    for (const a of listAlgorithmsWithStp()) {
      const comp = compById.get(a.id)
      if (!comp) continue
      let ci = indexByCategory.get(a.category)
      if (ci === undefined) {
        ci = out.length
        indexByCategory.set(a.category, ci)
        out.push({ category: a.category, items: [] })
      }
      out[ci].items.push(comp)
    }
    return out
  }, [competency])

  return (
    <div>
      {categories.length === 0 ? (
        <div className="rounded-2xl bg-themewhite2 overflow-hidden px-4 py-4">
          <p className="text-[10pt] text-tertiary">No algorithms map to STP tasks</p>
        </div>
      ) : (
        categories.map(({ category, items }) => (
          <div key={category} className="mb-4 last:mb-0">
            <p className="text-[8pt] font-semibold text-tertiary uppercase tracking-wider mb-1.5">
              {category}
            </p>
            <div className="rounded-2xl bg-themewhite2 overflow-hidden">
              {items.map((a, idx) => (
                <button
                  key={a.id}
                  onClick={(e) => setDetail({ comp: a, anchor: e.currentTarget.getBoundingClientRect() })}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-themeblue2/5 active:scale-[0.99] transition-all ${idx > 0 ? 'border-t border-tertiary/8' : ''}`}
                >
                  <span className="text-[9pt] font-bold text-white bg-themeblue3 px-1.5 py-0.5 rounded shrink-0 w-10 text-center">
                    {a.id}
                  </span>
                  <span className="text-sm font-medium text-primary min-w-0 truncate flex-1">{a.name}</span>
                  <div className="w-20 shrink-0 hidden sm:block">
                    <div
                      className="h-1.5 rounded-full bg-tertiary/10 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={a.pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className={`h-full rounded-full transition-all ${readinessBarColor(a.pct)}`} style={{ width: `${a.pct}%` }} />
                    </div>
                  </div>
                  <span className={`text-[9pt] font-semibold w-12 text-right shrink-0 ${
                    a.status === 'trained' ? 'text-themegreen' : a.status === 'partial' ? readinessTextColor(a.pct) : 'text-tertiary'
                  }`}>
                    {a.status === 'trained' ? 'Trained' : a.status === 'partial' ? `${a.pct}%` : 'Untrained'}
                  </span>
                  <ChevronRight size={14} className="text-tertiary shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Algorithm drill-down — three plain signals + evaluate/schedule */}
      <PreviewOverlay
        isOpen={!!detail}
        onClose={() => setDetail(null)}
        anchorRect={detail?.anchor ?? null}
        title={detail ? `${detail.comp.id} · ${detail.comp.name}` : ''}
        maxWidth={400}
        footer={
          detail && onScheduleAlgorithm ? (
            <ActionPill>
              <ActionButton
                icon={CalendarPlus}
                label="Schedule"
                onClick={() => {
                  const { id, name } = detail.comp
                  setDetail(null)
                  onScheduleAlgorithm(id, name)
                }}
              />
            </ActionPill>
          ) : undefined
        }
        rightFooter={
          detail && onEvaluateAlgorithm ? (
            <ActionPill>
              <ActionButton
                icon={ClipboardCheck}
                label="Evaluate"
                variant="success"
                onClick={() => {
                  const { id, name } = detail.comp
                  setDetail(null)
                  onEvaluateAlgorithm(id, name)
                }}
              />
            </ActionPill>
          ) : undefined
        }
      >
        {detail && (() => {
          const comp = detail.comp
          const stpDim = comp.dims.find((d) => d.dim === 'stp')
          const runDim = comp.dims.find((d) => d.dim === 'run')
          const ran = ranAlgorithmIds.has(comp.id)

          // 1. Did they do the STPs? — supervisor test-GO on the mapped STP tasks.
          const stp: { tone: SignalTone; icon: LucideIcon; value: string } = !stpDim
            ? { tone: 'muted', icon: Circle, value: 'No STP tasks' }
            : stpDim.met
              ? { tone: 'good', icon: CheckCircle2, value: `${stpDim.validated}/${stpDim.total}` }
              : stpDim.validated > 0
                ? { tone: 'warn', icon: CircleDot, value: `${stpDim.validated}/${stpDim.total}` }
                : { tone: 'muted', icon: Circle, value: `0/${stpDim.total}` }

          // 3. Have they been evaluated? — a supervisor `test` on the run-through.
          const evalSig: { tone: SignalTone; icon: LucideIcon; value: string } = !runDim?.graded
            ? { tone: 'muted', icon: Circle, value: 'Not evaluated' }
            : runDim.met
              ? { tone: 'good', icon: CheckCircle2, value: 'GO' }
              : { tone: 'bad', icon: XCircle, value: 'NO-GO' }

          return (
            <div className="py-1 divide-y divide-tertiary/8">
              <SignalRow icon={stp.icon} label="STPs completed" value={stp.value} tone={stp.tone} />
              <SignalRow
                icon={ran ? CheckCircle2 : Circle}
                label="Ran the algorithm"
                value={ran ? 'Yes' : 'Not yet'}
                tone={ran ? 'good' : 'muted'}
              />
              <SignalRow icon={evalSig.icon} label="Evaluated" value={evalSig.value} tone={evalSig.tone} />
            </div>
          )
        })()}
      </PreviewOverlay>
    </div>
  )
}
