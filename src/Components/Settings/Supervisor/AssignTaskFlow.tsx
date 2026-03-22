import { useState, useMemo } from 'react'
import { ChevronRight, Lock, CalendarDays } from 'lucide-react'
import { getTaskData } from '../../../Data/TrainingData'
import { skillLevelLabels } from '../../../Data/TrainingConstants'
import { buildTestableTasksByCategory, formatMedicName } from './supervisorHelpers'
import type { FlatTask } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import { DatePickerInput, TextInput } from '../../FormInputs'

// ─── Step 1: Select Task ────────────────────────────────────────────────────

function SelectTaskForAssignment({
  onSelectTask,
  medicName,
  searchQuery = '',
}: {
  onSelectTask: (taskId: string, taskTitle: string) => void
  medicName: string
  searchQuery?: string
}) {
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
        Assigning to <span className="font-medium text-primary">{medicName}</span> &mdash; select a task:
      </p>

      {isSearching && (
        <p className="text-[10px] text-tertiary/50 mb-2">
          {totalResults} result{totalResults !== 1 ? 's' : ''}
        </p>
      )}

      {totalResults === 0 && isSearching ? (
        <p className="text-sm text-tertiary/40 text-center py-8">No tasks match your search.</p>
      ) : (
        <div className="space-y-5">
          {Array.from(displayCategories).map(([categoryName, tasks]) => (
            <div key={categoryName}>
              <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">
                {categoryName} <span className="font-normal text-tertiary/50">({tasks.length})</span>
              </p>

              <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                {tasks.map((task, idx) => {
                  const hasData = !!getTaskData(task.taskId)
                  const badge = skillLevelLabels[task.levelName] ?? task.levelName

                  return (
                    <button
                      key={task.taskId}
                      onClick={() => hasData && onSelectTask(task.taskId, task.title)}
                      disabled={!hasData}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all
                        ${idx > 0 ? 'border-t border-themeblue3/10' : ''}
                        ${hasData
                          ? 'hover:bg-themeblue2/5 active:scale-95 cursor-pointer'
                          : 'opacity-40 cursor-not-allowed'
                        }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${hasData ? 'text-primary' : 'text-tertiary'}`}>
                          {task.title}
                        </p>
                        <p className="text-[8pt] text-tertiary/50 font-mono">
                          {task.taskId}
                        </p>
                        {!hasData && (
                          <p className="text-[8pt] text-tertiary/40 flex items-center gap-1 mt-0.5">
                            <Lock size={9} /> Coming soon
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[8pt] font-semibold bg-themeblue3/10 text-tertiary/60">
                          {badge}
                        </span>
                        {hasData && (
                          <ChevronRight size={16} className="text-tertiary/30" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Step 2: Set Due Date + Notes ───────────────────────────────────────────

function AssignmentDetails({
  taskTitle,
  taskNumber,
  medicName,
  onSubmit,
  onBack,
}: {
  taskTitle: string
  taskNumber: string
  medicName: string
  onSubmit: (dueDate: string, notes: string) => void
  onBack: () => void
}) {
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')

  const today = new Date()
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[8pt] text-tertiary/50 font-mono">{taskNumber}</p>
        <h3 className="text-base font-semibold text-primary">{taskTitle}</h3>
        <p className="text-xs text-tertiary/60 mt-1">
          Assigning to <span className="font-medium text-primary">{medicName}</span>
        </p>
      </div>

      <div>
        <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
          Due Date <span className="text-themeredred">*</span>
        </span>
        <div className="mt-1">
          <DatePickerInput
            value={dueDate}
            onChange={setDueDate}
            placeholder="Select due date"
            minDate={minDate}
          />
        </div>
      </div>

      <div>
        <TextInput
          label="Notes (Optional)"
          value={notes}
          onChange={setNotes}
          placeholder="Study chapters 3-5, focus on airway management..."
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl bg-tertiary/10 text-primary text-sm font-medium
                     active:scale-95 transition-all"
        >
          Back
        </button>
        <button
          onClick={() => onSubmit(dueDate, notes)}
          disabled={!dueDate}
          className="flex-1 py-3 rounded-xl bg-themeblue3 text-white text-sm font-semibold
                     active:scale-95 transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="flex items-center justify-center gap-1.5">
            <CalendarDays size={15} />
            Assign Task
          </span>
        </button>
      </div>
    </div>
  )
}

// ─── Exported Flow ──────────────────────────────────────────────────────────

interface AssignTaskFlowProps {
  soldier: ClinicMedic
  searchQuery?: string
  preSelectedTask?: { id: string; title: string }
  onSubmit: (taskId: string, taskTitle: string, dueDate: string, notes: string) => void
}

export function AssignTaskFlow({
  soldier,
  searchQuery,
  preSelectedTask,
  onSubmit,
}: AssignTaskFlowProps) {
  const [selectedTask, setSelectedTask] = useState<{ id: string; title: string } | null>(preSelectedTask ?? null)
  const medicName = formatMedicName(soldier)

  if (selectedTask) {
    return (
      <AssignmentDetails
        taskTitle={selectedTask.title}
        taskNumber={selectedTask.id}
        medicName={medicName}
        onSubmit={(dueDate, notes) => onSubmit(selectedTask.id, selectedTask.title, dueDate, notes)}
        onBack={() => setSelectedTask(null)}
      />
    )
  }

  return (
    <SelectTaskForAssignment
      onSelectTask={(id, title) => setSelectedTask({ id, title })}
      medicName={medicName}
      searchQuery={searchQuery}
    />
  )
}
