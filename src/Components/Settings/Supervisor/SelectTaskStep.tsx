import { useMemo } from 'react'
import { ChevronRight, Lock } from 'lucide-react'
import { isTaskTestable } from '../../../Data/TrainingData'
import { skillLevelLabels } from '../../../Data/TrainingConstants'
import { buildTestableTasksByCategory } from './supervisorHelpers'

export function SelectTaskStep({
  onSelectTask,
  medicName,
  searchQuery = '',
}: {
  onSelectTask: (taskNumber: string, taskTitle: string) => void
  medicName: string
  searchQuery?: string
}) {

  const allByCategory = useMemo(() => buildTestableTasksByCategory(), [])

  const displayCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return allByCategory

    const filtered = new Map<string, (typeof allByCategory extends Map<string, infer V> ? V : never)>()
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

      {isSearching && (
        <p className="text-[10px] text-tertiary/50 mb-2">
          {totalResults} result{totalResults !== 1 ? 's' : ''}
        </p>
      )}

      {totalResults === 0 && isSearching ? (
        <p className="text-sm text-tertiary/40 text-center py-8">No tasks match your search.</p>
      ) : (
        <div data-tour="supervisor-task-list" className="space-y-5">
          {Array.from(displayCategories).map(([categoryName, tasks]) => (
            <div key={categoryName}>
              {/* Section header */}
              <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">
                {categoryName} <span className="font-normal text-tertiary/50">({tasks.length})</span>
              </p>

              {/* Card container */}
              <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                {tasks.map((task, index) => {
                  const testable = isTaskTestable(task.taskId)
                  const badge = skillLevelLabels[task.levelName] ?? task.levelName

                  return (
                    <button
                      key={task.taskId}
                      onClick={() => testable && onSelectTask(task.taskId, task.title)}
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
