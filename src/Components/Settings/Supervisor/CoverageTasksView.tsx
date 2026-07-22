import { useMemo, useState, useCallback } from 'react'
import { ChevronRight, Lock } from 'lucide-react'
import { isTaskTestable } from '../../../Data/TrainingData'
import { skillLevelLabels } from '../../../Data/TrainingConstants'
import { formatMedicName, getLatestTestByTask } from './supervisorHelpers'
import { FillBar } from '@/Components/primitives/FillBar'
import { ActionSheet } from '@/Components/primitives/ActionSheet'
import type { ActionSheetOption } from '@/Components/primitives/ActionSheet'
import type { FlatTask } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { TrainingCompletionUI } from '../../../lib/trainingService'

type CoverageView =
  | { step: 'task-list' }
  | { step: 'soldier-list'; task: FlatTask }

type CompetencyStatus = 'GO' | 'NO_GO' | 'UNTESTED'

const statusConfig: Record<CompetencyStatus, { label: string; className: string }> = {
  GO: { label: 'GO', className: 'bg-themegreen/10 text-themegreen' },
  NO_GO: { label: 'NO GO', className: 'bg-themeredred/10 text-themeredred' },
  UNTESTED: { label: 'Untested', className: 'bg-tertiary/5 text-tertiary' },
}

interface CoverageTasksViewProps {
  areaName: string
  tasks: FlatTask[]
  medics: ClinicMedic[]
  testsForSoldier: (userId: string) => TrainingCompletionUI[]
  onEvaluate: (soldier: ClinicMedic, taskId: string, taskTitle: string) => void
  onAssign: (soldier: ClinicMedic, taskId: string, taskTitle: string) => void
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
  preSelectedSoldier,
}: CoverageTasksViewProps) {
  const [view, setView] = useState<CoverageView>({ step: 'task-list' })
  // Action sheet state: soldier + task to act on
  const [sheetSoldier, setSheetSoldier] = useState<ClinicMedic | null>(null)
  const [sheetTask, setSheetTask] = useState<FlatTask | null>(null)

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

  /** For each task, compute how many soldiers passed. Fold each medic's latest
   *  test-by-task ONCE, then read every task out of it — not O(tasks × medics)
   *  re-folds. */
  const taskCoverage = useMemo(() => {
    const medicLatest = medics.map(m => getLatestTestByTask(testsForSoldier(m.id)))
    const coverage = new Map<string, { passed: number; total: number }>()
    for (const task of tasks) {
      let passed = 0
      for (const latestByTask of medicLatest) {
        if (latestByTask.get(task.taskId)?.result === 'GO') passed++
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

  // ── Soldier list view (coverage flow: area → task → soldiers) ─────────────

  if (view.step === 'soldier-list') {
    const { task } = view
    const testable = isTaskTestable(task.taskId)
    const cov = taskCoverage.get(task.taskId)

    return (
      <div>
        <div className="mb-4">
          <p className="text-sm font-medium text-primary">{task.title}</p>
          <p className="text-[9pt] text-tertiary font-mono">{task.taskId}</p>
          {cov && (
            <FillBar
              className="mt-2"
              percent={cov.total > 0 ? Math.round((cov.passed / cov.total) * 100) : 0}
              value={`${cov.passed}/${cov.total}`}
            />
          )}
        </div>

        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
          Personnel
        </p>
        <div className="rounded-2xl bg-themewhite2 overflow-hidden">
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
                <span className={`text-[9pt] font-semibold px-2 py-0.5 rounded-full ${cfg.className}`}>
                  {cfg.label}
                </span>
                {testable && (
                  <ChevronRight size={16} className="text-tertiary shrink-0" />
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
        <p className="text-[10pt] text-tertiary mb-3">
          Select a task for <span className="font-medium text-primary">{formatMedicName(preSelectedSoldier)}</span>:
        </p>

        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
          {areaName} <span className="font-normal text-tertiary">({tasks.length})</span>
        </p>
        <div className="rounded-2xl bg-themewhite2 overflow-hidden">
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
                  <p className="text-[9pt] text-tertiary font-mono">
                    {task.taskId}
                  </p>
                  {!testable && (
                    <p className="text-[9pt] text-tertiary flex items-center gap-1 mt-0.5">
                      <Lock size={9} /> Not testable
                    </p>
                  )}
                </div>
                <div className="shrink-0 ml-2 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[9pt] font-semibold bg-themeblue3/10 text-tertiary">
                    {badge}
                  </span>
                  {testable && (
                    <ChevronRight size={16} className="text-tertiary" />
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
    <div>
      <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
        {areaName}
      </p>
      <div className="rounded-2xl bg-themewhite2 overflow-hidden">
        {tasks.map((task) => {
          const testable = isTaskTestable(task.taskId)
          const badge = skillLevelLabels[task.levelName] ?? task.levelName
          const cov = taskCoverage.get(task.taskId)
          const pct = coveragePercent(task.taskId)

          return (
            <button
              key={task.taskId}
              onClick={() => testable && setView({ step: 'soldier-list', task })}
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
                  <p className="text-[9pt] text-tertiary font-mono shrink-0">
                    {task.taskId}
                  </p>
                  {!testable && (
                    <p className="text-[9pt] text-tertiary flex items-center gap-1">
                      <Lock size={9} /> Not testable
                    </p>
                  )}
                </div>
                {testable && cov && (
                  <FillBar className="mt-1.5" percent={pct} value={`${cov.passed}/${cov.total}`} />
                )}
              </div>
              <div className="shrink-0 ml-2 flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[9pt] font-semibold bg-themewhite2 text-tertiary">
                  {badge}
                </span>
                {testable && (
                  <ChevronRight size={16} className="text-tertiary" />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
