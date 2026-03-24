import { useMemo, useState, useCallback } from 'react'
import { ChevronRight, Lock } from 'lucide-react'
import { isTaskTestable } from '../../../Data/TrainingData'
import { skillLevelLabels } from '../../../Data/TrainingConstants'
import { formatMedicName, getLatestTestByTask } from './supervisorHelpers'
import { ActionSheet } from '../../ActionSheet'
import type { ActionSheetOption } from '../../ActionSheet'
import type { FlatTask } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { TrainingCompletionUI } from '../../../lib/trainingService'

type CoverageView =
  | { step: 'task-list' }
  | { step: 'soldier-list'; task: FlatTask }

function readinessColor(pct: number): string {
  if (pct >= 80) return 'bg-themegreen'
  if (pct >= 50) return 'bg-themeyellow'
  return 'bg-themeredred'
}

function readinessTextColor(pct: number): string {
  if (pct >= 80) return 'text-themegreen'
  if (pct >= 50) return 'text-themeyellow'
  return 'text-themeredred'
}

type CompetencyStatus = 'GO' | 'NO_GO' | 'UNTESTED'

const statusConfig: Record<CompetencyStatus, { label: string; className: string }> = {
  GO: { label: 'GO', className: 'bg-themegreen/10 text-themegreen' },
  NO_GO: { label: 'NO GO', className: 'bg-themeredred/10 text-themeredred' },
  UNTESTED: { label: 'Untested', className: 'bg-tertiary/5 text-tertiary/50' },
}

interface CoverageTasksViewProps {
  areaName: string
  tasks: FlatTask[]
  medics: ClinicMedic[]
  testsForSoldier: (userId: string) => TrainingCompletionUI[]
  onEvaluate: (soldier: ClinicMedic, taskId: string, taskTitle: string) => void
  onAssign: (soldier: ClinicMedic, taskId: string, taskTitle: string) => void
  onBack: () => void
  /** Called when internal navigation changes so parent can update header */
  onViewChange?: (view: 'task-list' | 'soldier-list', taskTitle?: string) => void
  /** When set, tapping a task shows the action sheet for this soldier directly instead of navigating to the soldier list */
  preSelectedSoldier?: ClinicMedic
}

export function CoverageTasksView({
  areaName,
  tasks,
  medics,
  testsForSoldier,
  onEvaluate,
  onAssign,
  onBack,
  onViewChange,
  preSelectedSoldier,
}: CoverageTasksViewProps) {
  const [view, setView] = useState<CoverageView>({ step: 'task-list' })
  // Action sheet state: soldier + task to act on
  const [sheetSoldier, setSheetSoldier] = useState<ClinicMedic | null>(null)
  const [sheetTask, setSheetTask] = useState<FlatTask | null>(null)

  const navigateTo = useCallback((next: CoverageView) => {
    setView(next)
    if (next.step === 'task-list') {
      onViewChange?.('task-list')
    } else {
      onViewChange?.('soldier-list', next.task.title)
    }
  }, [onViewChange])

  const openSheet = useCallback((soldier: ClinicMedic, task: FlatTask) => {
    setSheetSoldier(soldier)
    setSheetTask(task)
  }, [])

  const closeSheet = useCallback(() => {
    setSheetSoldier(null)
    setSheetTask(null)
  }, [])

  const sheetOptions = useMemo<ActionSheetOption[]>(() => {
    if (!sheetSoldier || !sheetTask) return []
    return [
      {
        key: 'evaluate',
        label: 'Evaluate',
        onAction: () => onEvaluate(sheetSoldier, sheetTask.taskId, sheetTask.title),
      },
      {
        key: 'assign',
        label: 'Assign Task',
        onAction: () => onAssign(sheetSoldier, sheetTask.taskId, sheetTask.title),
      },
    ]
  }, [sheetSoldier, sheetTask, onEvaluate, onAssign])

  const sheetTitle = sheetSoldier && sheetTask
    ? `${formatMedicName(sheetSoldier)} · ${sheetTask.title}`
    : ''

  /** For each task, compute how many soldiers passed */
  const taskCoverage = useMemo(() => {
    const coverage = new Map<string, { passed: number; total: number }>()
    for (const task of tasks) {
      let passed = 0
      for (const medic of medics) {
        const soldierTests = testsForSoldier(medic.id)
        const latestByTask = getLatestTestByTask(soldierTests)
        const latest = latestByTask.get(task.taskId)
        if (latest?.result === 'GO') passed++
      }
      coverage.set(task.taskId, { passed, total: medics.length })
    }
    return coverage
  }, [tasks, medics, testsForSoldier])

  /** For the selected task, compute each soldier's status */
  const soldierStatuses = useMemo(() => {
    if (view.step !== 'soldier-list') return []
    const taskId = view.task.taskId
    return medics.map(medic => {
      const soldierTests = testsForSoldier(medic.id)
      const latestByTask = getLatestTestByTask(soldierTests)
      const latest = latestByTask.get(taskId)
      let status: CompetencyStatus = 'UNTESTED'
      if (latest) {
        status = latest.result === 'GO' ? 'GO' : 'NO_GO'
      }
      return { soldier: medic, status }
    }).sort((a, b) => {
      // Sort: NO_GO first, then UNTESTED, then GO
      const order: Record<CompetencyStatus, number> = { NO_GO: 0, UNTESTED: 1, GO: 2 }
      return order[a.status] - order[b.status]
    })
  }, [view, medics, testsForSoldier])

  const handleBack = useCallback(() => {
    if (view.step === 'soldier-list') {
      navigateTo({ step: 'task-list' })
    } else {
      onBack()
    }
  }, [view, navigateTo, onBack])

  // ── Soldier list view (coverage flow: area → task → soldiers) ─────────────

  if (view.step === 'soldier-list') {
    const { task } = view
    const testable = isTaskTestable(task.taskId)
    const cov = taskCoverage.get(task.taskId)

    return (
      <div>
        <div className="mb-4">
          <p className="text-sm font-medium text-primary">{task.title}</p>
          <p className="text-[8pt] text-tertiary/50 font-mono">{task.taskId}</p>
          {cov && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
                <div
                  className={`h-full rounded-full ${readinessColor(cov.total > 0 ? Math.round((cov.passed / cov.total) * 100) : 0)}`}
                  style={{ width: `${cov.total > 0 ? (cov.passed / cov.total) * 100 : 0}%` }}
                />
              </div>
              <span className={`text-[9pt] font-medium ${readinessTextColor(cov.total > 0 ? Math.round((cov.passed / cov.total) * 100) : 0)}`}>
                {cov.passed}/{cov.total}
              </span>
            </div>
          )}
        </div>

        <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">
          Personnel
        </p>
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          {soldierStatuses.map(({ soldier, status }) => {
            const cfg = statusConfig[status]
            return (
              <button
                key={soldier.id}
                onClick={() => testable && openSheet(soldier, task)}
                disabled={!testable}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all
                  ${testable ? 'hover:bg-themeblue2/5 active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
              >
                <span className="text-sm text-primary min-w-0 truncate flex-1">
                  {formatMedicName(soldier)}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.className}`}>
                  {cfg.label}
                </span>
                {testable && (
                  <ChevronRight size={16} className="text-tertiary/30 shrink-0" />
                )}
              </button>
            )
          })}
        </div>

        <ActionSheet
          visible={!!sheetSoldier}
          title={sheetTitle}
          options={sheetOptions}
          onClose={closeSheet}
        />
      </div>
    )
  }

  // ── Pre-selected soldier: SelectTaskStep-style list (no coverage bars) ────

  if (preSelectedSoldier) {
    return (
      <div>
        <p className="text-xs text-tertiary/60 mb-3">
          Select a task for <span className="font-medium text-primary">{formatMedicName(preSelectedSoldier)}</span>:
        </p>

        <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">
          {areaName} <span className="font-normal text-tertiary/50">({tasks.length})</span>
        </p>
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          {tasks.map((task, index) => {
            const testable = isTaskTestable(task.taskId)
            const badge = skillLevelLabels[task.levelName] ?? task.levelName

            return (
              <button
                key={task.taskId}
                onClick={() => testable && openSheet(preSelectedSoldier, task)}
                disabled={!testable}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all
                  ${index > 0 ? 'border-t border-themeblue3/10' : ''}
                  ${testable
                    ? 'hover:bg-themeblue2/5 active:scale-95 cursor-pointer'
                    : 'opacity-40 cursor-not-allowed'
                  }`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${testable ? 'text-primary' : 'text-tertiary'}`}>
                    {task.title}
                  </p>
                  <p className="text-[8pt] text-tertiary/50 font-mono">
                    {task.taskId}
                  </p>
                  {!testable && (
                    <p className="text-[8pt] text-tertiary/40 flex items-center gap-1 mt-0.5">
                      <Lock size={9} /> Not testable
                    </p>
                  )}
                </div>
                <div className="shrink-0 ml-2 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[8pt] font-semibold bg-themeblue3/10 text-tertiary/60">
                    {badge}
                  </span>
                  {testable && (
                    <ChevronRight size={16} className="text-tertiary/30" />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <ActionSheet
          visible={!!sheetSoldier}
          title={sheetTitle}
          options={sheetOptions}
          onClose={closeSheet}
        />
      </div>
    )
  }

  // ── Default: coverage task list (area → tasks with progress bars) ─────────

  const coveragePercent = (taskId: string) => {
    const cov = taskCoverage.get(taskId)
    if (!cov || cov.total === 0) return 0
    return Math.round((cov.passed / cov.total) * 100)
  }

  return (
    <div data-tour="supervisor-task-list">
      <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">
        {areaName}
      </p>
      <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
        {tasks.map((task) => {
          const testable = isTaskTestable(task.taskId)
          const badge = skillLevelLabels[task.levelName] ?? task.levelName
          const cov = taskCoverage.get(task.taskId)
          const pct = coveragePercent(task.taskId)

          return (
            <button
              key={task.taskId}
              onClick={() => testable && navigateTo({ step: 'soldier-list', task })}
              disabled={!testable}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all
                ${testable
                  ? 'hover:bg-themeblue2/5 active:scale-95 cursor-pointer'
                  : 'opacity-40 cursor-not-allowed'
                }`}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${testable ? 'text-primary' : 'text-tertiary'}`}>
                  {task.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[8pt] text-tertiary/50 font-mono shrink-0">
                    {task.taskId}
                  </p>
                  {!testable && (
                    <p className="text-[8pt] text-tertiary/40 flex items-center gap-1">
                      <Lock size={9} /> Not testable
                    </p>
                  )}
                </div>
                {testable && cov && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${readinessColor(pct)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-[9pt] font-medium ${readinessTextColor(pct)}`}>
                      {cov.passed}/{cov.total}
                    </span>
                  </div>
                )}
              </div>
              <div className="shrink-0 ml-2 flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[8pt] font-semibold bg-themewhite2 text-tertiary/60">
                  {badge}
                </span>
                {testable && (
                  <ChevronRight size={16} className="text-tertiary/30" />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
