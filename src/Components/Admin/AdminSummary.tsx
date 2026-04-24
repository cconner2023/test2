import { useState, useEffect, useMemo, useCallback } from 'react'
import { Inbox, ChevronRight, ChevronDown, AlertTriangle, User, Building2 } from 'lucide-react'
import { ActionButton } from '../ActionButton'
import { listClinics, listAllUsers, getAllAccountRequests } from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { AdminSummarySkeleton } from './AdminSkeletons'

interface AdminSummaryProps {
  onSelectClinic: (clinic: AdminClinic) => void
  onSelectUser: (user: AdminUser) => void
  onSelectAll: () => void
  onSwitchTab: (tab: 'requests' | 'users' | 'clinics') => void
  activeClinicId?: string | null
  activeUserId?: string | null
  allSelected?: boolean
}

interface ClinicNode {
  clinic: AdminClinic
  children: ClinicNode[]
  userCount: number
  totalUserCount: number
}

export function AdminSummary({
  onSelectClinic,
  onSelectUser,
  onSelectAll,
  onSwitchTab,
  activeClinicId,
  activeUserId,
  allSelected,
}: AdminSummaryProps) {
  const gen = useInvalidation('users', 'clinics', 'requests')
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [clinicData, userData, requests] = await Promise.all([
      listClinics(),
      listAllUsers(),
      getAllAccountRequests('pending'),
    ])
    setClinics(clinicData)
    setUsers(userData)
    setPendingCount(requests.length)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData, gen])

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const childClinicIdSet = useMemo(() => {
    const set = new Set<string>()
    for (const clinic of clinics) {
      for (const childId of clinic.child_clinic_ids) set.add(childId)
    }
    return set
  }, [clinics])

  const usersByClinic = useMemo(() => {
    const map = new Map<string | null, number>()
    for (const user of users) {
      const key = user.clinic_id ?? null
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [users])

  const unassignedUsers = useMemo(
    () => users.filter(u => !u.clinic_id).sort((a, b) => {
      const nameA = `${a.last_name ?? ''} ${a.first_name ?? ''}`.trim()
      const nameB = `${b.last_name ?? ''} ${b.first_name ?? ''}`.trim()
      return nameA.localeCompare(nameB)
    }),
    [users],
  )
  const unassignedCount = unassignedUsers.length
  const [showUnassigned, setShowUnassigned] = useState(false)

  const { roots } = useMemo(() => {
    const clinicMap = new Map(clinics.map(c => [c.id, c]))

    function countTotal(clinic: AdminClinic): number {
      let count = usersByClinic.get(clinic.id) ?? 0
      for (const childId of clinic.child_clinic_ids) {
        const child = clinicMap.get(childId)
        if (child) count += countTotal(child)
      }
      return count
    }

    function buildNode(clinic: AdminClinic): ClinicNode {
      const children = clinic.child_clinic_ids
        .map(id => clinicMap.get(id))
        .filter((c): c is AdminClinic => c !== undefined)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(buildNode)

      return {
        clinic,
        children,
        userCount: usersByClinic.get(clinic.id) ?? 0,
        totalUserCount: countTotal(clinic),
      }
    }

    const rootClinics = clinics
      .filter(c => !childClinicIdSet.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name))

    return { roots: rootClinics.map(buildNode) }
  }, [clinics, usersByClinic, childClinicIdSet])

  function renderClinicRow(node: ClinicNode, depth: number) {
    const hasChildren = node.children.length > 0
    const isCollapsed = collapsed.has(node.clinic.id)
    const isActive = activeClinicId === node.clinic.id

    return (
      <div key={node.clinic.id}>
        <div
          className={`flex items-center gap-2 py-2 pr-4 cursor-pointer transition-all active:scale-[0.98] ${
            isActive
              ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
              : 'hover:bg-secondary/5'
          }`}
          style={{ paddingLeft: `${16 + depth * 16}px` }}
        >
          {hasChildren ? (
            <button
              className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
              onClick={(e) => { e.stopPropagation(); toggleCollapse(node.clinic.id) }}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}

          <div
            role="button"
            tabIndex={0}
            aria-label={`Select clinic ${node.clinic.name}`}
            className="flex items-center flex-1 min-w-0"
            onClick={() => onSelectClinic(node.clinic)}
            onKeyDown={e => { if (e.key === 'Enter') onSelectClinic(node.clinic) }}
          >
            <span className="text-[10pt] font-medium text-primary truncate">{node.clinic.name}</span>
          </div>

          <span className="text-[9pt] md:text-[9pt] font-normal text-tertiary tabular-nums shrink-0">
            {node.totalUserCount}
          </span>
        </div>

        {hasChildren && !isCollapsed && node.children.map(child => renderClinicRow(child, depth + 1))}
      </div>
    )
  }

  if (loading) return <AdminSummarySkeleton />

  if (clinics.length === 0 && users.length === 0) {
    return (
      <div className="px-4 py-4">
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <p className="text-sm text-tertiary flex-1">No users or clinics yet</p>
            <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-2xl bg-themewhite shadow-sm border border-tertiary/15">
              <ActionButton icon={Building2} label="Open clinics" onClick={() => onSwitchTab('clinics')} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stats */}
      <div className="px-4 py-3 space-y-1.5">
        <button
          onClick={() => onSwitchTab('users')}
          className="flex items-center gap-2 w-full text-left active:scale-[0.98] transition-all"
        >
          <span className="text-[10pt] text-primary flex-1">Users</span>
          <span className="text-[10pt] font-semibold text-primary tabular-nums">{users.length}</span>
        </button>

        <button
          onClick={() => onSwitchTab('clinics')}
          className="flex items-center gap-2 w-full text-left active:scale-[0.98] transition-all"
        >
          <span className="text-[10pt] text-primary flex-1">Clinics</span>
          <span className="text-[10pt] font-semibold text-primary tabular-nums">{clinics.length}</span>
        </button>

        {pendingCount > 0 && (
          <button
            onClick={() => onSwitchTab('requests')}
            className="flex items-center gap-2 w-full text-left active:scale-[0.98] transition-all"
          >
            <span className="w-7 h-7 rounded-full bg-themeyellow/10 flex items-center justify-center shrink-0">
              <Inbox size={14} className="text-themeyellow" />
            </span>
            <span className="text-[10pt] text-themeyellow flex-1">Pending Requests</span>
            <span className="text-[10pt] font-semibold text-themeyellow tabular-nums">{pendingCount}</span>
          </button>
        )}

        {unassignedCount > 0 && (
          <div>
            <button
              onClick={() => setShowUnassigned(!showUnassigned)}
              className="flex items-center gap-2 w-full text-left active:scale-[0.98] transition-all"
            >
              <span className="w-7 h-7 rounded-full bg-themeredred/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={14} className="text-themeredred" />
              </span>
              <span className="text-[10pt] text-themeredred flex-1">Unassigned</span>
              <span className="text-[10pt] font-semibold text-themeredred tabular-nums mr-1">{unassignedCount}</span>
              {showUnassigned ? <ChevronDown size={14} className="text-tertiary shrink-0" /> : <ChevronRight size={14} className="text-tertiary shrink-0" />}
            </button>
            {showUnassigned && (
              <div className="mt-1 ml-9 rounded-lg border border-tertiary/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/10">
                {unassignedUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => onSelectUser(u)}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-left active:scale-95 transition-all ${
                      activeUserId === u.id ? 'bg-themeblue3/8' : 'hover:bg-secondary/5'
                    }`}
                  >
                    <User size={14} className="text-tertiary shrink-0" />
                    <span className="text-[10pt] text-primary truncate">
                      {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-b border-primary/10 mx-4" />

      {/* Hierarchy header */}
      <div className="px-4 py-2.5">
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Hierarchy</p>
      </div>

      {/* Clinic tree */}
      <div className="flex-1 overflow-y-auto">
        <button
          onClick={onSelectAll}
          onKeyDown={e => { if (e.key === 'Enter') onSelectAll() }}
          aria-label="Show all clinics"
          className={`flex items-center gap-2 w-full py-2 px-4 text-left cursor-pointer transition-all active:scale-[0.98] ${
            allSelected
              ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
              : 'hover:bg-secondary/5'
          }`}
        >
          <span className="w-[18px] shrink-0" />
          <span className="text-[10pt] font-medium text-primary">All Clinics</span>
          <span className="text-[9pt] md:text-[9pt] font-normal text-tertiary tabular-nums ml-auto">{users.length}</span>
        </button>

        {roots.map(node => renderClinicRow(node, 0))}
      </div>
    </div>
  )
}
