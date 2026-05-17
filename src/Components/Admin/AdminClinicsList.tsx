import { useState, useEffect, useCallback, useMemo } from 'react'
import { Pencil, Trash2, Building2, Eye, ChevronRight } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { SectionCard } from '../Section'
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { AdminListSkeleton } from './AdminSkeletons'
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

  // ── Notify modal ────────────────────────────────────────────
  const [notify, setNotify] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

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

  /** Parent→children map for unfiltered tree render. */
  const childrenByParent = useMemo(() => {
    const map = new Map<string, AdminClinic[]>()
    for (const c of clinics) {
      if (!c.parent_clinic_id) continue
      const arr = map.get(c.parent_clinic_id)
      if (arr) arr.push(c)
      else map.set(c.parent_clinic_id, [c])
    }
    for (const arr of map.values()) arr.sort((a, b) => a.name.localeCompare(b.name))
    return map
  }, [clinics])

  const rootClinics = useMemo(() => {
    const clinicById = new Map(clinics.map(c => [c.id, c]))
    return filteredClinics
      .filter(c => !c.parent_clinic_id || !clinicById.has(c.parent_clinic_id))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [filteredClinics, clinics])

  const useTreeView = !searchQuery && !filterClinicId && !bare

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
      setNotify({ type: 'success', message: 'Deleted.' })
    } else {
      setNotify({ type: 'error', message: `Failed to delete ${failures.length} clinic(s)` })
    }

    await loadData()
  }

  const handleDeleteCancel = () => {
    setDeleteTarget(null)
  }

  // ── Shared: render clinic row items ─────────────────────
  const renderClinicCard = (clinic: AdminClinic, depth = 0) => (
    <ClinicCard
      key={clinic.id}
      clinic={clinic}
      depth={depth}
      assignedUserCount={usersInClinic(clinic.id).length}
      onTap={() => onSelectClinic(clinic)}
      onContextMenu={(x, y) => setContextMenu({ clinicId: clinic.id, x, y })}
    />
  )

  const renderClinicItems = () => filteredClinics.map((clinic) => renderClinicCard(clinic))

  const renderClinicTree = () => {
    const nodes: React.ReactNode[] = []
    const visit = (clinic: AdminClinic, depth: number) => {
      nodes.push(renderClinicCard(clinic, depth))
      const children = childrenByParent.get(clinic.id)
      if (children) for (const child of children) visit(child, depth + 1)
    }
    for (const root of rootClinics) visit(root, 0)
    return nodes
  }

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

      <ConfirmDialog
        visible={!!notify}
        title={notify?.message ?? ''}
        variant={notify?.type === 'success' ? 'success' : 'danger'}
        notifyOnly
        autoDismissMs={UI_TIMING.FEEDBACK_DURATION}
        onCancel={() => setNotify(null)}
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
      <div className="px-5 pt-4 pb-4">
        {showLoading ? (
          <AdminListSkeleton />
        ) : filteredClinics.length === 0 ? (
          <EmptyState title={searchQuery ? 'No clusters match your search.' : 'No clusters yet — tap + to add one.'} />
        ) : (
          <SectionCard>
            {useTreeView ? renderClinicTree() : renderClinicItems()}
          </SectionCard>
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
  depth?: number
  onTap: () => void
  onContextMenu: (x: number, y: number) => void
}

function ClinicCard({ clinic, assignedUserCount, depth = 0, onTap, onContextMenu }: ClinicCardProps) {
  const { isPressing, ...longPressHandlers } = useLongPress((x, y) => onContextMenu(x, y))

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open cluster ${clinic.name}`}
      onClick={onTap}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap() } }}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e.clientX, e.clientY)
      }}
      {...longPressHandlers}
      style={depth > 0 ? { paddingLeft: `${1 + depth * 1.25}rem` } : undefined}
      className={`flex items-center gap-3 px-4 py-3.5 transition-all active:scale-95 hover:bg-themeblue2/5 cursor-pointer select-none ${depth > 0 ? 'border-l-2 border-l-themeblue3/15' : ''} ${isPressing ? 'opacity-60' : ''}`}
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
