import { useState, useEffect, useMemo, useCallback, useRef, type MutableRefObject } from 'react'
import { ChevronRight, Check, X, Ban, AlertTriangle, Info, Clock, FileText, Users, Wind, Droplets, ShieldPlus, Stethoscope, Pill, Bone, Ambulance, BookOpen, Search, Lock } from 'lucide-react'
import { stp68wTraining } from '../../Data/TrainingTaskList'
import { getTaskData, isTaskTestable } from '../../Data/TrainingData'
import type { PerformanceStep } from '../../Data/TrainingData'
import type { StepResult, ClinicMedic } from '../../Types/SupervisorTestTypes'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useTrainingCompletions } from '../../Hooks/useTrainingCompletions'
import { fetchClinicTestHistory, type TrainingCompletionUI } from '../../lib/trainingService'
import { deleteCompletion as deleteCompletionApi } from '../../lib/trainingService'
import { supabase } from '../../lib/supabase'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMedicName(medic: ClinicMedic): string {
  const parts: string[] = []
  if (medic.rank) parts.push(medic.rank)
  if (medic.lastName) {
    let name = medic.lastName
    if (medic.firstName) name += ', ' + medic.firstName.charAt(0) + '.'
    if (medic.middleInitial) name += medic.middleInitial + '.'
    parts.push(name)
  }
  return parts.join(' ') || 'Unknown'
}

const subjectAreaIcons: Record<string, React.ReactNode> = {
  'Airway Management': <Wind size={14} />,
  'Fluid Management': <Droplets size={14} />,
  'Force Health Protection': <ShieldPlus size={14} />,
  'Medical Management': <Stethoscope size={14} />,
  'Medication Management': <Pill size={14} />,
  'Trauma Management': <Bone size={14} />,
  'Triage and Evacuation': <Ambulance size={14} />,
}

const skillLevelLabels: Record<string, string> = {
  'Readiness Requirements': 'RR',
  'Skill Level 1': 'SL1',
  'Skill Level 2': 'SL2',
  'Skill Level 3': 'SL3',
}

const categoryOrder = [
  'Airway Management',
  'Fluid Management',
  'Force Health Protection',
  'Medical Management',
  'Medication Management',
  'Trauma Management',
  'Triage and Evacuation',
]

interface FlatTask {
  taskId: string
  title: string
  levelIdx: number
  levelName: string
  areaName: string
}

function buildTestableTasksByCategory(): Map<string, FlatTask[]> {
  const seen = new Map<string, Set<string>>()
  const grouped = new Map<string, FlatTask[]>()

  for (const cat of categoryOrder) {
    grouped.set(cat, [])
    seen.set(cat, new Set())
  }

  stp68wTraining.forEach((level, levelIdx) => {
    level.subjectArea.forEach((area) => {
      if (!grouped.has(area.name)) {
        grouped.set(area.name, [])
        seen.set(area.name, new Set())
      }
      const seenSet = seen.get(area.name)!
      area.tasks.forEach((task) => {
        if (seenSet.has(task.id)) return
        seenSet.add(task.id)
        grouped.get(area.name)!.push({
          taskId: task.id,
          title: task.title,
          levelIdx,
          levelName: level.skillLevel,
          areaName: area.name,
        })
      })
    })
  })

  for (const tasks of grouped.values()) {
    tasks.sort((a, b) => a.levelIdx - b.levelIdx || a.title.localeCompare(b.title))
  }

  return grouped
}

// ─── Step Callout (reused pattern from TrainingPanel) ────────────────────────

function StepCallout({ type, text }: { type: 'warning' | 'caution' | 'note'; text: string }) {
  const styles = {
    warning: { bg: 'bg-themeyellow/10', border: 'border-themeyellow/30', icon: <AlertTriangle size={13} className="text-themeyellow shrink-0 mt-0.5" />, label: 'WARNING' },
    caution: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: <AlertTriangle size={13} className="text-orange-500 shrink-0 mt-0.5" />, label: 'CAUTION' },
    note: { bg: 'bg-themeblue2/10', border: 'border-themeblue2/30', icon: <Info size={13} className="text-themeblue2 shrink-0 mt-0.5" />, label: 'NOTE' },
  }
  const s = styles[type]
  return (
    <div className={`${s.bg} border ${s.border} rounded-md px-3 py-2 mt-1.5 flex items-start gap-2`}>
      {s.icon}
      <div>
        <p className="text-[7pt] font-bold tracking-wider opacity-60">{s.label}</p>
        <p className="text-xs text-primary/80">{text}</p>
      </div>
    </div>
  )
}

// ─── Step 1: Select Medic ────────────────────────────────────────────────────

function SelectMedicStep({
  onSelect,
}: {
  onSelect: (medic: ClinicMedic) => void
}) {
  const { medics, loading, error } = useClinicMedics()

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="text-tertiary/60">Loading medics...</div></div>
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Users size={48} className="mx-auto mb-4 text-tertiary/40" />
        <p className="text-sm text-tertiary/60">{error}</p>
      </div>
    )
  }

  if (medics.length === 0) {
    return (
      <div className="text-center py-12">
        <Users size={48} className="mx-auto mb-4 text-tertiary/40" />
        <p className="text-sm text-tertiary/60">No medics found in your clinic</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-tertiary/60 mb-3">Select the medic to evaluate:</p>
      {medics.map((medic) => (
        <button
          key={medic.id}
          onClick={() => onSelect(medic)}
          className="flex items-center w-full px-4 py-3 rounded-xl text-left
                     hover:bg-themewhite2 active:scale-[0.98] transition-all"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary">{formatMedicName(medic)}</p>
            {medic.credential && (
              <p className="text-[9pt] text-tertiary/50">{medic.credential}</p>
            )}
          </div>
          <ChevronRight size={16} className="text-tertiary/40 shrink-0 ml-2" />
        </button>
      ))}
    </div>
  )
}

// ─── Step 2: Select Task (flat list matching TrainingPanel UI) ───────────────

function SelectTaskStep({
  onSelectTask,
  medicName,
}: {
  onSelectTask: (taskNumber: string, taskTitle: string) => void
  medicName: string
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const allByCategory = useMemo(() => buildTestableTasksByCategory(), [])

  const displayCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return allByCategory

    const filtered = new Map<string, FlatTask[]>()
    for (const [cat, tasks] of allByCategory) {
      const matched = tasks.filter(
        t => t.title.toLowerCase().includes(q) || t.taskId.toLowerCase().includes(q)
      )
      if (matched.length > 0) filtered.set(cat, matched)
    }
    return filtered
  }, [searchQuery, allByCategory])

  const totalResults = useMemo(() => {
    let n = 0
    for (const tasks of displayCategories.values()) n += tasks.length
    return n
  }, [displayCategories])

  const isSearching = searchQuery.trim().length > 0

  return (
    <div>
      <p className="text-xs text-tertiary/60 mb-3">
        Testing <span className="font-medium text-primary">{medicName}</span> &mdash; select a task:
      </p>

      {/* Search Bar */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary/40 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tasks..."
          className="w-full pl-8 pr-8 py-2 rounded-lg bg-themewhite2 text-sm text-primary
                     placeholder:text-tertiary/40 outline-none focus:ring-1 focus:ring-themeblue2/40 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(''); inputRef.current?.focus() }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-tertiary/10 transition-colors"
          >
            <X size={14} className="text-tertiary/50" />
          </button>
        )}
      </div>

      {isSearching && (
        <p className="text-[10px] text-tertiary/50 mb-2">
          {totalResults} result{totalResults !== 1 ? 's' : ''}
        </p>
      )}

      {totalResults === 0 && isSearching ? (
        <p className="text-sm text-tertiary/40 text-center py-8">No tasks match your search.</p>
      ) : (
        <div className="space-y-1">
          {Array.from(displayCategories).map(([categoryName, tasks]) => (
            <div key={categoryName}>
              {/* Group header */}
              <div className="px-6 pt-4 pb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-tertiary/50">
                  {subjectAreaIcons[categoryName] ?? <BookOpen size={14} />}
                  <p className="text-[10px] font-semibold tracking-widest uppercase">
                    {categoryName}
                  </p>
                </div>
                <p className="text-[10px] text-tertiary/40">
                  {tasks.length}
                </p>
              </div>

              {/* Tasks */}
              {tasks.map((task) => {
                const testable = isTaskTestable(task.taskId)
                const badge = skillLevelLabels[task.levelName] ?? task.levelName

                return (
                  <button
                    key={task.taskId}
                    onClick={() => testable && onSelectTask(task.taskId, task.title)}
                    disabled={!testable}
                    className={`flex items-center w-full px-6 py-3 rounded-xl text-left transition-all
                      ${testable
                        ? 'hover:bg-themewhite2 active:scale-[0.98] cursor-pointer'
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
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Step 3: GO/NO GO Evaluation ─────────────────────────────────────────────

function EvaluationStep({
  taskNumber,
  taskTitle,
  medicName,
  onSubmit,
}: {
  taskNumber: string
  taskTitle: string
  medicName: string
  onSubmit: (stepResults: StepResult[], notes: string) => void
}) {
  const taskData = getTaskData(taskNumber)
  const [results, setResults] = useState<Map<string, 'GO' | 'NO_GO'>>(new Map())
  const [notes, setNotes] = useState('')

  if (!taskData) {
    return <div className="text-center py-12 text-tertiary/60">Task data not available</div>
  }

  const gradedSet = new Set(taskData.gradedSteps ?? [])
  const gradedStepNumbers = taskData.performanceSteps
    .filter(s => gradedSet.has(s.number))
    .map(s => s.number)
  const totalSteps = gradedStepNumbers.length
  const evaluatedCount = gradedStepNumbers.filter(n => results.has(n)).length
  const allEvaluated = evaluatedCount === totalSteps
  const hasNoGo = gradedStepNumbers.some(n => results.get(n) === 'NO_GO')
  const overallPreview = !allEvaluated ? null : hasNoGo ? 'FAIL' : 'PASS'

  const toggleResult = (stepNumber: string, value: 'GO' | 'NO_GO') => {
    setResults(prev => {
      const next = new Map(prev)
      if (next.get(stepNumber) === value) {
        next.delete(stepNumber)
      } else {
        next.set(stepNumber, value)
      }
      return next
    })
  }

  const handleSubmit = () => {
    const stepResults: StepResult[] = taskData.performanceSteps
      .filter(step => gradedSet.has(step.number))
      .map(step => ({
        stepNumber: step.number,
        result: results.get(step.number) ?? null,
      }))
    onSubmit(stepResults, notes)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pb-36">
        {/* Header */}
        <div className="mb-4">
          <p className="text-[8pt] text-tertiary/50 font-mono">{taskNumber}</p>
          <h3 className="text-lg font-semibold text-primary">{taskTitle}</h3>
          <p className="text-xs text-tertiary/60 mt-1">Evaluating: <span className="font-medium text-primary">{medicName}</span></p>
        </div>

        {/* Task-level caution */}
        {taskData.caution && (
          <div className="mb-4">
            <StepCallout type="caution" text={taskData.caution} />
          </div>
        )}

        {/* Standards */}
        <div className="mb-4">
          <p className="text-[9pt] font-semibold text-tertiary/60 uppercase tracking-wider mb-1.5">Standards</p>
          <div className="bg-themewhite2 rounded-lg px-3.5 py-3">
            <p className="text-sm text-primary/80 leading-relaxed">{taskData.standards}</p>
          </div>
        </div>

        {/* Performance Steps with GO/NO GO */}
        <div className="mb-4">
          <p className="text-[9pt] font-semibold text-tertiary/60 uppercase tracking-wider mb-1.5">Performance Steps</p>
          <div className="space-y-1">
            {taskData.performanceSteps.map((step: PerformanceStep) => {
              const isGraded = gradedSet.has(step.number)
              const currentResult = results.get(step.number)
              return (
                <div key={step.number} className={`bg-themewhite2 rounded-lg px-3 py-2.5 ${step.isSubStep ? 'ml-5' : ''}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-[9pt] text-tertiary/50 font-mono w-6 shrink-0 text-right mt-1">
                      {step.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${isGraded ? 'text-primary' : 'text-tertiary/50'}`}>{step.text}</p>
                      {step.warning && <StepCallout type="warning" text={step.warning} />}
                      {step.caution && <StepCallout type="caution" text={step.caution} />}
                      {step.note && <StepCallout type="note" text={step.note} />}
                    </div>
                  </div>
                  {/* GO / NO GO buttons — only for graded steps */}
                  {isGraded && (
                    <div className="flex gap-2 mt-2 ml-8">
                      <button
                        onClick={() => toggleResult(step.number, 'GO')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.97]
                          ${currentResult === 'GO'
                            ? 'bg-themegreen text-white'
                            : 'bg-themegreen/10 text-themegreen border border-themegreen/20 hover:bg-themegreen/20'
                          }`}
                      >
                        <Check size={14} /> GO
                      </button>
                      <button
                        onClick={() => toggleResult(step.number, 'NO_GO')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.97]
                          ${currentResult === 'NO_GO'
                            ? 'bg-themeredred text-white'
                            : 'bg-themeredred/10 text-themeredred border border-themeredred/20 hover:bg-themeredred/20'
                          }`}
                      >
                        <X size={14} /> NO GO
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Supervisor Notes */}
        <div className="mb-4">
          <p className="text-[9pt] font-semibold text-tertiary/60 uppercase tracking-wider mb-1.5">Supervisor Notes (Optional)</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional comments or observations..."
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-sm
                       border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                       transition-colors placeholder:text-tertiary/30 resize-none"
          />
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 left-0 right-0 bg-themewhite border-t border-tertiary/10 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-tertiary/60">
            {evaluatedCount}/{totalSteps} steps evaluated
          </span>
          {overallPreview && (
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              overallPreview === 'PASS' ? 'bg-themegreen/15 text-themegreen' : 'bg-themeredred/15 text-themeredred'
            }`}>
              {overallPreview}
            </span>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!allEvaluated}
          className="w-full py-3 rounded-xl bg-themeblue2 text-white text-sm font-semibold
                     hover:bg-themeblue2/90 active:scale-[0.98] transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Evaluation
        </button>
      </div>
    </div>
  )
}

// ─── History Tab ─────────────────────────────────────────────────────────────

function HistoryTab({ clinicUsers, currentUserId }: { clinicUsers: ClinicMedic[]; currentUserId: string }) {
  const [tests, setTests] = useState<TrainingCompletionUI[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Build ID → display name lookup from clinic users list (include self for supervisor resolution)
  const nameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of clinicUsers) {
      map.set(u.id, formatMedicName(u))
    }
    return map
  }, [clinicUsers])

  const resolveName = useCallback((id: string | null) => {
    if (!id) return 'Unknown'
    return nameMap.get(id) ?? id
  }, [nameMap])

  // Fetch clinic-wide test history on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const clinicUserIds = clinicUsers.map(u => u.id)
        // Include self in the user IDs list so we can see tests where we were the supervisor
        // but fetchClinicTestHistory will exclude records where currentUser was the one tested
        const allIds = [...clinicUserIds, currentUserId]
        const data = await fetchClinicTestHistory(allIds, currentUserId)
        if (!cancelled) setTests(data)
      } catch (err) {
        console.error('[HistoryTab] Failed to fetch clinic test history:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [clinicUsers, currentUserId])

  const handleDelete = useCallback(async (completionId: string) => {
    try {
      await deleteCompletionApi(completionId, currentUserId)
      setTests(prev => prev.filter(t => t.id !== completionId))
    } catch (err) {
      console.error('[HistoryTab] Delete failed:', err)
    }
    setDeletingId(null)
    setExpandedId(null)
  }, [currentUserId])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="text-tertiary/60">Loading history...</div></div>
  }

  if (tests.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock size={48} className="mx-auto mb-4 text-tertiary/40" />
        <p className="text-sm text-tertiary/60">No test records yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tests.map((record: TrainingCompletionUI) => {
        const isExpanded = expandedId === record.id
        const taskTitle = getTaskData(record.trainingItemId)?.title ?? record.trainingItemId
        const overallResult = record.result === 'GO' ? 'PASS' : 'FAIL'

        return (
          <div key={record.id} className="rounded-lg border border-tertiary/10 bg-themewhite2 overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : record.id)}
              className="flex items-center w-full px-4 py-3 text-left hover:bg-themewhite2/80 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary">{resolveName(record.userId)}</p>
                <p className="text-xs text-tertiary/60 truncate">{taskTitle}</p>
                <p className="text-[9pt] text-tertiary/40 mt-0.5">
                  {new Date(record.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <span className={`shrink-0 ml-2 px-3 py-1 rounded-full text-xs font-bold ${
                overallResult === 'PASS' ? 'bg-themegreen/15 text-themegreen' : 'bg-themeredred/15 text-themeredred'
              }`}>
                {overallResult}
              </span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-3 border-t border-tertiary/10">
                <div className="mt-3 mb-2">
                  <p className="text-[8pt] text-tertiary/50 font-mono">{record.trainingItemId}</p>
                  <p className="text-xs text-tertiary/60 mt-1">
                    Supervisor: {resolveName(record.supervisorId)} &middot; {new Date(record.updatedAt).toLocaleString()}
                  </p>
                </div>

                {record.stepResults && (() => {
                  const taskDef = getTaskData(record.trainingItemId)
                  const gradedFilter = taskDef?.gradedSteps ? new Set(taskDef.gradedSteps) : null
                  const displayResults = gradedFilter
                    ? record.stepResults.filter(sr => gradedFilter.has(sr.stepNumber))
                    : record.stepResults
                  return (
                    <div className="space-y-1">
                      {displayResults.map((sr) => (
                        <div key={sr.stepNumber} className="flex items-center gap-2 py-1">
                          <span className="text-[9pt] text-tertiary/50 font-mono w-6 text-right">{sr.stepNumber}</span>
                          {sr.result === 'GO' ? (
                            <span className="px-2 py-0.5 rounded text-[9pt] font-bold bg-themegreen/15 text-themegreen">GO</span>
                          ) : sr.result === 'NO_GO' ? (
                            <span className="px-2 py-0.5 rounded text-[9pt] font-bold bg-themeredred/15 text-themeredred">NO GO</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[9pt] bg-tertiary/10 text-tertiary/50">--</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {record.supervisorNotes && (
                  <div className="mt-3 p-2 bg-themewhite rounded text-sm">
                    <span className="text-tertiary/60">Notes:</span> <span className="text-primary">{record.supervisorNotes}</span>
                  </div>
                )}

                {deletingId === record.id ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="flex-1 py-2 rounded-lg bg-themeredred text-white text-sm font-medium hover:bg-themeredred/90 transition-colors"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="px-4 py-2 rounded-lg bg-tertiary/10 text-primary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(record.id)}
                    className="mt-3 text-xs text-themeredred hover:underline"
                  >
                    Delete record
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main SupervisorPanel ────────────────────────────────────────────────────

type WizardStep = 'select-medic' | 'select-task' | 'evaluate'

export function SupervisorPanel({
  backRef,
  onBackToMain,
}: {
  backRef?: MutableRefObject<(() => void) | null>
  onBackToMain?: () => void
}) {
  const [isSupervisor, setIsSupervisor] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<ClinicMedic | null>(null)
  const [activeTab, setActiveTab] = useState<'new-test' | 'history'>('new-test')
  const { submitTestEvaluation } = useTrainingCompletions()
  const { medics: clinicUsers } = useClinicMedics()

  // All clinic users including self (for name resolution in history)
  const allClinicUsers = useMemo(() => {
    if (!currentUserProfile) return clinicUsers
    return [...clinicUsers, currentUserProfile]
  }, [clinicUsers, currentUserProfile])

  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>('select-medic')
  const [selectedMedic, setSelectedMedic] = useState<ClinicMedic | null>(null)
  const [selectedTaskNumber, setSelectedTaskNumber] = useState<string | null>(null)
  const [selectedTaskTitle, setSelectedTaskTitle] = useState<string | null>(null)

  // Check supervisor role and capture current user profile
  useState(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, middle_initial, rank, credential, roles')
          .eq('id', user.id)
          .single()
        if (data) {
          const roles = data.roles as string[] | null
          setIsSupervisor(roles?.includes('supervisor') ?? false)
          setCurrentUserProfile({
            id: data.id,
            firstName: data.first_name,
            lastName: data.last_name,
            middleInitial: data.middle_initial,
            rank: data.rank,
            credential: data.credential,
          })
        }
      }
      setLoading(false)
    })()
  })

  const resetWizard = useCallback(() => {
    setWizardStep('select-medic')
    setSelectedMedic(null)
    setSelectedTaskNumber(null)
    setSelectedTaskTitle(null)
  }, [])

  // Keep backRef in sync so the drawer header back button navigates wizard steps
  useEffect(() => {
    if (!backRef) return
    if (activeTab === 'history' || wizardStep === 'select-medic') {
      backRef.current = onBackToMain ?? null
    } else if (wizardStep === 'select-task') {
      backRef.current = () => setWizardStep('select-medic')
    } else if (wizardStep === 'evaluate') {
      backRef.current = () => setWizardStep('select-task')
    }
  }, [backRef, onBackToMain, wizardStep, activeTab])

  const handleSelectMedic = useCallback((medic: ClinicMedic) => {
    setSelectedMedic(medic)
    setWizardStep('select-task')
  }, [])

  const handleSelectTask = useCallback((taskNumber: string, taskTitle: string) => {
    setSelectedTaskNumber(taskNumber)
    setSelectedTaskTitle(taskTitle)
    setWizardStep('evaluate')
  }, [])

  const handleSubmitEvaluation = useCallback(async (stepResults: StepResult[], notes: string) => {
    if (!selectedMedic || !selectedTaskNumber) return

    const hasNoGo = stepResults.some(s => s.result === 'NO_GO')
    await submitTestEvaluation({
      medicUserId: selectedMedic.id,
      trainingItemId: selectedTaskNumber,
      result: hasNoGo ? 'NO_GO' : 'GO',
      stepResults,
      supervisorNotes: notes || undefined,
    })

    resetWizard()
    setActiveTab('history')
  }, [selectedMedic, selectedTaskNumber, submitTestEvaluation, resetWizard])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-tertiary/60">Loading...</div>
      </div>
    )
  }

  if (!isSupervisor) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <div className="text-center">
          <Ban size={48} className="mx-auto mb-4 text-tertiary/40" />
          <h3 className="text-lg font-semibold text-primary mb-2">Access Denied</h3>
          <p className="text-sm text-tertiary/60">You need the supervisor role to access this panel.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5">
        {/* Tab bar */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => { setActiveTab('new-test'); resetWizard() }}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-colors
              ${activeTab === 'new-test' ? 'bg-themeblue2 text-white' : 'bg-themewhite2 text-tertiary/70 hover:bg-themewhite2/80'}`}
          >
            <FileText size={14} /> New Test
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-colors
              ${activeTab === 'history' ? 'bg-themeblue2 text-white' : 'bg-themewhite2 text-tertiary/70 hover:bg-themewhite2/80'}`}
          >
            <Clock size={14} /> History
          </button>
        </div>

        {activeTab === 'history' && currentUserId ? (
          <HistoryTab clinicUsers={allClinicUsers} currentUserId={currentUserId} />
        ) : wizardStep === 'select-medic' ? (
          <SelectMedicStep onSelect={handleSelectMedic} />
        ) : wizardStep === 'select-task' && selectedMedic ? (
          <SelectTaskStep
            onSelectTask={handleSelectTask}
            medicName={formatMedicName(selectedMedic)}
          />
        ) : wizardStep === 'evaluate' && selectedMedic && selectedTaskNumber && selectedTaskTitle ? (
          <EvaluationStep
            taskNumber={selectedTaskNumber}
            taskTitle={selectedTaskTitle}
            medicName={formatMedicName(selectedMedic)}
            onSubmit={handleSubmitEvaluation}
          />
        ) : null}
      </div>
    </div>
  )
}
