import { useState, useCallback } from 'react'
import { X, Star, CheckCircle, AlertTriangle, Clock, Award } from 'lucide-react'
import { getTaskData } from '../../../Data/TrainingData'
import { verifyCertification, unverifyCertification } from '../../../lib/certificationService'
import { deleteCompletion as deleteCompletionApi } from '../../../lib/trainingService'
import { formatMedicName, getExpirationStatus, certBadgeColors } from './supervisorHelpers'
import { UserAvatar } from '../UserAvatar'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { Certification } from '../../../Data/User'
import type { TrainingCompletionUI } from '../../../lib/trainingService'
import { createLogger } from '../../../Utilities/Logger'

const logger = createLogger('SoldierProfile')

interface SoldierProfileProps {
  soldier: ClinicMedic
  certs: Certification[]
  tests: TrainingCompletionUI[]
  overdueItems: { expiredCerts: Certification[]; failedTests: TrainingCompletionUI[] }
  currentUserId: string
  resolveName: (id: string | null) => string
  onUpdateCert: (certId: string, updates: Partial<Certification>) => void
  onRemoveTest: (testId: string) => void
}

export function SoldierProfile({
  soldier,
  certs,
  tests,
  overdueItems,
  currentUserId,
  resolveName,
  onUpdateCert,
  onRemoveTest,
}: SoldierProfileProps) {
  const [expandedCertId, setExpandedCertId] = useState<string | null>(null)
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleVerify = useCallback(async (certId: string) => {
    const result = await verifyCertification(certId, currentUserId)
    if (result.success) {
      onUpdateCert(certId, {
        verified: true,
        verified_by: currentUserId,
        verified_at: new Date().toISOString(),
      })
    }
  }, [currentUserId, onUpdateCert])

  const handleUnverify = useCallback(async (certId: string) => {
    const result = await unverifyCertification(certId)
    if (result.success) {
      onUpdateCert(certId, {
        verified: false,
        verified_by: null,
        verified_at: null,
      })
    }
  }, [onUpdateCert])

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

  const { expiredCerts, failedTests } = overdueItems
  const hasOverdue = expiredCerts.length > 0 || failedTests.length > 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <UserAvatar avatarId={soldier.avatarId} firstName={soldier.firstName} lastName={soldier.lastName} className="w-12 h-12" />
        <div>
          <p className="text-lg font-semibold text-primary">{formatMedicName(soldier)}</p>
          {soldier.credential && (
            <p className="text-xs text-tertiary/50">{soldier.credential}</p>
          )}
        </div>
      </div>

      {/* Section 1: Certifications */}
      <div>
        <p className="text-[9pt] font-semibold text-tertiary/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Award size={13} /> Certifications
        </p>
        {certs.length === 0 ? (
          <p className="text-sm text-tertiary/40 py-3">No certifications on file</p>
        ) : (
          <div className="space-y-2">
            {/* Badge row */}
            <div className="flex flex-wrap items-center gap-1.5">
              {certs.map((cert) => {
                const status = getExpirationStatus(cert.exp_date)
                const color = certBadgeColors[status]
                return (
                  <button key={cert.id} onClick={() => setExpandedCertId(expandedCertId === cert.id ? null : cert.id)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-colors ${color} ${expandedCertId === cert.id ? 'ring-1 ring-themeblue2/40' : ''}`}>
                    {cert.title}
                    {cert.is_primary && <Star size={9} className="fill-current" />}
                    {cert.verified && <CheckCircle size={9} />}
                  </button>
                )
              })}
            </div>

            {/* Expanded detail */}
            {expandedCertId && (() => {
              const cert = certs.find(c => c.id === expandedCertId)
              if (!cert) return null
              const verifierName = cert.verified_by ? resolveName(cert.verified_by) : null
              return (
                <div className="rounded-lg border border-tertiary/10 bg-themewhite px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-primary">{cert.title}</p>
                    <button onClick={() => setExpandedCertId(null)} className="text-tertiary/40 hover:text-primary"><X size={14} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-tertiary/60">
                    {cert.cert_number && <div>Cert #: <span className="text-primary">{cert.cert_number}</span></div>}
                    {cert.issue_date && <div>Issued: <span className="text-primary">{new Date(cert.issue_date + 'T00:00:00').toLocaleDateString()}</span></div>}
                    {cert.exp_date && <div>Expires: <span className="text-primary">{new Date(cert.exp_date + 'T00:00:00').toLocaleDateString()}</span></div>}
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-tertiary/5">
                    {cert.verified ? (
                      <>
                        <span className="flex items-center gap-1 text-xs text-themegreen font-medium"><CheckCircle size={11} /> Verified</span>
                        {verifierName && <span className="text-[8pt] text-tertiary/40">by {verifierName}</span>}
                        {cert.verified_at && <span className="text-[8pt] text-tertiary/40">{new Date(cert.verified_at).toLocaleDateString()}</span>}
                        <button onClick={() => handleUnverify(cert.id)}
                          className="text-[9pt] text-tertiary/40 hover:text-themeredred transition-colors ml-auto">
                          Unverify
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-tertiary/50">Unverified</span>
                        <button onClick={() => handleVerify(cert.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-themeblue2 text-white hover:bg-themeblue2/90 transition-colors ml-auto">
                          <CheckCircle size={11} /> Verify
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Section 2: Needs Attention */}
      {hasOverdue && (
        <div>
          <p className="text-[9pt] font-semibold text-tertiary/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-themeredred" /> Needs Attention
          </p>
          <div className="space-y-1.5">
            {expiredCerts.map(cert => {
              const status = getExpirationStatus(cert.exp_date)
              return (
                <div key={cert.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-themeredred/5 border border-themeredred/10">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${status === 'expired' ? 'bg-themeredred/15 text-themeredred' : 'bg-themeyellow/15 text-themeyellow'}`}>
                    {status === 'expired' ? 'EXPIRED' : 'EXPIRING'}
                  </span>
                  <span className="text-sm text-primary">{cert.title}</span>
                  {cert.exp_date && (
                    <span className="text-[9pt] text-tertiary/40 ml-auto">
                      {new Date(cert.exp_date + 'T00:00:00').toLocaleDateString()}
                    </span>
                  )}
                </div>
              )
            })}
            {failedTests.map(test => {
              const taskTitle = getTaskData(test.trainingItemId)?.title ?? test.trainingItemId
              return (
                <div key={test.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-themeredred/5 border border-themeredred/10">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-themeredred/15 text-themeredred">FAIL</span>
                  <span className="text-sm text-primary truncate">{taskTitle}</span>
                  <span className="text-[9pt] text-tertiary/40 ml-auto shrink-0">
                    {new Date(test.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Section 3: Completed Training */}
      <div>
        <p className="text-[9pt] font-semibold text-tertiary/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Clock size={13} /> Training History
        </p>
        {tests.length === 0 ? (
          <p className="text-sm text-tertiary/40 py-3">No test records yet</p>
        ) : (
          <div className="space-y-2">
            {tests.map((record) => {
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
