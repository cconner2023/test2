import { useState, useCallback, useMemo } from 'react'
import { getTaskData } from '../../../Data/TrainingData'
import { deleteCompletion as deleteCompletionApi } from '../../../lib/trainingService'
import { formatMedicName, getExpirationStatus } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { Certification } from '../../../Data/User'
import type { TrainingCompletionUI } from '../../../lib/trainingService'
import { createLogger } from '../../../Utilities/Logger'

const logger = createLogger('SoldierProfile')

function readinessTextColor(pct: number): string {
  if (pct >= 80) return 'text-themegreen'
  if (pct >= 50) return 'text-themeyellow'
  return 'text-themeredred'
}

interface SoldierProfileProps {
  soldier: ClinicMedic
  certs: Certification[]
  tests: TrainingCompletionUI[]
  readinessPercent: number
  currentUserId: string
  resolveName: (id: string | null) => string
  onNavigateToCert?: (certId: string) => void
  onRemoveTest: (testId: string) => void
}

export function SoldierProfile({
  soldier,
  certs,
  tests,
  readinessPercent,
  currentUserId,
  resolveName,
  onNavigateToCert,
  onRemoveTest,
}: SoldierProfileProps) {
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

  const passCount = useMemo(() =>
    tests.filter(r => r.result === 'GO').length,
  [tests])

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-lg font-semibold text-primary">{formatMedicName(soldier)}</p>
        {soldier.credential && (
          <p className="text-xs text-tertiary/50">{soldier.credential}</p>
        )}
      </div>

      {/* Stat Strip */}
      <div className="flex items-center gap-4 px-1">
        <div>
          <p className={`text-lg font-bold ${readinessTextColor(readinessPercent)}`}>{readinessPercent}%</p>
          <p className="text-[10px] text-tertiary/50 uppercase tracking-wide">Readiness</p>
        </div>
        <div className="w-px h-8 bg-tertiary/10" />
        <div>
          <p className="text-lg font-bold text-primary">{validCertCount}<span className="text-tertiary/40">/{certs.length}</span></p>
          <p className="text-[10px] text-tertiary/50 uppercase tracking-wide">Certs Valid</p>
        </div>
        <div className="w-px h-8 bg-tertiary/10" />
        <div>
          <p className="text-lg font-bold text-primary">{passCount}<span className="text-tertiary/40">/{tests.length}</span></p>
          <p className="text-[10px] text-tertiary/50 uppercase tracking-wide">Tests Passed</p>
        </div>
      </div>

      {/* Section 1: Certifications */}
      <div>
        <p className="text-xs font-semibold text-tertiary/60 uppercase tracking-wider mb-2">
          Certifications
        </p>
        {certs.length === 0 ? (
          <p className="text-sm text-tertiary/40 py-3">No certifications on file</p>
        ) : (
          <div className="space-y-1.5">
            {sortedCerts.map((cert) => {
              const status = getExpirationStatus(cert.exp_date)
              return (
                <button
                  key={cert.id}
                  onClick={() => onNavigateToCert?.(cert.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-themewhite2 text-left hover:bg-themewhite2/80 active:scale-95 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-primary truncate">{cert.title}</p>
                      {cert.is_primary && (
                        <span className="text-[9px] font-medium text-themeblue2 bg-themeblue2/10 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">Primary</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-tertiary/50">
                      {cert.cert_number && <span>#{cert.cert_number}</span>}
                      {cert.exp_date && <span>Exp: {new Date(cert.exp_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium shrink-0 ${
                    status === 'valid' ? 'text-themegreen' : status === 'expiring' ? 'text-themeyellow' : status === 'expired' ? 'text-themeredred' : 'text-tertiary/40'
                  }`}>
                    {status === 'valid' ? 'Valid' : status === 'expiring' ? 'Expiring' : status === 'expired' ? 'Expired' : 'No Date'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Section 2: Completed Training */}
      <div>
        <p className="text-xs font-semibold text-tertiary/60 uppercase tracking-wider mb-2">
          Training History
        </p>
        {tests.length === 0 ? (
          <p className="text-sm text-tertiary/40 py-3">No test records yet</p>
        ) : (
          <div className="space-y-2">
            {sortedTests.map((record) => {
              const isExpanded = expandedTestId === record.id
              const taskTitle = getTaskData(record.trainingItemId)?.title ?? record.trainingItemId
              const overallResult = record.result === 'GO' ? 'PASS' : 'FAIL'

              return (
                <div key={record.id} className="rounded-lg border border-tertiary/10 bg-themewhite2 overflow-hidden">
                  <button
                    onClick={() => setExpandedTestId(isExpanded ? null : record.id)}
                    className="flex items-center w-full px-4 py-3 text-left hover:bg-themewhite2/80 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{taskTitle}</p>
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
        )}
      </div>
    </div>
  )
}
