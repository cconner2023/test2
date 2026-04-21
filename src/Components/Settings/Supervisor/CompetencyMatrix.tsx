import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Users } from 'lucide-react'
import { EmptyState } from '../../EmptyState'
import { SearchInput } from '../../SearchInput'
import { formatMedicName } from './supervisorHelpers'
import { subjectAreaIcons } from '../../../Data/TrainingConstants'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { SoldierCompetency, CompetencyStatus, FlatTask } from './supervisorHelpers'

interface CompetencyMatrixProps {
  matrix: SoldierCompetency[]
  medics: ClinicMedic[]
  testableTaskMap: Map<string, FlatTask[]>
  resolveName: (id: string | null) => string
  initialAreaFilter?: string | null
}

const dotColor: Record<CompetencyStatus, string> = {
  GO: 'bg-themegreen',
  NO_GO: 'bg-themeredred',
  UNTESTED: 'bg-tertiary/20',
}

const dotLabel: Record<CompetencyStatus, string> = {
  GO: 'GO',
  NO_GO: 'NO GO',
  UNTESTED: 'Untested',
}

function readinessColor(pct: number): string {
  if (pct >= 80) return 'bg-themegreen/15 text-themegreen'
  if (pct >= 50) return 'bg-themeyellow/15 text-themeyellow'
  return 'bg-themeredred/15 text-themeredred'
}

export function CompetencyMatrix({
  matrix,
  medics,
  testableTaskMap,
  resolveName,
  initialAreaFilter = null,
}: CompetencyMatrixProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [areaFilter, setAreaFilter] = useState<string | null>(initialAreaFilter)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const areaNames = useMemo(() => [...testableTaskMap.keys()], [testableTaskMap])

  const sorted = useMemo(() => {
    let list = matrix.map(sc => {
      const medic = medics.find(m => m.id === sc.soldierId)
      return { ...sc, medic }
    }).filter(sc => sc.medic)

    // Search filter
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(sc => {
        const name = sc.medic ? formatMedicName(sc.medic).toLowerCase() : ''
        return name.includes(q)
      })
    }

    // Sort by readiness ascending (most attention needed first)
    list.sort((a, b) => {
      const pctA = a.overallTotal > 0 ? a.overallPassed / a.overallTotal : 0
      const pctB = b.overallTotal > 0 ? b.overallPassed / b.overallTotal : 0
      return pctA - pctB
    })

    return list
  }, [matrix, medics, searchQuery])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (matrix.length === 0) {
    return (
      <EmptyState
        icon={<Users size={28} />}
        title="No personnel data available"
      />
    )
  }

  return (
    <div>
      {/* Search */}
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search personnel..."
        className="mb-3"
      />

      {/* Area filter */}
      <div className="mb-4">
        <select
          value={areaFilter ?? ''}
          onChange={(e) => setAreaFilter(e.target.value || null)}
          className="w-full px-3 py-2 rounded-lg bg-themewhite2 text-sm text-primary
                     border border-tertiary/10 outline-none focus:ring-1 focus:ring-themeblue2/40"
        >
          <option value="">All Areas</option>
          {areaNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {searchQuery.trim() && (
        <p className="text-[9pt] text-tertiary mb-2">
          {sorted.length} result{sorted.length !== 1 ? 's' : ''}
        </p>
      )}

      {sorted.length === 0 && searchQuery.trim() ? (
        <EmptyState title="No personnel match your search" />
      ) : (
        <div className="space-y-2">
          {sorted.map((sc) => {
            if (!sc.medic) return null
            const isExpanded = expandedIds.has(sc.soldierId)
            const pct = sc.overallTotal > 0 ? Math.round((sc.overallPassed / sc.overallTotal) * 100) : 0
            const filteredAreas = areaFilter
              ? sc.areas.filter(a => a.areaName === areaFilter)
              : sc.areas

            return (
              <div key={sc.soldierId} className="rounded-lg border border-tertiary/10 bg-themewhite2 overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => toggleExpand(sc.soldierId)}
                  aria-expanded={isExpanded}
                  className="w-full flex items-center gap-2 p-3 text-left hover:bg-tertiary/5 transition-colors"
                >
                  {isExpanded
                    ? <ChevronDown size={14} className="text-tertiary flex-shrink-0" />
                    : <ChevronRight size={14} className="text-tertiary flex-shrink-0" />
                  }
                  <span className="text-sm font-medium text-primary flex-1 min-w-0 truncate">
                    {formatMedicName(sc.medic)}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${readinessColor(pct)}`}>
                    {pct}%
                  </span>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3">
                    {filteredAreas.map((area) => (
                      <div key={area.areaName}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-tertiary">
                            {subjectAreaIcons[area.areaName]}
                          </span>
                          <span className="text-xs font-medium text-primary flex-1 min-w-0 truncate">
                            {area.areaName}
                          </span>
                          <span className="text-[9pt] text-tertiary">
                            {area.passed}/{area.total}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {area.tasks.map((task) => (
                            <span
                              key={task.taskId}
                              className={`w-3 h-3 rounded-full ${dotColor[task.status]}`}
                              aria-label={`${task.title}: ${dotLabel[task.status]}`}
                              title={`${task.title}: ${dotLabel[task.status]}`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
