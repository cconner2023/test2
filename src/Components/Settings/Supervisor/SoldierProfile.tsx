import { useState, useCallback, useMemo } from 'react'
import { Building2, ChevronRight, ClipboardList, Calendar } from 'lucide-react'
import { ActionButton } from '../../ActionButton'
import { getTaskData, isTaskTestable } from '../../../Data/TrainingData'
import { deleteCompletion as deleteCompletionApi } from '../../../lib/trainingService'
import { formatMedicName, getExpirationStatus, getLatestTestByTask } from './supervisorHelpers'
import type { FlatTask } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { Certification } from '../../../Data/User'
import type { TrainingCompletionUI } from '../../../lib/trainingService'
import type { CalendarEvent } from '../../../Types/CalendarTypes'
import { getCategoryMeta } from '../../../Types/CalendarTypes'
import { createLogger } from '../../../Utilities/Logger'

function formatEventDate(evt: CalendarEvent): string {
  const start = new Date(evt.start_time)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const eventDay = new Date(start); eventDay.setHours(0, 0, 0, 0)

  let dayLabel: string
  if (eventDay.getTime() === today.getTime()) dayLabel = 'Today'
  else if (eventDay.getTime() === yesterday.getTime()) dayLabel = 'Yesterday'
  else if (eventDay.getTime() === tomorrow.getTime()) dayLabel = 'Tomorrow'
  else dayLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (evt.all_day) return dayLabel
  return `${dayLabel} · ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

const logger = createLogger('SoldierProfile')

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

interface SoldierProfileProps {
  soldier: ClinicMedic
  certs: Certification[]
  tests: TrainingCompletionUI[]
  assignments: TrainingCompletionUI[]
  readinessPercent: number
  compliancePercent: number
  currentUserId: string
  resolveName: (id: string | null) => string
  onNavigateToCert?: (certId: string) => void
  onRemoveTest: (testId: string) => void
  testableTaskMap: Map<string, FlatTask[]>
  onNavigateToArea?: (areaName: string) => void
  calendarEvents: CalendarEvent[]
  onOpenCalendar: () => void
}

export function SoldierProfile({
  soldier,
  certs,
  tests,
  assignments,
  readinessPercent,
  compliancePercent,
  currentUserId,
  resolveName,
  onNavigateToCert,
  onRemoveTest,
  testableTaskMap,
  onNavigateToArea,
  calendarEvents,
  onOpenCalendar,
}: SoldierProfileProps) {
  const now = useMemo(() => new Date(), [])
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = useCallback(async (testId: string) => {
    try {
      await deleteCompletionApi(testId, currentUserId)
      onRemoveTest(testId)
    } catch (err) {
      logger.error('Delete failed:', err)
    }
    setDeletingId(null)
    setExpandedTestId(null)
  }, [currentUserId, onRemoveTest])

  const validCertCount = useMemo(() =>
    certs.filter(c => getExpirationStatus(c.exp_date) === 'valid').length,
  [certs])

  const sortedCerts = useMemo(() => {
    const priority: Record<string, number> = { expired: 0, expiring: 1, valid: 2, none: 3 }
    return [...certs].sort((a, b) => {
      const aStatus = getExpirationStatus(a.exp_date)
      const bStatus = getExpirationStatus(b.exp_date)
      return (priority[aStatus] ?? 3) - (priority[bStatus] ?? 3)
    })
  }, [certs])

  const sortedTests = useMemo(() => {
    return [...tests].sort((a, b) => {
      if (a.result !== b.result) return a.result === 'NO_GO' ? -1 : 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [tests])

  /** Per-category competency for this soldier */
  const categoryCompetency = useMemo(() => {
    const latestByTask = getLatestTestByTask(tests)
    const categories: { areaName: string; passed: number; total: number; pct: number }[] = []

    for (const [areaName, tasks] of testableTaskMap) {
      const testable = tasks.filter(t => isTaskTestable(t.taskId))
      if (testable.length === 0) continue
      let passed = 0
      for (const task of testable) {
        const latest = latestByTask.get(task.taskId)
        if (latest?.result === 'GO') passed++
      }
      const pct = Math.round((passed / testable.length) * 100)
      categories.push({ areaName, passed, total: testable.length, pct })
    }

    return categories.sort((a, b) => a.pct - b.pct)
  }, [tests, testableTaskMap])

  return (
    <div className="space-y-5">
      {/* Soldier Card */}
      <div data-tour="supervisor-soldier-card" className="rounded-xl bg-themewhite2 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
            <Building2 size={16} className="text-tertiary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{formatMedicName(soldier)}</p>
            <p className="text-[9pt] text-tertiary">
              {soldier.credential ?? 'No credential'} · {validCertCount}/{certs.length} certs valid
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mt-2 ml-11">
          <div className="flex items-center gap-2">
            <span className="text-[9pt] text-tertiary w-18 shrink-0">Readiness</span>
            <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
              <div className={`h-full rounded-full ${readinessColor(readinessPercent)}`} style={{ width: `${readinessPercent}%` }} />
            </div>
            <span className={`text-[9pt] font-medium w-8 text-right ${readinessTextColor(readinessPercent)}`}>{readinessPercent}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9pt] text-tertiary w-18 shrink-0">Compliance</span>
            <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
              <div className={`h-full rounded-full ${readinessColor(compliancePercent)}`} style={{ width: `${compliancePercent}%` }} />
            </div>
            <span className={`text-[9pt] font-medium w-8 text-right ${readinessTextColor(compliancePercent)}`}>{compliancePercent}%</span>
          </div>
        </div>
      </div>

      {/* Assignments */}
      {assignments.length > 0 && (
        <div>
          <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
            Assignments
          </p>
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
            {assignments.map((a) => {
              const taskTitle = getTaskData(a.trainingItemId)?.title ?? a.trainingItemId
              const isCompleted = !!a.completedAt
              const isOverdue = !isCompleted && a.dueDate && new Date(a.dueDate) < new Date()
              const formatDate = (iso: string) => {
                const d = new Date(iso + 'T00:00:00')
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }

              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isCompleted ? 'bg-themegreen/10' : isOverdue ? 'bg-themeredred/10' : 'bg-themeblue3/10'
                  }`}>
                    <ClipboardList size={14} className={
                      isCompleted ? 'text-themegreen' : isOverdue ? 'text-themeredred' : 'text-themeblue2'
                    } />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{taskTitle}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9pt] text-tertiary">
                        {resolveName(a.supervisorId)}
                      </span>
                      {a.dueDate && (
                        <>
                          <span className="text-tertiary">·</span>
                          <span className={`text-[9pt] font-medium ${
                            isCompleted ? 'text-themegreen' : isOverdue ? 'text-themeredred' : 'text-tertiary'
                          }`}>
                            {isCompleted ? 'Done' : isOverdue ? 'Overdue' : 'Due'} {formatDate(a.dueDate)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`text-[9pt] font-medium shrink-0 ${
                    isCompleted ? 'text-themegreen' : isOverdue ? 'text-themeredred' : 'text-themeblue2'
                  }`}>
                    {isCompleted ? 'Complete' : isOverdue ? 'Overdue' : 'Pending'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Schedule */}
      <div>
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
          Schedule
        </p>
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          {calendarEvents.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-3">
              <p className="text-sm text-tertiary flex-1">No events in the next 14 days</p>
              <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-2xl bg-themewhite shadow-sm border border-tertiary/15">
                <ActionButton icon={Calendar} label="Open full calendar" onClick={onOpenCalendar} />
              </div>
            </div>
          ) : (
            <>
              {calendarEvents.map((evt, idx) => {
                const isPast = new Date(evt.end_time) < now
                const meta = getCategoryMeta(evt.category)
                return (
                  <div
                    key={evt.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-opacity ${idx > 0 ? 'border-t border-tertiary/8' : ''} ${isPast ? 'opacity-50' : ''}`}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${meta.solidColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{evt.title}</p>
                      <p className="text-[9pt] text-tertiary">{formatEventDate(evt)}</p>
                    </div>
                    <span className="text-[9pt] text-tertiary shrink-0 capitalize">{evt.category}</span>
                  </div>
                )
              })}
              <div className="flex items-center justify-end gap-3 px-4 py-2 border-t border-tertiary/8">
                <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-2xl bg-themewhite shadow-sm border border-tertiary/15">
                  <ActionButton icon={Calendar} label="View in calendar" onClick={onOpenCalendar} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Certifications */}
      <div>
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
          Certifications
        </p>
        {certs.length === 0 ? (
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden px-4 py-4">
            <p className="text-sm text-tertiary">No certifications on file</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
            {sortedCerts.map((cert) => {
              const status = getExpirationStatus(cert.exp_date)
              return (
                <button
                  key={cert.id}
                  onClick={() => onNavigateToCert?.(cert.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-themeblue2/5 active:scale-95 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-primary truncate">{cert.title}</p>
                      {cert.is_primary && (
                        <span className="text-[9pt] md:text-[9pt] font-medium text-themeblue2 bg-themeblue2/10 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">Primary</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-tertiary">
                      {cert.cert_number && <span>#{cert.cert_number}</span>}
                      {cert.exp_date && <span>Exp: {new Date(cert.exp_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                    </div>
                  </div>
                  <span className={`text-[9pt] font-medium shrink-0 ${
                    status === 'valid' ? 'text-themegreen' : status === 'expiring' ? 'text-themeyellow' : status === 'expired' ? 'text-themeredred' : 'text-tertiary'
                  }`}>
                    {status === 'valid' ? 'Valid' : status === 'expiring' ? 'Expiring' : status === 'expired' ? 'Expired' : 'No Date'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Training Competency by Category */}
      <div data-tour="supervisor-competency">
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
          Training Competency
        </p>
        {categoryCompetency.length === 0 ? (
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden px-4 py-4">
            <p className="text-sm text-tertiary">No testable tasks available</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
            {categoryCompetency.map((cat) => (
              <button
                key={cat.areaName}
                onClick={() => onNavigateToArea?.(cat.areaName)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-themeblue2/5 active:scale-95 transition-all"
              >
                <span className="text-sm text-primary min-w-0 truncate shrink-0 w-36">
                  {cat.areaName}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${readinessColor(cat.pct)}`}
                      style={{ width: `${cat.pct}%` }}
                    />
                  </div>
                </div>
                <span className={`text-[9pt] font-medium w-12 text-right ${readinessTextColor(cat.pct)}`}>
                  {cat.passed}/{cat.total}
                </span>
                <ChevronRight size={14} className="text-tertiary shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Training History */}
      <div>
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
          Training History
        </p>
        {tests.length === 0 ? (
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden px-4 py-4">
            <p className="text-sm text-tertiary">No test records yet</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
            {sortedTests.map((record) => {
              const isExpanded = expandedTestId === record.id
              const taskTitle = getTaskData(record.trainingItemId)?.title ?? record.trainingItemId
              const overallResult = record.result === 'GO' ? 'PASS' : 'FAIL'

              return (
                <div key={record.id}>
                  <button
                    onClick={() => setExpandedTestId(isExpanded ? null : record.id)}
                    className="flex items-center w-full px-4 py-3 text-left hover:bg-themeblue2/5 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{taskTitle}</p>
                      <p className="text-[9pt] text-tertiary mt-0.5">
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
                        <p className="text-[9pt] text-tertiary font-mono">{record.trainingItemId}</p>
                        <p className="text-xs text-tertiary mt-1">
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
                                <span className="text-[9pt] text-tertiary font-mono w-6 text-right">{sr.stepNumber}</span>
                                {sr.result === 'GO' ? (
                                  <span className="px-2 py-0.5 rounded text-[9pt] font-bold bg-themegreen/15 text-themegreen">GO</span>
                                ) : sr.result === 'NO_GO' ? (
                                  <span className="px-2 py-0.5 rounded text-[9pt] font-bold bg-themeredred/15 text-themeredred">NO GO</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[9pt] bg-tertiary/10 text-tertiary">--</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )
                      })()}

                      {record.supervisorNotes && (
                        <div className="mt-3 p-2 bg-themewhite rounded text-sm">
                          <span className="text-tertiary">Notes:</span> <span className="text-primary">{record.supervisorNotes}</span>
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
        )}
      </div>
    </div>
  )
}
