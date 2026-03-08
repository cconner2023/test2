/**
 * AdminClinicsList -- swipeable card list for clinic management.
 *
 * Displays clinics with search, multi-select, swipe-to-edit/delete,
 * right-click context menu, and batch delete via CardActionBar.
 * Extracted from the ClinicsTab list view in AdminPanel.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Check, Search, Plus, Pencil, Trash2, Building2, MapPin, Eye } from 'lucide-react'
import { SwipeableCard } from '../SwipeableCard'
import { CardContextMenu } from '../CardContextMenu'
import { CardActionBar } from '../CardActionBar'
import { ConfirmDialog } from '../ConfirmDialog'
import { LoadingSpinner } from '../LoadingSpinner'
import { StatusBanner } from '../Settings/StatusBanner'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { listClinics, listAllUsers, deleteClinic } from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'
import { UI_TIMING } from '../../Utilities/constants'

interface AdminClinicsListProps {
  onSelectClinic: (clinic: AdminClinic) => void
  onEditClinic: (clinic: AdminClinic) => void
  onCreateClinic: () => void
  filterClinicId?: string | null
}

export function AdminClinicsList({
  onSelectClinic,
  onEditClinic,
  onCreateClinic,
  filterClinicId,
}: AdminClinicsListProps) {
  // ── Data state ──────────────────────────────────────────────
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const showLoading = useMinLoadTime(loading)
  const [searchQuery, setSearchQuery] = useState('')

  // ── Selection state ─────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const multiSelectMode = selectedIds.size > 0

  // ── Swipe + context menu state ──────────────────────────────
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ clinicId: string; x: number; y: number } | null>(null)

  // ── Delete state ────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; label: string } | null>(null)
  const [deleteProcessing, setDeleteProcessing] = useState(false)

  // ── Feedback state ──────────────────────────────────────────
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Clear status banner after a delay
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

  /** Count users assigned to a clinic */
  const usersInClinic = useCallback(
    (clinicId: string) => users.filter((u) => u.clinic_id === clinicId),
    [users],
  )

  /** Filter clinics by search query and optional tree-selected ID */
  const filteredClinics = useMemo(() => {
    return clinics.filter((c) => {
      // If filterClinicId is provided, restrict to that single clinic
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
    setOpenSwipeId(null)
    setDeleteTarget({ ids: [clinic.id], label: clinic.name })
  }

  const confirmDeleteBatch = () => {
    const ids = Array.from(selectedIds)
    const count = ids.length
    setDeleteTarget({ ids, label: `${count} clinic${count !== 1 ? 's' : ''}` })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteProcessing(true)

    const results = await Promise.all(deleteTarget.ids.map((id) => deleteClinic(id)))
    const failures = results.filter((r) => !r.success)

    setDeleteProcessing(false)
    setDeleteTarget(null)
    setSelectedIds(new Set())

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

  // ── Tap handler ─────────────────────────────────────────────

  const handleTap = (clinic: AdminClinic) => {
    if (multiSelectMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(clinic.id)) next.delete(clinic.id)
        else next.add(clinic.id)
        return next
      })
      return
    }

    setOpenSwipeId(null)

    // Single-tap: toggle selection (shows action bar)
    const isTogglingOff = selectedIds.has(clinic.id)
    setSelectedIds(isTogglingOff ? new Set() : new Set([clinic.id]))
    onSelectClinic(clinic)
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header: subtitle + create button + search */}
      <div className="shrink-0 px-5 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-tertiary/60">Manage clinics</p>
          <button
            onClick={onCreateClinic}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-themegreen text-white text-sm font-medium hover:bg-themegreen/90 transition-colors"
          >
            <Plus size={14} /> Create Clinic
          </button>
        </div>

        {/* Feedback banner */}
        {status && <StatusBanner type={status.type} message={status.message} />}

        {/* Search bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, location, or UIC..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-sm
                       border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors placeholder:text-tertiary/30"
          />
        </div>
      </div>

      {/* Card list — scrollable */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {showLoading ? (
          <LoadingSpinner label="Loading clinics..." className="py-12 text-tertiary" />
        ) : filteredClinics.length === 0 ? (
          <div className="text-center py-12">
            <Building2 size={28} className="mx-auto mb-3 text-tertiary/30" />
            <p className="text-tertiary/60">
              {searchQuery ? 'No clinics match your search' : 'No clinics found'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredClinics.map((clinic) => {
              const assignedUsers = usersInClinic(clinic.id)
              const isSelected = selectedIds.has(clinic.id)

              const swipeActions = [
                {
                  key: 'view',
                  label: 'View',
                  icon: Eye,
                  iconBg: 'bg-themegreen/15',
                  iconColor: 'text-themegreen',
                  onAction: () => onSelectClinic(clinic),
                },
                {
                  key: 'edit',
                  label: 'Edit',
                  icon: Pencil,
                  iconBg: 'bg-themeblue2/15',
                  iconColor: 'text-themeblue2',
                  onAction: () => onEditClinic(clinic),
                },
                {
                  key: 'delete',
                  label: 'Delete',
                  icon: Trash2,
                  iconBg: 'bg-themeredred/15',
                  iconColor: 'text-themeredred',
                  onAction: () => confirmDeleteSingle(clinic),
                },
              ]

              return (
                <SwipeableCard
                  key={clinic.id}
                  isOpen={openSwipeId === clinic.id}
                  enabled={!multiSelectMode}
                  actions={swipeActions}
                  onOpen={() => setOpenSwipeId(clinic.id)}
                  onClose={() => { if (openSwipeId === clinic.id) setOpenSwipeId(null) }}
                  onTap={() => handleTap(clinic)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ clinicId: clinic.id, x: e.clientX, y: e.clientY })
                  }}
                >
                  <div
                    className={`rounded-xl border px-4 py-3.5 transition-colors ${
                      isSelected
                        ? 'border-themeblue2/30 bg-themeblue2/5'
                        : 'border-tertiary/15 bg-themewhite2'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isSelected ? (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeblue2">
                          <Check size={16} className="text-white" />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                          <Building2 size={18} className="text-tertiary/50" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-primary truncate">{clinic.name}</p>
                        {clinic.location && (
                          <p className="text-[9pt] text-tertiary/50 flex items-center gap-1">
                            <MapPin size={10} /> {clinic.location}
                          </p>
                        )}
                      </div>

                      <span className="shrink-0 px-2 py-0.5 rounded text-[9px] font-medium border bg-themeblue2/10 text-themeblue2 border-themeblue2/30">
                        {assignedUsers.length} user{assignedUsers.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {clinic.uics.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mt-2">
                        {clinic.uics.map((uic) => (
                          <span
                            key={uic}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border bg-themeyellow/10 text-themeyellow border-themeyellow/30"
                          >
                            {uic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </SwipeableCard>
              )
            })}
          </div>
        )}
      </div>

      {/* Multi-select action bar — pinned at bottom, outside scroll */}
      {multiSelectMode && (
        <div className="shrink-0">
          <CardActionBar
            selectedCount={selectedIds.size}
            onClear={() => setSelectedIds(new Set())}
            actions={[
              {
                key: 'delete',
                label: 'Delete',
                icon: Trash2,
                iconBg: 'bg-themeredred/15',
                iconColor: 'text-themeredred',
                onAction: confirmDeleteBatch,
              },
            ]}
          />
        </div>
      )}

      {/* Context menu (right-click) */}
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

      {/* Delete confirmation dialog */}
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
