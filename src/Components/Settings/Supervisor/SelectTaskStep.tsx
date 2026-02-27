import { useState, useMemo, useRef } from 'react'
import { ChevronRight, Search, X, Lock, BookOpen } from 'lucide-react'
import { isTaskTestable } from '../../../Data/TrainingData'
import { subjectAreaIcons, skillLevelLabels } from '../../../Data/TrainingConstants'
import { buildTestableTasksByCategory } from './supervisorHelpers'

export function SelectTaskStep({
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
                    className={`flex items-center w-full px-6 py-3 rounded-lg text-left transition-all
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
