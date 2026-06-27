import { useState } from 'react'
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, Settings2, Check, X } from 'lucide-react'
import { formatMedicName } from './supervisorHelpers'
import { UserAvatar } from '../UserAvatar'
import { SupervisorClinicFilterPanel } from '../../SupervisorClinicSwitcher'
import { TextInput, PickerInput } from '../../FormInputs'
import { ConfirmDialog } from '../../ConfirmDialog'
import { useSubClusters } from '../../../Hooks/useSubClusters'
import { useAuthStore } from '../../../stores/useAuthStore'
import { invalidate } from '../../../stores/useInvalidationStore'
import {
  createSubCluster,
  renameSubCluster,
  deleteSubCluster,
  setMemberSubCluster,
} from '../../../lib/subClusterService'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'

export type TreeSelection =
  | { type: 'all-personnel' }
  | { type: 'soldier'; soldierId: string }

interface SupervisorTreeProps {
  medics: ClinicMedic[]
  selection: TreeSelection
  onSelect: (selection: TreeSelection) => void
}

/** HQ / unassigned grouping bucket — sorts first. */
const HQ_GROUP_ID = '__hq__'

export function SupervisorTree({
  medics,
  selection,
  onSelect,
}: SupervisorTreeProps) {
  const [personnelCollapsed, setPersonnelCollapsed] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [manage, setManage] = useState(false)
  const [addDraft, setAddDraft] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const { subClusters } = useSubClusters()
  const canManage = useAuthStore(s => s.isSupervisorRole || s.isDevRole)

  const isActive = (sel: TreeSelection): boolean => {
    if (sel.type !== selection.type) return false
    if (sel.type === 'soldier' && selection.type === 'soldier') return sel.soldierId === selection.soldierId
    return true
  }

  const nodeClass = (sel: TreeSelection) =>
    isActive(sel)
      ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
      : 'hover:bg-secondary/5'

  const sortedMedics = [...medics].sort((a, b) =>
    formatMedicName(a).localeCompare(formatMedicName(b))
  )

  // Group medics by sub-cluster. Unknown/stale ids and null fall to the HQ bucket.
  const knownIds = new Set(subClusters.map(s => s.id))
  const groups: { id: string; name: string; medics: ClinicMedic[] }[] = [
    { id: HQ_GROUP_ID, name: 'HQ / Unassigned', medics: [] },
    ...subClusters.map(s => ({ id: s.id, name: s.name, medics: [] as ClinicMedic[] })),
  ]
  const groupById = new Map(groups.map(g => [g.id, g]))
  for (const m of sortedMedics) {
    const key = m.subClusterId && knownIds.has(m.subClusterId) ? m.subClusterId : HQ_GROUP_ID
    groupById.get(key)!.medics.push(m)
  }
  // Only show the HQ bucket header when there ARE other sub-clusters (otherwise
  // it's a single flat list — no grouping to show).
  const grouped = subClusters.length > 0
  const visibleGroups = grouped ? groups.filter(g => g.id !== HQ_GROUP_ID || g.medics.length > 0) : groups

  const toggleGroup = (id: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAdd = async () => {
    const name = addDraft.trim()
    if (!name || busy) return
    setBusy(true)
    const res = await createSubCluster(name)
    setBusy(false)
    if (res.success) { setAddDraft(''); invalidate('subClusters') }
  }

  const handleRename = async (id: string) => {
    const name = renameDraft.trim()
    if (!name || busy) return
    setBusy(true)
    const res = await renameSubCluster(id, name)
    setBusy(false)
    if (res.success) { setRenameId(null); setRenameDraft(''); invalidate('subClusters') }
  }

  const handleDelete = async () => {
    if (!pendingDelete || busy) return
    setBusy(true)
    const res = await deleteSubCluster(pendingDelete.id)
    setBusy(false)
    setPendingDelete(null)
    // Members fall back to the HQ bucket → refresh roster + the sub-cluster list.
    if (res.success) invalidate('subClusters', 'users')
  }

  const handleAssign = async (userId: string, value: string) => {
    setBusy(true)
    await setMemberSubCluster(userId, value || null)
    setBusy(false)
    invalidate('users')
  }

  const assignOptions = [
    { value: '', label: 'HQ / Unassigned' },
    ...subClusters.map(s => ({ value: s.id, label: s.name })),
  ]

  const renderSoldier = (medic: ClinicMedic) => (
    <div key={medic.id}>
      <div
        role="button"
        tabIndex={0}
        className={`flex items-center gap-3 py-3 px-4 transition-colors cursor-pointer active:scale-95 ${nodeClass({ type: 'soldier', soldierId: medic.id })}`}
        onClick={() => onSelect({ type: 'soldier', soldierId: medic.id })}
        onKeyDown={(e) => { if (e.key === 'Enter') onSelect({ type: 'soldier', soldierId: medic.id }) }}
      >
        <UserAvatar avatarId={medic.avatarId} avatarBlob={medic.avatarBlob} userId={medic.id} firstName={medic.firstName} lastName={medic.lastName} className="w-10 h-10" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary truncate">{formatMedicName(medic)}</p>
          {medic.credential && (
            <p className="text-[9pt] text-tertiary truncate">{medic.credential}</p>
          )}
        </div>
      </div>
      {/* Manage mode: per-soldier sub-unit reassignment. */}
      {manage && canManage && subClusters.length > 0 && (
        <div className="px-4 pb-2 pl-[3.25rem]">
          <PickerInput
            value={medic.subClusterId ?? ''}
            onChange={(val) => handleAssign(medic.id, val)}
            options={assignOptions}
            placeholder="HQ / Unassigned"
          />
        </div>
      )}
    </div>
  )

  return (
    <div className="relative h-full flex flex-col py-1">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Clinic-context picker — only renders for loaned supervisors. */}
        <SupervisorClinicFilterPanel />

        <div className="shrink-0 px-4 py-3 border-b border-primary/10 flex items-center gap-2">
          <p className="text-[10pt] font-medium text-tertiary uppercase tracking-wide flex-1">Personnel</p>
          {canManage && (
            <button
              onClick={() => { setManage(m => !m); setRenameId(null) }}
              className={`p-1 rounded transition-colors ${manage ? 'text-themeblue3' : 'text-tertiary hover:text-primary'}`}
              aria-label="Manage sub-units"
            >
              <Settings2 size={15} />
            </button>
          )}
        </div>

        {/* All Personnel root */}
        <div
          role="button"
          tabIndex={0}
          className={`flex items-center gap-2 py-2 px-4 transition-colors cursor-pointer ${nodeClass({ type: 'all-personnel' })}`}
          onClick={() => onSelect({ type: 'all-personnel' })}
          onKeyDown={(e) => { if (e.key === 'Enter') onSelect({ type: 'all-personnel' }) }}
        >
          <button
            className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
            onClick={(e) => { e.stopPropagation(); setPersonnelCollapsed(!personnelCollapsed) }}
          >
            {personnelCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
          <span className="text-[10pt] font-medium text-primary truncate flex-1">All Personnel</span>
        </div>

        {/* Grouped (by sub-cluster) or flat soldier list */}
        {!personnelCollapsed && !grouped && sortedMedics.map(renderSoldier)}

        {!personnelCollapsed && grouped && visibleGroups.map(group => {
          const isHq = group.id === HQ_GROUP_ID
          const collapsed = collapsedGroups.has(group.id)
          const isRenaming = renameId === group.id
          return (
            <div key={group.id}>
              <div className="flex items-center gap-2 py-2 px-4 bg-secondary/5 border-y border-primary/5">
                <button
                  className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
                  onClick={() => toggleGroup(group.id)}
                >
                  {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                {isRenaming ? (
                  <div className="flex items-center gap-2 flex-1">
                    <TextInput bare value={renameDraft} onChange={setRenameDraft} placeholder="Sub-unit name"
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleRename(group.id) }} />
                    <button className="text-themeblue3 p-1" onClick={() => void handleRename(group.id)}><Check size={15} /></button>
                    <button className="text-tertiary p-1" onClick={() => { setRenameId(null); setRenameDraft('') }}><X size={15} /></button>
                  </div>
                ) : (
                  <>
                    <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-wide truncate flex-1">
                      {group.name} · {group.medics.length}
                    </span>
                    {manage && canManage && !isHq && (
                      <>
                        <button className="text-tertiary hover:text-primary p-1"
                          onClick={() => { setRenameId(group.id); setRenameDraft(group.name) }}>
                          <Pencil size={13} />
                        </button>
                        <button className="text-tertiary hover:text-themeredred p-1"
                          onClick={() => setPendingDelete({ id: group.id, name: group.name })}>
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
              {!collapsed && group.medics.map(renderSoldier)}
            </div>
          )
        })}

        {/* Inline add-sub-unit row (manage mode). */}
        {manage && canManage && (
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="flex-1">
              <TextInput bare value={addDraft} onChange={setAddDraft} placeholder="New sub-unit (platoon / squad)"
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd() }} />
            </div>
            <button
              onClick={() => void handleAdd()}
              className="w-9 h-9 rounded-full bg-themeblue3 text-white flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-40"
              aria-label="Add sub-unit"
            >
              <Plus size={18} />
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        visible={!!pendingDelete}
        title="Delete sub-unit?"
        subtitle={pendingDelete ? `"${pendingDelete.name}" — its members move to HQ / Unassigned. Property and events stay; they just lose the squad tag.` : undefined}
        confirmLabel="Delete"
        variant="danger"
        processing={busy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
