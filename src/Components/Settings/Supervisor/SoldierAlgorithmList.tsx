import { useMemo, useState } from 'react'
import { ChevronRight, ClipboardCheck, CalendarPlus } from 'lucide-react'
import { listAlgorithmsWithStp } from '../../../Utilities/algorithmStp'
import { ActionButton } from '../../ActionButton'
import { ActionPill } from '../../ActionPill'
import { PreviewOverlay } from '../../PreviewOverlay'
import type { AlgorithmCompetency } from './supervisorHelpers'

function readinessColor(pct: number): string {
  return pct >= 50 ? 'bg-themeblue3/50' : 'bg-themeredred'
}

function readinessTextColor(pct: number): string {
  return pct >= 50 ? 'text-themeblue3' : 'text-themeredred'
}

interface SoldierAlgorithmListProps {
  /** This soldier's per-algorithm composite competency (sorted; we regroup). */
  competency: AlgorithmCompetency[]
  /** Evaluate a whole algorithm — cascades through its STPs + synthetic dims. */
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
                    <div className="h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${readinessColor(a.pct)}`} style={{ width: `${a.pct}%` }} />
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

      {/* Algorithm competency drill-down — per-dimension breakdown + evaluate/schedule */}
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
        {detail && (
          <div className="space-y-3 py-1">
            {detail.comp.dims.map((d) => {
              const dimPct = d.total ? Math.round((d.validated / d.total) * 100) : 0
              return (
                <div key={d.dim} className="flex items-center gap-3">
                  <span className="text-sm text-primary w-28 shrink-0 truncate">{d.label}</span>
                  <div className="flex-1 min-w-0">
                    <div className="h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
                      <div className={`h-full rounded-full ${readinessColor(dimPct)}`} style={{ width: `${dimPct}%` }} />
                    </div>
                  </div>
                  <span className={`text-[9pt] font-medium w-10 text-right shrink-0 ${d.met ? 'text-themegreen' : readinessTextColor(dimPct)}`}>
                    {d.validated}/{d.total}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </PreviewOverlay>
    </div>
  )
}
