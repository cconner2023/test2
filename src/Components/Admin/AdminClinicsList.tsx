import { useState, useEffect, useCallback, useMemo } from 'react'
import { Pencil, Trash2, Building2, Eye, ChevronRight } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { LoadingSpinner } from '../LoadingSpinner'
import { ErrorDisplay } from '../ErrorDisplay'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { useLongPress } from '../../Hooks/useLongPress'
import { listClinics, listAllUsers, deleteClinic } from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { UI_TIMING } from '../../Utilities/constants'

interface AdminClinicsListProps {
  onSelectClinic: (clinic: AdminClinic) => void
  onEditClinic: (clinic: AdminClinic) => void
  onCreateClinic: () => void
  filterClinicId?: string | null
  searchQuery?: string
  /** When true, renders items without wrapper chrome (for unified search results) */
  bare?: boolean
}

export function AdminClinicsList({
  onSelectClinic,
  onEditClinic,
  onCreateClinic,
  filterClinicId,
  searchQuery: searchQueryProp,
  bare,
}: AdminClinicsListProps) {
  const searchQuery = searchQueryProp ?? ''
  const gen = useInvalidation('clinics', 'users')

  // ── Data state ──────────────────────────────────────────────
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const showLoading = useMinLoadTime(loading)

  // ── Context menu state ──────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{ clinicId: string; x: number; y: number } | null>(null)

  // ── Delete state ────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; label: string } | null>(null)
  const [deleteProcessing, setDeleteProcessing] = useState(false)

  // ── Feedback state ──────────────────────────────────────────
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), UI_TIMING.FEEDBACK_DURATION)
    return () => clearTimeout(t)
  }, [status])

  // ── Data loading ────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    const [clinicData, userData] = await Promise.all([listClinics(), listAllUsers()])
    setClinics(clinicData)
    setUsers(userData)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData, gen])

  // ── Derived data ────────────────────────────────────────────

  const usersInClinic = useCallback(
    (clinicId: string) => users.filter((u) => u.clinic_id === clinicId),
    [users],
  )

  const filteredClinics = useMemo(() => {
    return clinics.filter((c) => {
      if (filterClinicId && c.id !== filterClinicId) return false
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        c.name.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q) ||
        c.uics.some((uic) => uic.toLowerCase().includes(q))
      )
    })
  }, [clinics, searchQuery, filterClinicId])

  // ── Delete handlers ─────────────────────────────────────────

  const confirmDeleteSingle = (clinic: AdminClinic) => {
    setDeleteTarget({ ids: [clinic.id], label: clinic.name })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteProcessing(true)

    const results = await Promise.all(deleteTarget.ids.map((id) => deleteClinic(id)))
    const failures = results.filter((r) => !r.success)

    setDeleteProcessing(false)
    setDeleteTarget(null)

    if (failures.length === 0) {
      setStatus({ type: 'success', message: 'Deleted.' })
    } else {
      setStatus({ type: 'error', message: `Failed to delete ${failures.length} clinic(s)` })
    }

    await loadData()
  }

  const handleDeleteCancel = () => {
    setDeleteTarget(null)
  }

  // ── Shared: render clinic row items ─────────────────────
  const renderClinicItems = () => filteredClinics.map((clinic) => {
    const assignedUsers = usersInClinic(clinic.id)
    return (
      <ClinicCard
        key={clinic.id}
        clinic={clinic}
        assignedUserCount={assignedUsers.length}
        onTap={() => onSelectClinic(clinic)}
        onContextMenu={(x, y) => setContextMenu({ clinicId: clinic.id, x, y })}
      />
    )
  })

  // ── Shared: overlays ──────────────────────────────────────
  const renderOverlays = () => (
    <>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              key: 'view',
              label: 'View',
              icon: Eye,
              onAction: () => {
                const clinic = clinics.find((c) => c.id === contextMenu.clinicId)
                if (clinic) onSelectClinic(clinic)
              },
            },
            {
              key: 'edit',
              label: 'Edit',
              icon: Pencil,
              onAction: () => {
                const clinic = clinics.find((c) => c.id === contextMenu.clinicId)
                if (clinic) onEditClinic(clinic)
              },
            },
            {
              key: 'delete',
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              onAction: () => {
                const clinic = clinics.find((c) => c.id === contextMenu.clinicId)
                if (clinic) confirmDeleteSingle(clinic)
              },
            },
          ]}
        />
      )}

      <ConfirmDialog
        visible={deleteTarget !== null}
        title={`Delete ${deleteTarget?.label ?? ''}?`}
        subtitle="Permanent."
        confirmLabel="Delete"
        variant="danger"
        processing={deleteProcessing}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </>
  )

  // ── Bare mode: just the items (no wrapper chrome) ──────
  if (bare) {
    if (filteredClinics.length === 0) return null
    return (
      <>
        {renderClinicItems()}
        {renderOverlays()}
      </>
    )
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="pb-24">
      <div className="px-5 pt-4 pb-2 space-y-5">
        {status && <ErrorDisplay type={status.type} message={status.message} />}
      </div>

      <div className="px-5 pb-4">
        {showLoading ? (
          <LoadingSpinner label="Loading clinics..." className="py-12 text-tertiary" />
        ) : filteredClinics.length === 0 ? (
          <EmptyState
            icon={<Building2 size={28} />}
            title={searchQuery ? 'No matches.' : 'No clinics.'}
          />
        ) : (
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
            {renderClinicItems()}
          </div>
        )}
      </div>

      {renderOverlays()}
    </div>
  )
}

// ── ClinicCard ───────────────────────────────────────────────

interface ClinicCardProps {
  clinic: AdminClinic
  assignedUserCount: number
  onTap: () => void
  onContextMenu: (x: number, y: number) => void
}

function ClinicCard({ clinic, assignedUserCount, onTap, onContextMenu }: ClinicCardProps) {
  const longPressHandlers = useLongPress((x, y) => onContextMenu(x, y))

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onTap}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onTap() }}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e.clientX, e.clientY)
      }}
      {...longPressHandlers}
      className="flex items-center gap-3 px-4 py-3.5 transition-all active:scale-95 hover:bg-themeblue2/5 cursor-pointer select-none"
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
        <Building2 size={16} className="text-tertiary" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">{clinic.name}</p>
        <p className="text-[9pt] text-tertiary mt-0.5 truncate">
          {[clinic.location, clinic.uics.length > 0 ? clinic.uics.join(' · ') : null].filter(Boolean).join(' — ')}
        </p>
      </div>

      <span className="text-[9pt] text-tertiary shrink-0">
        {assignedUserCount} user{assignedUserCount !== 1 ? 's' : ''}
      </span>
      <ChevronRight size={16} className="text-tertiary shrink-0" />
    </div>
  )
}
