/**
 * AdminTree.tsx
 *
 * Desktop sidebar tree showing the clinic/user hierarchy for admin management.
 * Supports collapsible clinic nodes, drag-and-drop for reparenting clinics and
 * reassigning users, and right-click context menus.
 *
 * Pattern follows PropertyLocationTree.tsx for consistency.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, ChevronDown, Building2, User, Layers, Edit3, Trash2, Eye } from 'lucide-react'
import { useDrag } from '@use-gesture/react'
import { CardContextMenu } from '../CardContextMenu'
import { listClinics, listAllUsers, setUserClinic, updateClinic } from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'

interface AdminTreeProps {
  activeClinicId?: string | null
  activeUserId?: string | null
  onSelectClinic: (clinicId: string | null) => void
  onSelectUser: (userId: string) => void
  onSelectAll: () => void
  allSelected?: boolean
  onMoveUser: (userId: string, clinicId: string | null) => void
  onMoveClinic: (clinicId: string, parentClinicId: string | null) => void
}

/** Internal tree node representing a clinic with its children and users. */
interface ClinicTreeNode {
  clinic: AdminClinic
  children: ClinicTreeNode[]
  users: AdminUser[]
}

/** Tracks an in-progress drag operation. */
interface DragState {
  type: 'clinic' | 'user'
  id: string
  name: string
  invalidTargets: Set<string>
}

export function AdminTree({
  activeClinicId,
  activeUserId,
  onSelectClinic,
  onSelectUser,
  onSelectAll,
  allSelected,
  onMoveUser,
  onMoveClinic,
}: AdminTreeProps) {
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dragState, setDragState] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const dropTargetRef = useRef<string | null>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{
    type: 'clinic' | 'user'
    id: string
    x: number
    y: number
  } | null>(null)

  /** Load clinics and users from the admin service. */
  const loadData = useCallback(async () => {
    const [clinicData, userData] = await Promise.all([listClinics(), listAllUsers()])
    setClinics(clinicData)
    setUsers(userData)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  /**
   * Build a set of clinic IDs that are children of any other clinic.
   * Used to determine root-level clinics (those not listed as a child anywhere).
   */
  const childClinicIdSet = useMemo(() => {
    const set = new Set<string>()
    for (const clinic of clinics) {
      for (const childId of clinic.child_clinic_ids) {
        set.add(childId)
      }
    }
    return set
  }, [clinics])

  /** Map from clinic ID to the parent clinic ID (inverse of child_clinic_ids). */
  const parentMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const clinic of clinics) {
      for (const childId of clinic.child_clinic_ids) {
        map.set(childId, clinic.id)
      }
    }
    return map
  }, [clinics])

  /** Collect all descendant clinic IDs (inclusive) for drop validation. */
  const getDescendantIds = useCallback((clinicId: string): Set<string> => {
    const result = new Set<string>([clinicId])
    const clinicMap = new Map(clinics.map((c) => [c.id, c]))
    const queue = [clinicId]
    while (queue.length > 0) {
      const current = queue.pop()!
      const clinic = clinicMap.get(current)
      if (clinic) {
        for (const childId of clinic.child_clinic_ids) {
          if (!result.has(childId)) {
            result.add(childId)
            queue.push(childId)
          }
        }
      }
    }
    return result
  }, [clinics])

  /** Build the tree structure: root clinics, nested children, and unassigned users. */
  const { roots, unassignedUsers } = useMemo(() => {
    const clinicMap = new Map(clinics.map((c) => [c.id, c]))

    // Group users by clinic_id
    const usersByClinic = new Map<string | null, AdminUser[]>()
    for (const user of users) {
      const key = user.clinic_id ?? null
      const arr = usersByClinic.get(key)
      if (arr) arr.push(user)
      else usersByClinic.set(key, [user])
    }

    function buildNode(clinic: AdminClinic): ClinicTreeNode {
      const children = clinic.child_clinic_ids
        .map((id) => clinicMap.get(id))
        .filter((c): c is AdminClinic => c !== undefined)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(buildNode)

      const nodeUsers = (usersByClinic.get(clinic.id) ?? []).sort((a, b) => {
        const nameA = `${a.last_name ?? ''} ${a.first_name ?? ''}`.trim()
        const nameB = `${b.last_name ?? ''} ${b.first_name ?? ''}`.trim()
        return nameA.localeCompare(nameB)
      })

      return { clinic, children, users: nodeUsers }
    }

    // Root clinics: those not listed as a child of any other clinic
    const rootClinics = clinics
      .filter((c) => !childClinicIdSet.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name))
    const roots = rootClinics.map(buildNode)

    const unassignedUsers = (usersByClinic.get(null) ?? []).sort((a, b) => {
      const nameA = `${a.last_name ?? ''} ${a.first_name ?? ''}`.trim()
      const nameB = `${b.last_name ?? ''} ${b.first_name ?? ''}`.trim()
      return nameA.localeCompare(nameB)
    })

    return { roots, unassignedUsers }
  }, [clinics, users, childClinicIdSet])

  /** Count all users within a clinic node and its descendants. */
  function countAllUsers(node: ClinicTreeNode): number {
    let count = node.users.length
    for (const child of node.children) count += countAllUsers(child)
    return count
  }

  /** Build display name for a user. */
  function getUserDisplayName(user: AdminUser): string {
    const parts = [user.first_name, user.last_name].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : user.email
  }

  /** Helper to keep ref + state in sync for drop target. */
  const updateDropTarget = useCallback((id: string | null) => {
    dropTargetRef.current = id
    setDropTargetId(id)
  }, [])

  /**
   * Handle the completion of a drag-and-drop operation.
   * Calls the appropriate service function, then reloads data and
   * notifies the parent via onMoveUser / onMoveClinic.
   */
  const handleDrop = useCallback(
    async (ds: DragState, targetId: string) => {
      if (ds.type === 'user') {
        const newClinicId = targetId === '__unassigned__' ? null : targetId
        const result = await setUserClinic(ds.id, newClinicId)
        if (result.ok) {
          await loadData()
          onMoveUser(ds.id, newClinicId)
        }
      } else {
        // Clinic reparenting: remove from old parent, add to new parent
        const newParentId = targetId === '__root__' ? null : targetId
        const oldParentId = parentMap.get(ds.id) ?? null

        // Remove from old parent's child_clinic_ids
        if (oldParentId) {
          const oldParent = clinics.find((c) => c.id === oldParentId)
          if (oldParent) {
            await updateClinic(oldParentId, {
              child_clinic_ids: oldParent.child_clinic_ids.filter((id) => id !== ds.id),
            })
          }
        }

        // Add to new parent's child_clinic_ids
        if (newParentId) {
          const newParent = clinics.find((c) => c.id === newParentId)
          if (newParent) {
            await updateClinic(newParentId, {
              child_clinic_ids: [...newParent.child_clinic_ids, ds.id],
            })
          }
        }

        await loadData()
        onMoveClinic(ds.id, newParentId)
      }
    },
    [clinics, parentMap, loadData, onMoveUser, onMoveClinic]
  )

  /** Drag handler bound to the tree container via @use-gesture/react. */
  const bindDrag = useDrag(
    ({ active, first, last, xy: [cx, cy], event, tap }) => {
      if (tap) return

      if (first) {
        const target = (event?.target as HTMLElement)?.closest?.('[data-drag-id]') as HTMLElement | null
        if (!target) return
        const id = target.dataset.dragId!
        const type = target.dataset.dragType as 'clinic' | 'user'
        const name = target.dataset.dragName || ''

        // Compute invalid targets for clinics (self + descendants)
        let invalidTargets = new Set<string>()
        if (type === 'clinic') {
          invalidTargets = getDescendantIds(id)
        }

        const state: DragState = { type, id, name, invalidTargets }
        dragRef.current = state
        setDragState(state)
        updateDropTarget(null)
      }

      if (!dragRef.current) return

      // Position ghost element at cursor
      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate(${cx}px, ${cy}px)`
      }

      if (active && !first) {
        // Temporarily hide ghost to hit-test underneath
        if (ghostRef.current) ghostRef.current.style.display = 'none'
        const el = document.elementFromPoint(cx, cy) as HTMLElement | null
        if (ghostRef.current) ghostRef.current.style.display = ''

        const dropEl = el?.closest?.('[data-drop-id]') as HTMLElement | null
        const newDropId = dropEl?.dataset.dropId ?? null

        if (newDropId && dragRef.current) {
          const ds = dragRef.current

          if (ds.type === 'clinic') {
            // Can't drop clinic on self or descendants
            if (ds.invalidTargets.has(newDropId)) {
              updateDropTarget(null)
              return
            }
            // Can't drop on current parent (no-op)
            const currentParent = parentMap.get(ds.id) ?? '__root__'
            if (newDropId === currentParent) {
              updateDropTarget(null)
              return
            }
          } else {
            // User: can't drop on __root__ (only clinics or __unassigned__)
            if (newDropId === '__root__') {
              updateDropTarget(null)
              return
            }
            // Can't drop back on current clinic (no-op)
            const user = users.find((u) => u.id === ds.id)
            const currentClinic = user?.clinic_id ?? '__unassigned__'
            if (newDropId === currentClinic) {
              updateDropTarget(null)
              return
            }
          }

          updateDropTarget(newDropId)
        } else {
          updateDropTarget(null)
        }
      }

      if (last) {
        const ds = dragRef.current
        const finalTarget = dropTargetRef.current

        // Clear drag state
        dragRef.current = null
        setDragState(null)
        updateDropTarget(null)

        if (ds && finalTarget) {
          handleDrop(ds, finalTarget)
        }
      }
    },
    { filterTaps: true, delay: 150 }
  )

  /** Render a single clinic tree node and its children/users recursively. */
  function renderClinicNode(node: ClinicTreeNode, depth: number) {
    const hasChildren = node.children.length > 0 || node.users.length > 0
    const isCollapsed = collapsed.has(node.clinic.id)
    const totalUsers = countAllUsers(node)
    const isDragSource = dragState?.id === node.clinic.id
    const isDropTarget = dropTargetId === node.clinic.id
    const isActive = activeClinicId === node.clinic.id

    return (
      <div key={node.clinic.id}>
        {/* Clinic row */}
        <div
          className={`flex items-center gap-2 py-2 pr-6 transition-colors ${
            isDragSource ? 'opacity-30' : ''
          } ${
            isDropTarget
              ? 'bg-themeblue3/10 ring-1 ring-themeblue3/30'
              : isActive
                ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
                : 'hover:bg-secondary/5'
          }`}
          style={{ paddingLeft: `${24 + depth * 20}px` }}
          data-drag-id={node.clinic.id}
          data-drag-type="clinic"
          data-drag-name={node.clinic.name}
          data-drop-id={node.clinic.id}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenu({ type: 'clinic', id: node.clinic.id, x: e.clientX, y: e.clientY })
          }}
        >
          {/* Chevron */}
          {hasChildren ? (
            <button
              className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                toggleCollapse(node.clinic.id)
              }}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}

          {/* Clinic icon + name */}
          <div
            role="button"
            tabIndex={0}
            className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
            onClick={() => onSelectClinic(node.clinic.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSelectClinic(node.clinic.id)
            }}
          >
            <Building2 size={16} className="text-themeblue3 shrink-0" />
            <span className="text-[10pt] font-medium text-primary truncate">{node.clinic.name}</span>
          </div>

          {/* User count badge */}
          {totalUsers > 0 && (
            <span className="text-[10pt] px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium shrink-0">
              {totalUsers}
            </span>
          )}
        </div>

        {/* Children + users when expanded */}
        {hasChildren && !isCollapsed && (
          <>
            {node.children.map((child) => renderClinicNode(child, depth + 1))}
            {node.users.map((user) => renderUserNode(user, depth + 1))}
          </>
        )}
      </div>
    )
  }

  /** Render a single user row within the tree. */
  function renderUserNode(user: AdminUser, depth: number) {
    const isUserDragSource = dragState?.id === user.id
    const isActive = activeUserId === user.id
    const displayName = getUserDisplayName(user)

    return (
      <div
        key={user.id}
        role="button"
        tabIndex={0}
        className={`flex items-center gap-2 w-full py-2 pr-6 transition-colors text-left cursor-pointer ${
          isUserDragSource
            ? 'opacity-30'
            : isActive
              ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
              : 'hover:bg-secondary/5'
        }`}
        style={{ paddingLeft: `${24 + depth * 20 + 18}px` }}
        onClick={() => onSelectUser(user.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSelectUser(user.id)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          setContextMenu({ type: 'user', id: user.id, x: e.clientX, y: e.clientY })
        }}
        data-drag-id={user.id}
        data-drag-type="user"
        data-drag-name={displayName}
      >
        <User size={16} className="text-tertiary shrink-0" />
        <span className="text-[10pt] text-primary truncate flex-1">{displayName}</span>
        {user.credential && (
          <span className="text-[10pt] text-tertiary shrink-0">{user.credential}</span>
        )}
      </div>
    )
  }

  // Show unassigned section when there are unassigned users or when dragging a user
  const showUnassigned = unassignedUsers.length > 0 || dragState?.type === 'user'
  const isUnassignedDropTarget = dropTargetId === '__unassigned__'

  if (clinics.length === 0 && users.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-[10pt] text-tertiary">
        No clinics or users yet.
      </div>
    )
  }

  return (
    <div {...bindDrag()} className="flex flex-col py-1" style={{ touchAction: 'none' }}>
      {/* All Clinics top-level node */}
      <div
        role="button"
        tabIndex={0}
        className={`flex items-center gap-2 py-2 pr-6 transition-colors cursor-pointer ${
          allSelected
            ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
            : 'hover:bg-secondary/5'
        }`}
        style={{ paddingLeft: '24px' }}
        onClick={onSelectAll}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSelectAll()
        }}
      >
        <span className="w-[18px] shrink-0" />
        <Layers size={16} className="text-themeblue3 shrink-0" />
        <span className="text-[10pt] font-medium text-primary truncate">All Clinics</span>
      </div>

      {/* Clinic tree nodes */}
      {roots.map((node) => renderClinicNode(node, 0))}

      {/* Root drop zone -- visible only when dragging a clinic */}
      {dragState?.type === 'clinic' && (
        <div
          className={`mx-3 my-1 py-2 rounded-md border-2 border-dashed text-center text-[10pt] font-medium transition-colors ${
            dropTargetId === '__root__'
              ? 'border-themeblue3/40 bg-themeblue3/10 text-themeblue3'
              : 'border-tertiary/20 text-tertiary'
          }`}
          data-drop-id="__root__"
        >
          Move to top level
        </div>
      )}

      {/* Unassigned users section */}
      {showUnassigned && (
        <div>
          <div
            className={`flex items-center gap-2 py-2 pr-6 transition-colors ${
              isUnassignedDropTarget
                ? 'bg-themeyellow/10 ring-1 ring-themeyellow/30'
                : 'hover:bg-secondary/5'
            }`}
            style={{ paddingLeft: '24px' }}
            data-drop-id="__unassigned__"
          >
            <button
              className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                toggleCollapse('__unassigned__')
              }}
            >
              {collapsed.has('__unassigned__') ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
            <span className="text-[10pt] font-medium text-tertiary italic flex-1">Unassigned Users</span>
            <span className="text-[10pt] px-2 py-0.5 rounded-full bg-themeyellow/10 text-themeyellow font-medium shrink-0">
              {unassignedUsers.length}
            </span>
          </div>

          {!collapsed.has('__unassigned__') && (
            <>
              {unassignedUsers.map((user) => renderUserNode(user, 1))}
            </>
          )}
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu &&
        (() => {
          if (contextMenu.type === 'clinic') {
            const clinic = clinics.find((c) => c.id === contextMenu.id)
            if (!clinic) return null
            return (
              <CardContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={() => setContextMenu(null)}
                items={[
                  {
                    key: 'edit',
                    label: 'Edit',
                    icon: Edit3,
                    onAction: () => onSelectClinic(clinic.id),
                  },
                  {
                    key: 'delete',
                    label: 'Delete',
                    icon: Trash2,
                    destructive: true,
                    onAction: () => onSelectClinic(clinic.id),
                  },
                ]}
              />
            )
          } else {
            const user = users.find((u) => u.id === contextMenu.id)
            if (!user) return null
            return (
              <CardContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={() => setContextMenu(null)}
                items={[
                  {
                    key: 'edit',
                    label: 'Edit',
                    icon: Edit3,
                    onAction: () => onSelectUser(user.id),
                  },
                  {
                    key: 'view',
                    label: 'View',
                    icon: Eye,
                    onAction: () => onSelectUser(user.id),
                  },
                ]}
              />
            )
          }
        })()}

      {/* Ghost element rendered via portal during drag */}
      {dragState &&
        createPortal(
          <div
            ref={ghostRef}
            className="fixed top-0 left-0 z-[9999] pointer-events-none"
            style={{ transform: 'translate(-9999px, -9999px)' }}
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white shadow-lg border border-tertiary/20 max-w-[200px]">
              {dragState.type === 'clinic' ? (
                <Building2 size={16} className="text-themeblue3 shrink-0" />
              ) : (
                <User size={16} className="text-tertiary shrink-0" />
              )}
              <span className="text-[10pt] font-medium text-primary truncate">{dragState.name}</span>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
