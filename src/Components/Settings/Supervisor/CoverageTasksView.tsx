import { useEffect, useMemo, useState, useCallback } from 'react'
import { ChevronRight, Lock } from 'lucide-react'
import { isIctlTaskTestable } from '../../../Utilities/ictlEvaluation'
import { ictlAdtmcAlgorithms } from '../../../Utilities/ictlAdtmc'
import { getAlgorithmStpTasks } from '../../../Utilities/algorithmStp'
import {
  formatMedicName,
  getLatestTestByTask,
  buildAlgorithmCompetency,
  resolveIctlStatus,
  collectTaskRecords,
  algorithmRecordIds,
  type TaskRecord,
} from './supervisorHelpers'
import { TaskRecords } from './TaskRecords'
import { FillBar } from '@/Components/primitives/FillBar'
import { ActionSheet } from '@/Components/primitives/ActionSheet'
import type { ActionSheetOption } from '@/Components/primitives/ActionSheet'
import type { FlatTask } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { TrainingCompletionUI } from '../../../lib/trainingService'
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'
import { AlgorithmComponentChart } from './AlgorithmComponentChart'

/**
 * What this view is pointed at inside its area. HOISTED — the host owns it, so a
 * drill is an entry on the host's own stack and its back button walks the chain
 * one step at a time. Held here it was invisible to that button, and backing out
 * of a task dropped the whole category.
 *
 * An algorithm is a screen in its own right: it is a prerequisite like a task, and
 * it opens the same way — the rows just read differently, because what is on
 * record for an algorithm is three components rather than one grade.
 */
export type CoverageSelection =
  | { kind: 'ictl'; task: FlatTask }
  | { kind: 'algorithm'; algorithmId: string; algorithmName: string }

type CompetencyStatus = 'GO' | 'NO_GO' | 'UNTESTED'

/** Untested is absent on purpose — it is the default state, and a badge for it
 *  labels most of the roster with the fact that nothing has happened. */
const statusConfig: Partial<Record<CompetencyStatus, { label: string; className: string }>> = {
  GO: { label: 'GO', className: 'bg-themegreen/10 text-themegreen' },
  NO_GO: { label: 'NO GO', className: 'bg-themeredred/10 text-themeredred' },
}

interface CoverageTasksViewProps {
  tasks: FlatTask[]
  medics: ClinicMedic[]
  testsForSoldier: (userId: string) => TrainingCompletionUI[]
  /** Logged runs per algorithm for one soldier. Required for the ADTMC criteria —
   *  an algorithm's completion needs its run count, so without this every ICTL
   *  falls back to grading on its measures alone. */
  runCountsForSoldier: (userId: string) => Map<string, number>
  /** Open the GO/NO-GO evaluator. OPTIONAL because the evaluator is a terminal
   *  and terminals live in the host's pane — a host that has not rebuilt its
   *  pane yet omits this, and the sheet offers what it can actually do rather
   *  than a row that goes nowhere. */
  onEvaluate?: (soldier: ClinicMedic, taskId: string, taskTitle: string) => void
  /** Open the algorithm CASCADE for one soldier — a different act from grading a
   *  task, because it walks every evaluable unit under the algorithm rather than
   *  one task's measures. Optional on the same terms as onEvaluate. */
  onEvaluateAlgorithm?: (soldier: ClinicMedic, algorithmId: string, algorithmName: string) => void
  /** Schedule an algorithm. Separate from onAssign because an algorithm rides
   *  `encounterAlgorithmId` rather than the training roster's item id. */
  onScheduleAlgorithm?: (soldier: ClinicMedic, algorithmId: string, algorithmName: string) => void
  onAssign: (soldier: ClinicMedic, taskId: string, taskTitle: string) => void
  /** When set, tapping a task shows the action sheet for this soldier directly instead of navigating to the soldier list */
  preSelectedSoldier?: ClinicMedic
  /** Announces the ICTL currently open, so the host's subject card can carry its
   *  coverage in place of the subject's readiness and compliance bars. Null on
   *  the way out — the task list has no single stat to lift, and a card left
   *  holding the last one you looked at would be lying. Which task is open is
   *  local state here, so this is the only way the host can know. */
  onOpenIctl?: (stat: { title: string; label: string; percent: number; value: string } | null) => void
  /** The drill within this area, or null for the task list. Owned by the host —
   *  see CoverageSelection. */
  selection?: CoverageSelection | null
  /** Push a drill onto the host's stack. */
  onSelect?: (selection: CoverageSelection) => void
  /** EVERY completion for a soldier — reads, grades and assignments alike, not
   *  just the tests the coverage bars fold. This is what the Records list is a
   *  list of, and the roster accessors above deliberately do not carry it: a bar
   *  wants the latest verdict, a record list wants the rows behind it. */
  completionsForSoldier?: (userId: string) => TrainingCompletionUI[]
  /** Open one record's terminal. Optional on the same terms as onEvaluate — a
   *  terminal lives in the host's pane, so a host without one gets no list
   *  rather than rows that go nowhere. */
  onOpenRecord?: (record: TaskRecord) => void
}

export function CoverageTasksView({
  tasks,
  medics,
  testsForSoldier,
  runCountsForSoldier,
  onEvaluate,
  onEvaluateAlgorithm,
  onScheduleAlgorithm,
  onAssign,
  preSelectedSoldier,
  onOpenIctl,
  selection = null,
  onSelect,
  completionsForSoldier,
  onOpenRecord,
}: CoverageTasksViewProps) {
  // Action sheet state: soldier + task to act on
  const [sheetSoldier, setSheetSoldier] = useState<ClinicMedic | null>(null)
  const [sheetTask, setSheetTask] = useState<FlatTask | null>(null)
  // Its algorithm counterpart. A separate sheet rather than a widened one: the
  // algorithm the row belongs to is already in `selection`, so the only thing
  // this has to carry is the name — and the two sheets offer different verbs.
  const [algoSheetSoldier, setAlgoSheetSoldier] = useState<ClinicMedic | null>(null)

  // No export pill here. The FAB on the drawer's island is the one export
  // surface and it already follows the rail's subject, so a per-category pull
  // was a second entry point to the same overlay with a narrower scope.

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
      ...(onEvaluate ? [{
        key: 'evaluate',
        label: 'Evaluate',
        onAction: () => onEvaluate(sheetSoldier, sheetTask.taskId, sheetTask.title),
      }] : []),
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

  /** Evaluate here is the CASCADE — it walks the algorithm's red flags,
   *  differentials, run and every mapped STP in one sitting, which is why the
   *  verb is the same word doing considerably more work than on a task row. */
  const algoSheetOptions = useMemo<ActionSheetOption[]>(() => {
    if (!algoSheetSoldier || selection?.kind !== 'algorithm') return []
    const { algorithmId, algorithmName } = selection
    return [
      ...(onEvaluateAlgorithm ? [{
        key: 'evaluate',
        label: 'Evaluate',
        onAction: () => onEvaluateAlgorithm(algoSheetSoldier, algorithmId, algorithmName),
      }] : []),
      ...(onScheduleAlgorithm ? [{
        key: 'schedule',
        label: 'Schedule Training',
        onAction: () => onScheduleAlgorithm(algoSheetSoldier, algorithmId, algorithmName),
      }] : []),
    ]
  }, [algoSheetSoldier, selection, onEvaluateAlgorithm, onScheduleAlgorithm])

  /** Per medic: their latest test-by-task AND their full per-algorithm
   *  competency. Folded ONCE here and read by the task coverage bars, the soldier
   *  list and the algorithm roster — the alternative re-derives an algorithm
   *  competency per task per medic, which is the same fold run dozens of times.
   *
   *  The whole competency row is kept, not just which ids came back trained: the
   *  algorithm roster shows the three components behind that verdict, and they
   *  are only in the row. */
  const medicState = useMemo(() => {
    return medics.map(m => {
      const own = testsForSoldier(m.id)
      const algorithms = buildAlgorithmCompetency(own, runCountsForSoldier(m.id))
      return {
        medic: m,
        latestByTask: getLatestTestByTask(own),
        algorithmById: new Map(algorithms.map(a => [a.id, a])),
        trainedAlgorithmIds: new Set(
          algorithms.filter(a => a.status === 'trained').map(a => a.id),
        ),
      }
    })
  }, [medics, testsForSoldier, runCountsForSoldier])

  /** Shares buildSoldierCompetency's definition rather than restating it — the
   *  roster bar and this personnel list must not be able to disagree. */
  const statusFor = useCallback(
    (state: (typeof medicState)[number], taskId: string) =>
      resolveIctlStatus(taskId, state.latestByTask, state.trainedAlgorithmIds),
    [],
  )

  /** For each task, how many soldiers hold it — by either route. */
  const taskCoverage = useMemo(() => {
    const coverage = new Map<string, { passed: number; total: number }>()
    for (const task of tasks) {
      let passed = 0
      for (const state of medicState) {
        if (statusFor(state, task.taskId).status === 'GO') passed++
      }
      coverage.set(task.taskId, { passed, total: medics.length })
    }
    return coverage
  }, [tasks, medicState, medics.length, statusFor])

  /** For the selected task, each soldier's status plus their ADTMC step count. */
  const soldierStatuses = useMemo(() => {
    if (selection?.kind !== 'ictl') return []
    const taskId = selection.task.taskId
    return medicState
      .map(state => ({ soldier: state.medic, ...statusFor(state, taskId) }))
      .sort((a, b) => {
        // Sort: NO_GO first, then UNTESTED, then GO
        const order: Record<CompetencyStatus, number> = { NO_GO: 0, UNTESTED: 1, GO: 2 }
        return order[a.status] - order[b.status]
      })
  }, [selection, medicState, statusFor])

  /** For the selected ALGORITHM, each soldier's three components — the STP tasks
   *  they hold, how many times they have logged it against the target, and whether
   *  a supervisor has assessed them. Worst first, same as the task roster. */
  const algorithmStatuses = useMemo(() => {
    if (selection?.kind !== 'algorithm') return []
    const order: Record<string, number> = { untrained: 0, partial: 1, trained: 2 }
    return medicState
      .map(state => ({ soldier: state.medic, comp: state.algorithmById.get(selection.algorithmId) }))
      .sort((a, b) => (order[a.comp?.status ?? 'untrained'] - order[b.comp?.status ?? 'untrained']))
  }, [selection, medicState])

  /** The open algorithm's components for the ONE soldier this surface is scoped
   *  to — the matrix that replaces the roster there. */
  const soldierComponents = useMemo(() => {
    if (!preSelectedSoldier || selection?.kind !== 'algorithm') return []
    const state = medicState.find(s => s.medic.id === preSelectedSoldier.id)
    return state?.algorithmById.get(selection.algorithmId)?.components ?? []
  }, [preSelectedSoldier, selection, medicState])

  /**
   * The selected ICTL's prerequisites: each ADTMC algorithm followed by the STP
   * tasks under it. BOTH are prerequisites — the algorithm is a step of the ICTL
   * in its own right (running it is what the packet asks for), and the tasks are
   * what the algorithm is built out of. Listing only one of the two describes half
   * of what has to be cleared.
   *
   * Grouped rather than flattened, so a task that several algorithms cite appears
   * under each — it is a different obligation each time. Deduped WITHIN an
   * algorithm, where a repeat is just the same citation twice.
   *
   * Task coverage is graded-GO only, unlike an ICTL's. The ADTMC route is what
   * lets an ICTL pass without a grade, and these are the ADTMC — applying it here
   * would let a task count itself complete.
   */
  const prereqGroups = useMemo(() => {
    // Inside one algorithm the same list narrows to that algorithm alone, so the
    // roster you are reading always sits above the things it is made of.
    const algos: { id: string; name: string }[] =
      selection?.kind === 'ictl' ? ictlAdtmcAlgorithms(selection.task.taskId)
      : selection?.kind === 'algorithm' ? [{ id: selection.algorithmId, name: selection.algorithmName }]
      : []
    return algos.map(algo => {
      const seen = new Map<string, { taskId: string; title: string }>()
      for (const node of getAlgorithmStpTasks(algo.id)) {
        if (!node.icon || seen.has(node.icon)) continue
        seen.set(node.icon, { taskId: node.icon, title: node.text ?? '' })
      }
      return {
        id: algo.id,
        name: algo.name,
        trainedCount: medicState.filter(s => s.trainedAlgorithmIds.has(algo.id)).length,
        tasks: [...seen.values()].map(t => ({
          ...t,
          passed: medicState.filter(s => s.latestByTask.get(t.taskId)?.result === 'GO').length,
        })),
      }
    })
  }, [selection, medicState])

  // The open ICTL's coverage, lifted to the host's card. Labelled by task NUMBER,
  // not title: the number identifies a packet and fits a bar's label, while the
  // title is a sentence that would truncate to nothing at a rail's width.
  //
  // Reported on PRIMITIVES, deliberately. taskCoverage is rebuilt on every render
  // of this component, so an effect keyed on the derived object would fire, set
  // the host's state, re-render, and fire again — forever.
  const openId =
    selection?.kind === 'ictl' ? selection.task.taskId
    : selection?.kind === 'algorithm' ? selection.algorithmId
    : null
  const openTitle =
    selection?.kind === 'ictl' ? selection.task.title
    : selection?.kind === 'algorithm' ? selection.algorithmName
    : ''
  // Three sources, one number. An area ICTL has precomputed coverage; a
  // prerequisite task is not on that roster, so it is counted on the graded record
  // alone (the rule its rows use); an algorithm counts as held only when every
  // component is met, which is what `trained` already means. Without the last two
  // the card would drop back to readiness and compliance the moment you opened one.
  const openPassed = useMemo(() => {
    if (selection?.kind === 'algorithm') {
      const algorithmId = selection.algorithmId
      return medicState.filter(s => s.trainedAlgorithmIds.has(algorithmId)).length
    }
    if (selection?.kind !== 'ictl') return -1
    const taskId = selection.task.taskId
    return taskCoverage.get(taskId)?.passed
      ?? medicState.filter(s => s.latestByTask.get(taskId)?.result === 'GO').length
  }, [selection, taskCoverage, medicState])
  const openTotal = openId ? medics.length : -1

  useEffect(() => {
    if (!openId || openPassed < 0) {
      onOpenIctl?.(null)
      return
    }
    onOpenIctl?.({
      title: openTitle,
      label: openId,
      percent: openTotal > 0 ? Math.round((openPassed / openTotal) * 100) : 0,
      value: `${openPassed}/${openTotal}`,
    })
    // Backing out of the drill, or leaving the surface entirely, takes the stat
    // with it — see the prop's note on a card left holding a stale number.
    return () => onOpenIctl?.(null)
  }, [openId, openTitle, openPassed, openTotal, onOpenIctl])

  /**
   * The records behind the open drill — the reads, grades and assignments the
   * bars above are folded from.
   *
   * An ICTL asks for one training item; an ALGORITHM asks for several, because a
   * logged run files under the bare algorithm id while a supervisor's assessment
   * files under a synthetic dimension key. Asking for one there would show the
   * runs and hide the grades. Prerequisite STP tasks are deliberately NOT folded
   * in: each is its own drill with its own records, and pulling them up here
   * would list the same row under two headings.
   */
  const records = useMemo<TaskRecord[]>(() => {
    if (!completionsForSoldier || !selection) return []
    const itemIds = selection.kind === 'ictl'
      ? new Set([selection.task.taskId])
      : algorithmRecordIds(selection.algorithmId)
    return collectTaskRecords(medics, itemIds, completionsForSoldier)
  }, [completionsForSoldier, selection, medics])

  const renderRecords = () => {
    if (!onOpenRecord || !completionsForSoldier) return null
    return (
      <TaskRecords
        records={records}
        onOpen={onOpenRecord}
        hideSoldier={!!preSelectedSoldier}
        showItem={selection?.kind === 'algorithm'}
      />
    )
  }

  /**
   * The prerequisite block, shared by both rosters: the ICTL's algorithms with
   * their tasks, and inside one algorithm just that algorithm's tasks. Both rows
   * are selectable — an algorithm is a prerequisite in its own right, and its
   * roster is the only place the three components behind "trained" are readable.
   *
   * On an algorithm's own screen its heading row is dropped and the tasks stand
   * flat: A-1 listed as a prerequisite of A-1 is a row that goes where you already
   * are. The card above already names it and carries its bar.
   */
  const renderPrerequisites = () => {
    if (prereqGroups.length === 0) return null
    const onAlgorithm = selection?.kind === 'algorithm'
    // At soldier scope every count is out of one, and "1/1" is a fraction nobody
    // reads as a yes. Held or not held, said in words.
    const single = !!preSelectedSoldier
    return (
      <div className="mt-4">
        <SectionHeader>Prerequisite Tasks</SectionHeader>
        <SectionCard>
          {prereqGroups.map((group, gi) => (
            <div key={group.id}>
              {!onAlgorithm && (
                <button
                  onClick={() => onSelect?.({
                    kind: 'algorithm',
                    algorithmId: group.id,
                    algorithmName: group.name,
                  })}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left bg-tertiary/4
                    transition-all hover:bg-themeblue2/5 active:scale-95
                    ${gi > 0 ? 'border-t border-tertiary/8' : ''}`}
                >
                  <span className="text-[9pt] font-medium text-tertiary shrink-0 w-10">
                    {group.id}
                  </span>
                  <span className="text-[10pt] text-secondary min-w-0 truncate flex-1">
                    {group.name}
                  </span>
                  <span className={`text-[9pt] tabular-nums shrink-0 ${
                    single && group.trainedCount > 0 ? 'text-themegreen' : 'text-tertiary'
                  }`}>
                    {single
                      ? (group.trainedCount > 0 ? 'Trained' : 'Not trained')
                      : `${group.trainedCount}/${medics.length}`}
                  </span>
                  <ChevronRight size={16} className="text-tertiary shrink-0" />
                </button>
              )}

              {/* Its tasks — indented under the algorithm, flat without it. */}
              {group.tasks.map((prereq, ti) => (
                <button
                  key={prereq.taskId}
                  onClick={() => onSelect?.({
                    kind: 'ictl',
                    task: {
                      taskId: prereq.taskId,
                      title: prereq.title,
                      levelIdx: 0,
                      levelName: '',
                      areaName: group.id,
                    },
                  })}
                  className={`w-full flex items-center gap-3 pr-4 py-3 text-left transition-all
                    hover:bg-themeblue2/5 active:scale-95
                    ${onAlgorithm ? 'pl-4' : 'pl-12'}
                    ${onAlgorithm && ti === 0 ? '' : 'border-t border-tertiary/8'}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[10pt] text-primary truncate">{prereq.title}</p>
                    <p className="text-[9pt] text-tertiary font-mono whitespace-nowrap">
                      {prereq.taskId}
                    </p>
                  </div>
                  <span className={`text-[9pt] tabular-nums shrink-0 ${
                    single && prereq.passed > 0 ? 'text-themegreen' : 'text-tertiary'
                  }`}>
                    {single
                      ? (prereq.passed > 0 ? 'GO' : '—')
                      : `${prereq.passed}/${medics.length}`}
                  </span>
                  <ChevronRight size={16} className="text-tertiary shrink-0" />
                </button>
              ))}
            </div>
          ))}
        </SectionCard>
      </div>
    )
  }

  // ── Soldier list view (coverage flow: area → task → soldiers) ─────────────

  if (selection?.kind === 'ictl') {
    const { task } = selection
    const testable = isIctlTaskTestable(task.taskId)

    return (
      <div>
        {/* Straight into the roster. Title, number and bar are all on the card
            above — this surface's header — and the first list needs no label when
            it is names: the second one is titled, which is what tells them apart.
            Personnel leads because the question you open an ICTL with is who still
            owes it; the prerequisites answer what stands in their way, second.

            NOT at soldier scope: a roster of the one person the whole surface is
            already scoped to is a row that restates the card. Evaluate and Assign
            hang off it today and will move — see the drawer's FAB, which is the
            scope-aware action surface this list was standing in for. */}
        {!preSelectedSoldier && (
          <SectionCard>
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
                  {/* GO and NO GO only. Untested is the state EVERY name starts in,
                      so badging it puts a label on most of the roster that says
                      nothing has happened yet — which the absent badge already
                      says, and more quietly. */}
                  {cfg && (
                    <span className={`text-[9pt] font-semibold px-2 py-0.5 rounded-full ${cfg.className}`}>
                      {cfg.label}
                    </span>
                  )}
                  {testable && (
                    <ChevronRight size={16} className="text-tertiary shrink-0" />
                  )}
                </button>
              )
            })}
          </SectionCard>
        )}

        {/* Records sit directly under the roster because they are about the same
            people: the roster says who holds this task, the records say what was
            written to make that true and let it be corrected. Prerequisites are a
            different subject — what the task is made of — so they come after. */}
        {renderRecords()}

        {renderPrerequisites()}

        <ActionSheet
          visible={!!sheetSoldier}
          title={sheetTitle}
          options={sheetOptions}
          onClose={closeSheet}
        />
      </div>
    )
  }

  // ── Algorithm roster (a prerequisite opened in its own right) ─────────────

  // Three components per name rather than one badge, because an algorithm is held
  // three ways at once: the STP tasks under it, three logged runs, and a
  // supervisor's assessment. A single verdict here would hide WHICH of the three
  // is missing, which is the only thing that tells a supervisor what to schedule.
  if (selection?.kind === 'algorithm') {
    // A host with no handlers wired gets rows that keep their chevron and press
    // state to themselves rather than advertising an action that is not there —
    // the same reason onEvaluate is optional on the task side. Read off the
    // HANDLERS, not off algoSheetOptions: that memo stays empty until a row is
    // picked, so deriving from it would leave every row inert forever.
    const actionable = !!onEvaluateAlgorithm || !!onScheduleAlgorithm

    return (
      <div>
        {/* Soldier scope: the components as a chart, because the question is
            which of the three is short. The prerequisite TASKS are not repeated
            inside it — they are the list below, where they are also selectable,
            and the same tasks in two places on one screen reads as two different
            requirements. */}
        {preSelectedSoldier && soldierComponents.length > 0 && (
          <SectionCard>
            <AlgorithmComponentChart components={soldierComponents} />
          </SectionCard>
        )}

        {!preSelectedSoldier && (
          <SectionCard>
            {algorithmStatuses.map(({ soldier, comp }) => (
              <button
                key={soldier.id}
                onClick={() => actionable && setAlgoSheetSoldier(soldier)}
                disabled={!actionable}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-t border-tertiary/8 first:border-t-0
                  ${actionable ? 'transition-all hover:bg-themeblue2/5 active:scale-95' : ''}`}
              >
                <span className="text-sm text-primary min-w-0 truncate flex-1">
                  {formatMedicName(soldier)}
                </span>
                <span className="flex items-center gap-2 shrink-0 text-[9pt] tabular-nums">
                  {comp?.components.map(c => (
                    <span
                      key={c.kind}
                      className={c.met ? 'text-themegreen' : 'text-tertiary'}
                      title={c.label}
                    >
                      {/* Every component the same way — Logged 2/3, Assessed 0/7.
                          Assessed used to read as a word while its neighbours read
                          as fractions, which made a partly-graded walk look like a
                          different kind of fact than a partly-logged one. */}
                      {c.label} {c.validated}/{c.total}
                    </span>
                  ))}
                </span>
                {actionable && <ChevronRight size={16} className="text-tertiary shrink-0" />}
              </button>
            ))}
          </SectionCard>
        )}

        {renderRecords()}

        {renderPrerequisites()}

        <ActionSheet
          visible={!!algoSheetSoldier}
          title={algoSheetSoldier ? `${formatMedicName(algoSheetSoldier)} · ${selection.algorithmName}` : ''}
          options={algoSheetOptions}
          onClose={() => setAlgoSheetSoldier(null)}
        />
      </div>
    )
  }

  // ── Pre-selected soldier: the same list without the roster's coverage bars ───

  // No "select a task for X" line and no area heading: the card states the
  // soldier, the header states the category, and this list is what is left once
  // both are already said.
  //
  // A row DRILLS, it does not act. It used to open the action sheet directly,
  // which made a soldier the one scope with no way into an ICTL's prerequisites
  // or its algorithms — the whole chain was reachable from a cluster and dead from
  // a name. Evaluate and Assign are one tap further in, on the roster row, which
  // at this scope is that soldier alone.
  if (preSelectedSoldier) {
    return (
      <div>
        <SectionCard>
          {tasks.map((task, index) => {
            const testable = isIctlTaskTestable(task.taskId)

            return (
              <button
                key={task.taskId}
                onClick={() => testable && onSelect?.({ kind: 'ictl', task })}
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
                  <p className="text-[9pt] text-tertiary font-mono whitespace-nowrap">
                    {task.taskId}
                  </p>
                  {!testable && (
                    <p className="text-[9pt] text-tertiary flex items-center gap-1 mt-0.5">
                      <Lock size={9} /> Not testable
                    </p>
                  )}
                </div>
                <div className="shrink-0 ml-2 flex items-center">
                  {testable && (
                    <ChevronRight size={16} className="text-tertiary" />
                  )}
                </div>
              </button>
            )
          })}
        </SectionCard>
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
      <SectionCard>
        {tasks.map((task) => {
          const testable = isIctlTaskTestable(task.taskId)
          const cov = taskCoverage.get(task.taskId)
          const pct = coveragePercent(task.taskId)

          return (
            <button
              key={task.taskId}
              onClick={() => testable && onSelect?.({ kind: 'ictl', task })}
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
                {/* Number and bar share one line: the id is a fixed-width label
                    and the bar is the only thing on the row that varies, so a
                    line of its own bought height without buying a reading. */}
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[9pt] text-tertiary font-mono shrink-0 whitespace-nowrap">
                    {task.taskId}
                  </p>
                  {!testable && (
                    <p className="text-[9pt] text-tertiary flex items-center gap-1">
                      <Lock size={9} /> Not testable
                    </p>
                  )}
                  {testable && cov && (
                    <FillBar
                      className="flex-1 min-w-0"
                      percent={pct}
                      value={`${cov.passed}/${cov.total}`}
                    />
                  )}
                </div>
              </div>
              <div className="shrink-0 ml-2 flex items-center">
                {testable && (
                  <ChevronRight size={16} className="text-tertiary" />
                )}
              </div>
            </button>
          )
        })}
      </SectionCard>
    </div>
  )
}
