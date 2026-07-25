import { useState, useCallback, useMemo, useRef } from 'react'
import { ChevronRight, ClipboardList, Plus, Check, Trash2, Loader2 } from 'lucide-react'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { PreviewOverlay } from '../../PreviewOverlay'
import { getTaskData, isTaskTestable } from '../../../Data/TrainingData'
import { deleteCompletion as deleteCompletionApi } from '../../../lib/trainingService'
import {
  adminAddCertification,
  updateCertification,
  adminDeleteCertification,
  syncPrimaryToProfile,
  type CertInput,
} from '../../../lib/certificationService'
import { CertOverlayFields } from '../../Certifications/CertOverlayFields'
import { useIsMobile } from '../../../Hooks/useIsMobile'
import { formatMedicName, getLatestTestByTask, buildAlgorithmCompetency } from './supervisorHelpers'
import { getExpirationStatus, emptyCertForm, type CertFormData } from '../../Certifications/certHelpers'
import { FillBar } from '@/Components/primitives/FillBar'
import type { FlatTask } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { Certification } from '../../../Data/User'
import type { TrainingCompletionUI } from '../../../lib/trainingService'
import { createLogger } from '../../../Utilities/Logger'
import { ActionPill } from '@/Components/primitives/ActionPill'
import { UserTimeline, type TimelineRowData } from '../../Timeline/UserTimeline'

const logger = createLogger('SoldierProfile')

interface SoldierProfileProps {
  soldier: ClinicMedic
  certs: Certification[]
  tests: TrainingCompletionUI[]
  assignments: TrainingCompletionUI[]
  readinessPercent: number
  compliancePercent: number
  currentUserId: string
  resolveName: (id: string | null) => string
  onUpdateCert: (certId: string, updates: Partial<Certification>) => void
  onAddCert?: (cert: Certification) => void
  onRemoveCert?: (certId: string) => void
  onRemoveTest: (testId: string) => void
  testableTaskMap: Map<string, FlatTask[]>
  onNavigateToArea?: (areaName: string) => void
  /** Timeline rows for this soldier — fetched once by the host (SupervisorDrawer)
   *  and shared with the timeline pane, so the card preview doesn't re-fetch. */
  timelineRows: TimelineRowData[]
  timelineLoading: boolean
  /** When provided, the soldier card becomes tap-to-edit (rank/roles/delete via popover) */
  onEditMember?: (memberId: string, anchorRect: DOMRect) => void
  /** Drill into the grouped per-algorithm competency list for this soldier. */
  onOpenAlgorithms?: () => void
  /** Desktop only: open the full timeline in the supervisor's third pane. When
   *  absent (mobile), the timeline falls back to its own bottom Sheet. */
  onViewAllTimeline?: () => void
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
  onUpdateCert,
  onAddCert,
  onRemoveCert,
  onRemoveTest,
  testableTaskMap,
  onNavigateToArea,
  timelineRows,
  timelineLoading,
  onEditMember,
  onOpenAlgorithms,
  onViewAllTimeline,
}: SoldierProfileProps) {
  const isMobile = useIsMobile()
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ─── Cert popover state (tap-to-edit, immediate save) ────────────────
  const certFabRef = useRef<HTMLDivElement | null>(null)
  const [certPopover, setCertPopover] = useState<{ mode: 'edit' | 'new'; anchor: DOMRect; cert?: Certification } | null>(null)
  const [certForm, setCertForm] = useState<CertFormData>(emptyCertForm)
  const [certSaving, setCertSaving] = useState(false)
  const [confirmDeleteCert, setConfirmDeleteCert] = useState<Certification | null>(null)

  const closeCertPopover = useCallback(() => {
    setCertPopover(null)
    setCertForm(emptyCertForm)
    setCertSaving(false)
  }, [])

  const openCertEditPopover = useCallback((cert: Certification, target: HTMLElement) => {
    setCertPopover({ mode: 'edit', anchor: target.getBoundingClientRect(), cert })
    setCertForm({
      title: cert.title,
      cert_number: cert.cert_number ?? '',
      issue_date: cert.issue_date ?? '',
      exp_date: cert.exp_date ?? '',
      is_primary: cert.is_primary,
    })
  }, [])

  const openCertNewPopover = useCallback(() => {
    if (!certFabRef.current) return
    setCertPopover({ mode: 'new', anchor: certFabRef.current.getBoundingClientRect() })
    setCertForm(emptyCertForm)
  }, [])

  const handleSaveCert = useCallback(async () => {
    if (!certPopover || !certForm.title.trim()) return
    setCertSaving(true)
    const input: CertInput = {
      title: certForm.title.trim(),
      cert_number: certForm.cert_number || null,
      issue_date: certForm.issue_date || null,
      exp_date: certForm.exp_date || null,
      is_primary: certForm.is_primary,
    }

    if (certPopover.mode === 'new') {
      const result = await adminAddCertification(soldier.id, input)
      if (result.success) {
        const nowIso = new Date().toISOString()
        const synthetic: Certification = {
          id: crypto.randomUUID(),
          user_id: soldier.id,
          title: input.title,
          cert_number: input.cert_number,
          issue_date: input.issue_date,
          exp_date: input.exp_date,
          is_primary: input.is_primary,
          verified: false,
          verified_by: null,
          verified_at: null,
          created_at: nowIso,
          updated_at: nowIso,
        }
        onAddCert?.(synthetic)
        if (input.is_primary) await syncPrimaryToProfile(soldier.id)
        closeCertPopover()
      } else {
        setCertSaving(false)
      }
    } else if (certPopover.cert) {
      const target = certPopover.cert
      const result = await updateCertification(target.id, input)
      if (result.success) {
        onUpdateCert(target.id, {
          title: input.title,
          cert_number: input.cert_number,
          issue_date: input.issue_date,
          exp_date: input.exp_date,
          is_primary: input.is_primary,
        })
        if (input.is_primary) await syncPrimaryToProfile(soldier.id)
        closeCertPopover()
      } else {
        setCertSaving(false)
      }
    }
  }, [certPopover, certForm, soldier.id, onAddCert, onUpdateCert, closeCertPopover])

  // Loan state from the viewer's perspective — drives the header badge only.
  // The loan/transfer/remove actions themselves live in MemberEditPopover.
  const loanState: 'loaned-in' | 'loaned-out' | 'home' =
    soldier.isLoanedIn ? 'loaned-in'
    : soldier.surrogateClinicId ? 'loaned-out'
    : 'home'

  const handleConfirmDeleteCert = useCallback(async () => {
    if (!confirmDeleteCert) return
    setCertSaving(true)
    const result = await adminDeleteCertification(confirmDeleteCert.id, soldier.id, confirmDeleteCert.is_primary)
    setCertSaving(false)
    if (result.success) {
      onRemoveCert?.(confirmDeleteCert.id)
      setConfirmDeleteCert(null)
      closeCertPopover()
    }
  }, [confirmDeleteCert, soldier.id, onRemoveCert, closeCertPopover])

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

  /** Per-algorithm composite competency for this soldier (STP + algorithm run). */
  const algorithmCompetency = useMemo(() => buildAlgorithmCompetency(tests), [tests])
  const algorithmTrainedCount = useMemo(
    () => algorithmCompetency.filter(a => a.status === 'trained').length,
    [algorithmCompetency],
  )
  // Team Coverage Gaps shows Algorithms as one row whose % is the mean across
  // the per-algorithm scores. Mirror that here so the soldier-level "Algorithms"
  // row reads the same as its subject-area peers.
  const algorithmsAggregatePercent = useMemo(() => {
    if (algorithmCompetency.length === 0) return 0
    return Math.round(algorithmCompetency.reduce((s, a) => s + a.pct, 0) / algorithmCompetency.length)
  }, [algorithmCompetency])

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
      {/* Soldier Card — tap-to-edit (rank/roles/delete) when onEditMember provided */}
      <button
        type="button"
        disabled={!onEditMember}
        onClick={(e) => onEditMember?.(soldier.id, e.currentTarget.getBoundingClientRect())}
        className="w-full text-left rounded-xl bg-themewhite2 px-4 py-3 enabled:hover:bg-secondary/5 enabled:active:scale-[0.99] disabled:cursor-default transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{formatMedicName(soldier)}</p>
            <p className="text-[9pt] text-tertiary truncate">
              {validCertCount}/{certs.length} certs valid
              {loanState === 'loaned-in' && (
                <span className="text-themeblue2"> · Loaned in{soldier.clinicName ? ` from ${soldier.clinicName}` : ''}</span>
              )}
              {loanState === 'loaned-out' && (
                <span className="text-themeyellow"> · Loaned out</span>
              )}
            </p>
          </div>
          <div className="shrink-0 w-48 flex flex-col gap-1.5">
            <FillBar label="Readiness" percent={readinessPercent} />
            <FillBar label="Compliance" percent={compliancePercent} />
          </div>
        </div>
      </button>

      {/* Assignments */}
      {assignments.length > 0 && (
        <div>
          <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
            Assignments
          </p>
          <div className="rounded-2xl bg-themewhite2 overflow-hidden">
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

      {/* Timeline — the single time-ordered spine: audit_log lifecycle (training,
          certs) merged with calendar-sourced rows — upcoming events (the old
          "Schedule") above the now-divider, logged algorithm encounters (the
          old "Encounter Log") below. */}
      <UserTimeline
        rows={timelineRows}
        rowsLoading={timelineLoading}
        onViewAll={onViewAllTimeline}
      />

      {/* Certifications */}
      <div>
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
          Certifications
        </p>
        <div className="relative"><div className="rounded-2xl bg-themewhite2 overflow-hidden">
          {certs.length === 0 ? (
            <div className="px-4 py-4">
              <p className="text-sm text-tertiary">No certifications on file</p>
            </div>
          ) : (
            <div>
              {sortedCerts.map((cert) => {
                const status = getExpirationStatus(cert.exp_date)
                return (
                  <button
                    key={cert.id}
                    onClick={(e) => openCertEditPopover(cert, e.currentTarget)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-themeblue2/5 active:scale-95 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{cert.title}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-[10pt] text-tertiary">
                        {cert.is_primary && <span className="text-themeblue2 font-medium">Primary</span>}
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
          <ActionPill ref={certFabRef} shadow="sm" placement="overlay">
            <ActionButton icon={Plus} label="Add certification" onClick={openCertNewPopover} />
          </ActionPill>
        </div>
      </div>

      {/* Training Competency by Category */}
      <div>
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
          Training Competency
        </p>
        {categoryCompetency.length === 0 && algorithmCompetency.length === 0 ? (
          <div className="rounded-2xl bg-themewhite2 overflow-hidden px-4 py-4">
            <p className="text-sm text-tertiary">No testable tasks available</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-themewhite2 overflow-hidden">
            {categoryCompetency.map((cat) => (
              <button
                key={cat.areaName}
                onClick={() => onNavigateToArea?.(cat.areaName)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-themeblue2/5 active:scale-95 transition-all"
              >
                <span className="text-sm text-primary min-w-0 truncate shrink-0 w-36">
                  {cat.areaName}
                </span>
                <FillBar className="flex-1 min-w-0" percent={cat.pct} value={`${cat.passed}/${cat.total}`} />
                <ChevronRight size={14} className="text-tertiary shrink-0" />
              </button>
            ))}

            {/* Algorithms — composite competency treated as a training category
                (peer of subject areas), mirroring the team Coverage Gaps row.
                Drills into the grouped per-algorithm list (SoldierAlgorithmList). */}
            {algorithmCompetency.length > 0 && (
              <button
                onClick={onOpenAlgorithms}
                disabled={!onOpenAlgorithms}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-themeblue2/5 active:scale-95 transition-all disabled:active:scale-100"
              >
                <span className="text-sm font-medium text-primary min-w-0 truncate shrink-0 w-36">
                  Algorithms
                </span>
                <FillBar
                  className="flex-1 min-w-0"
                  percent={algorithmsAggregatePercent}
                  value={`${algorithmTrainedCount}/${algorithmCompetency.length}`}
                />
                <ChevronRight size={14} className="text-tertiary shrink-0" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Training History */}
      <div>
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
          Training History
        </p>
        {tests.length === 0 ? (
          <div className="rounded-2xl bg-themewhite2 overflow-hidden px-4 py-4">
            <p className="text-[10pt] text-tertiary">No test records yet</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-themewhite2 overflow-hidden">
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
                    <span className={`shrink-0 ml-2 px-3 py-1 rounded-full text-[10pt] font-bold ${
                      overallResult === 'PASS' ? 'bg-themegreen/15 text-themegreen' : 'bg-themeredred/15 text-themeredred'
                    }`}>
                      {overallResult}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-3 border-t border-tertiary/10">
                      <div className="mt-3 mb-2">
                        <p className="text-[9pt] text-tertiary font-mono">{record.trainingItemId}</p>
                        <p className="text-[10pt] text-tertiary mt-1">
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
                          className="mt-3 text-[10pt] text-themeredred hover:underline"
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

      {/* Cert popover — tap row to edit, FAB to add (immediate save) */}
      <PreviewOverlay
        isOpen={!!certPopover}
        onClose={closeCertPopover}
        anchorRect={certPopover?.anchor ?? null}
        title={certPopover?.mode === 'new' ? 'New certification' : 'Edit certification'}
        maxWidth={380}
        footer={
          certPopover?.mode === 'edit' ? (
            <FooterPill>
              <ActionButton
                icon={Trash2}
                label="Delete"
                variant="danger"
                onClick={() => certPopover.cert && setConfirmDeleteCert(certPopover.cert)}
              />
            </FooterPill>
          ) : undefined
        }
        rightFooter={
          certPopover ? (
            <FooterPill side="right">
              <ActionButton
                icon={certSaving ? Loader2 : Check}
                label={certSaving ? 'Saving…' : 'Save'}
                variant={certSaving || !certForm.title.trim() ? 'disabled' : 'confirm'}
                onClick={handleSaveCert}
              />
            </FooterPill>
          ) : undefined
        }
      >
        {certPopover && (
          <CertOverlayFields
            form={certForm}
            setForm={setCertForm}
            isMobile={isMobile}
            datalistId="soldier-cert-title-suggestions"
          />
        )}
      </PreviewOverlay>

      <ConfirmDialog
        visible={!!confirmDeleteCert}
        title="Delete this certification?"
        subtitle={confirmDeleteCert?.is_primary ? 'This is the primary credential — the soldier profile will fall back to no credential.' : undefined}
        confirmLabel="Delete"
        variant="danger"
        processing={certSaving}
        onConfirm={handleConfirmDeleteCert}
        onCancel={() => setConfirmDeleteCert(null)}
      />

    </div>
  )
}
