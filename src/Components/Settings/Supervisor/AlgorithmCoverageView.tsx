import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { formatMedicName, buildAlgorithmCompetency, readinessBarColor } from './supervisorHelpers'
import { FillBar } from '@/Components/primitives/FillBar'
import { ActionSheet } from '@/Components/primitives/ActionSheet'
import type { ActionSheetOption } from '@/Components/primitives/ActionSheet'
import type { AlgorithmCompetencyLevel } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { TrainingCompletionUI } from '../../../lib/trainingService'

const statusConfig: Record<AlgorithmCompetencyLevel, { label: string; className: string }> = {
  trained: { label: 'Trained', className: 'bg-themegreen/10 text-themegreen' },
  partial: { label: 'Partial', className: 'bg-themeyellow/15 text-themeyellow' },
  untrained: { label: 'Untrained', className: 'bg-tertiary/5 text-tertiary' },
}

interface AlgorithmCoverageViewProps {
  algorithmId: string
  algorithmName: string
  medics: ClinicMedic[]
  testsForSoldier: (userId: string) => TrainingCompletionUI[]
  onEvaluate: (soldier: ClinicMedic, algorithmId: string, algorithmName: string) => void
  onSchedule: (soldier: ClinicMedic, algorithmId: string, algorithmName: string) => void
}

/**
 * Team-level drill-down for one algorithm: each soldier's composite competency
 * (STP + algorithm run), worst-first. Tapping a soldier offers Evaluate
 * (cascades to STPs) or Schedule. The algorithm peer of CoverageTasksView's
 * soldier-list, reached from the Coverage Gaps "Algorithm Coverage" subsection.
 */
export function AlgorithmCoverageView({
  algorithmId,
  algorithmName,
  medics,
  testsForSoldier,
  onEvaluate,
  onSchedule,
}: AlgorithmCoverageViewProps) {
  const [sheetSoldier, setSheetSoldier] = useState<ClinicMedic | null>(null)

  const soldierStatuses = useMemo(() => {
    return medics.map(medic => {
      const comp = buildAlgorithmCompetency(testsForSoldier(medic.id)).find(c => c.id === algorithmId)
      return {
        soldier: medic,
        pct: comp?.pct ?? 0,
        status: (comp?.status ?? 'untrained') as AlgorithmCompetencyLevel,
      }
    }).sort((a, b) => {
      const order: Record<AlgorithmCompetencyLevel, number> = { untrained: 0, partial: 1, trained: 2 }
      return order[a.status] - order[b.status] || a.pct - b.pct
    })
  }, [medics, testsForSoldier, algorithmId])

  const teamPct = useMemo(() => {
    if (soldierStatuses.length === 0) return 0
    return Math.round(soldierStatuses.reduce((s, e) => s + e.pct, 0) / soldierStatuses.length)
  }, [soldierStatuses])

  const sheetOptions = useMemo<ActionSheetOption[]>(() => {
    if (!sheetSoldier) return []
    return [
      { key: 'evaluate', label: 'Evaluate', onAction: () => onEvaluate(sheetSoldier, algorithmId, algorithmName) },
      { key: 'schedule', label: 'Schedule Training', onAction: () => onSchedule(sheetSoldier, algorithmId, algorithmName) },
    ]
  }, [sheetSoldier, algorithmId, algorithmName, onEvaluate, onSchedule])

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm font-medium text-primary">{algorithmName}</p>
        <p className="text-[9pt] text-tertiary font-mono">{algorithmId}</p>
        <FillBar className="mt-2" percent={teamPct} />
      </div>

      <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
        Personnel
      </p>
      <div className="rounded-2xl bg-themewhite2 overflow-hidden">
        {soldierStatuses.map(({ soldier, pct, status }) => {
          const cfg = statusConfig[status]
          return (
            <button
              key={soldier.id}
              onClick={() => setSheetSoldier(soldier)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-themeblue2/5 active:scale-95"
            >
              <span className="text-sm text-primary min-w-0 truncate shrink-0 w-36">
                {formatMedicName(soldier)}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="h-1.5 rounded-full bg-tertiary/10 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className={`h-full rounded-full transition-all ${readinessBarColor(pct)}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <span className={`text-[9pt] font-semibold px-2 py-0.5 rounded-full shrink-0 ${cfg.className}`}>
                {cfg.label}
              </span>
              <ChevronRight size={16} className="text-tertiary shrink-0" />
            </button>
          )
        })}
      </div>

      <ActionSheet
        visible={!!sheetSoldier}
        title={sheetSoldier ? `${formatMedicName(sheetSoldier)} · ${algorithmName}` : ''}
        options={sheetOptions}
        onClose={() => setSheetSoldier(null)}
      />
    </div>
  )
}
