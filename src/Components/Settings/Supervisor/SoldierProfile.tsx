import { useState, useCallback, useMemo, useRef } from 'react'
import { Building2, ChevronRight, ClipboardList, Calendar, Plus, Check, Trash2, Loader2 } from 'lucide-react'
import { ActionButton } from '../../ActionButton'
import { ConfirmDialog } from '../../ConfirmDialog'
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
import { formatMedicName, getLatestTestByTask } from './supervisorHelpers'
import { getExpirationStatus, emptyCertForm, type CertFormData } from '../../Certifications/certHelpers'
import type { FlatTask } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { Certification } from '../../../Data/User'
import type { TrainingCompletionUI } from '../../../lib/trainingService'
import type { CalendarEvent } from '../../../Types/CalendarTypes'
import { getCategoryMeta } from '../../../Types/CalendarTypes'
import { createLogger } from '../../../Utilities/Logger'
import { ActionPill } from '../../ActionPill'

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
  onUpdateCert: (certId: string, updates: Partial<Certification>) => void
  onAddCert?: (cert: Certification) => void
  onRemoveCert?: (certId: string) => void
  onRemoveTest: (testId: string) => void
  testableTaskMap: Map<string, FlatTask[]>
  onNavigateToArea?: (areaName: string) => void
  calendarEvents: CalendarEvent[]
  onOpenCalendar: () => void
  /** When provided, the soldier card becomes tap-to-edit (rank/roles/delete via popover) */
  onEditMember?: (memberId: string, anchorRect: DOMRect) => void
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
  calendarEvents,
  onOpenCalendar,
  onEditMember,
}: SoldierProfileProps) {
  const isMobile = useIsMobile()
  const now = useMemo(() => new Date(), [])
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
        data-tour="supervisor-soldier-card"
        disabled={!onEditMember}
        onClick={(e) => onEditMember?.(soldier.id, e.currentTarget.getBoundingClientRect())}
        className="w-full text-left rounded-xl bg-themewhite2 px-4 py-3 enabled:hover:bg-secondary/5 enabled:active:scale-[0.99] disabled:cursor-default transition-all"
      >
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
      </button>

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
              <ActionPill shadow="sm">
                <ActionButton icon={Calendar} label="Open full calendar" onClick={onOpenCalendar} />
              </ActionPill>
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
                <ActionPill shadow="sm">
                  <ActionButton icon={Calendar} label="View in calendar" onClick={onOpenCalendar} />
                </ActionPill>
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
        <div className="relative rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden pb-12">
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
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-primary truncate">{cert.title}</p>
                        {cert.is_primary && (
                          <span className="text-[9pt] md:text-[9pt] font-medium text-themeblue2 bg-themeblue2/10 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">Primary</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10pt] text-tertiary">
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
          <ActionPill ref={certFabRef} shadow="sm" className="absolute bottom-2 right-2">
            <ActionButton icon={Plus} label="Add certification" onClick={openCertNewPopover} />
          </ActionPill>
        </div>
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
          certPopover ? (
            <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
              <ActionButton
                icon={certSaving ? Loader2 : Check}
                label={certSaving ? 'Saving…' : 'Save'}
                variant={certSaving || !certForm.title.trim() ? 'disabled' : 'success'}
                onClick={handleSaveCert}
              />
              {certPopover.mode === 'edit' && (
                <ActionButton
                  icon={Trash2}
                  label="Delete"
                  variant="danger"
                  onClick={() => certPopover.cert && setConfirmDeleteCert(certPopover.cert)}
                />
              )}
            </div>
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
