import { useState, useEffect, useCallback, useMemo } from 'react'
import { Pencil, Trash2, Building2, Eye } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { CardContextMenu } from '../CardContextMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { LoadingSpinner } from '../LoadingSpinner'
import { ErrorDisplay } from '../ErrorDisplay'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { useLongPress } from '../../Hooks/useLongPress'
import { listClinics, listAllUsers, deleteClinic } from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'
import { UI_TIMING } from '../../Utilities/constants'

interface AdminClinicsListProps {
  onSelectClinic: (clinic: AdminClinic) => void
  onEditClinic: (clinic: AdminClinic) => void
  onCreateClinic: () => void
  filterClinicId?: string | null
  searchQuery?: string
}

export function AdminClinicsList({
  onSelectClinic,
  onEditClinic,
  onCreateClinic,
  filterClinicId,
  searchQuery: searchQueryProp,
}: AdminClinicsListProps) {
  const searchQuery = searchQueryProp ?? ''

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

  useEffect(() => { loadData() }, [loadData])

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
      setStatus({ type: 'success', message: `Deleted ${deleteTarget.label} successfully` })
    } else {
      setStatus({ type: 'error', message: `Failed to delete ${failures.length} clinic(s)` })
    }

    await loadData()
  }

  const handleDeleteCancel = () => {
    setDeleteTarget(null)
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div>
      <div className="px-5 pt-4 pb-2 space-y-3">
        <div className="flex items-center">
          <p className="text-sm text-tertiary/60">Manage clinics</p>
        </div>
        {status && <ErrorDisplay type={status.type} message={status.message} />}
      </div>

      <div className="px-5 pb-4">
        {showLoading ? (
          <LoadingSpinner label="Loading clinics..." className="py-12 text-tertiary" />
        ) : filteredClinics.length === 0 ? (
          <EmptyState
            icon={<Building2 size={28} />}
            title={searchQuery ? 'No clinics match your search' : 'No clinics found'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredClinics.map((clinic) => {
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
            })}
          </div>
        )}
      </div>

      {contextMenu && (
        <CardContextMenu
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
        subtitle="This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        processing={deleteProcessing}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
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
  const longPressHandlers = useLongPress(() => {
    // Long-press opens context menu centered on the element; use a fallback position
    onContextMenu(window.innerWidth / 2, window.innerHeight / 2)
  })

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
      className="rounded-xl border px-4 py-3.5 transition-colors active:scale-95 cursor-pointer border-tertiary/15 bg-themewhite2 select-none"
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary truncate">{clinic.name}</p>
          {clinic.location && (
            <p className="text-[10pt] text-tertiary truncate">{clinic.location}</p>
          )}
        </div>

        <span className="text-[10pt] text-tertiary shrink-0">
          {assignedUserCount} user{assignedUserCount !== 1 ? 's' : ''}
        </span>
      </div>

      {clinic.uics.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {clinic.uics.map((uic) => (
            <span
              key={uic}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10pt] font-medium border bg-themeblue2/10 text-themeblue2 border-themeblue2/30"
            >
              {uic}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
