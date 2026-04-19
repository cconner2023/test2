import { useState } from 'react'
import { Plus, MapPin } from 'lucide-react'
import type { ResourceAllocation, AllocationRole, WaypointAllocationSummary } from '../../Types/MissionTypes'
import { ALLOCATION_ROLE_LABELS } from '../../Types/MissionTypes'
import type { LocalMapOverlay } from '../../Types/MapOverlayTypes'
import { AllocationRow } from './AllocationRow'

// Shared select class matching EventForm inputCx pattern
const selectCx =
  'w-full px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm ' +
  'border border-themeblue3/10 focus:border-themeblue1/30 focus:outline-none ' +
  'transition-colors appearance-none'

interface AllocationPanelProps {
  overlay: LocalMapOverlay | null
  waypointSummaries: WaypointAllocationSummary[]
  unpositioned: (ResourceAllocation & { resolvedItem?: { id: string; name: string; nsn?: string | null; nomenclature?: string | null } })[]
  propertyItems: { id: string; name: string; nsn: string | null }[]
  medics: { id: string; name: string }[]
  onAllocate: (
    itemId: string,
    waypointId: string | null,
    role: AllocationRole,
    personnelId?: string | null,
  ) => void
  onDeallocate: (itemId: string) => void
  onUpdateAllocation: (itemId: string, updates: Partial<ResourceAllocation>) => void
}

const ROLES = Object.entries(ALLOCATION_ROLE_LABELS) as [AllocationRole, string][]

function AddAllocationForm({
  overlay,
  propertyItems,
  medics,
  onAllocate,
  onCancel,
}: {
  overlay: LocalMapOverlay | null
  propertyItems: { id: string; name: string; nsn: string | null }[]
  medics: { id: string; name: string }[]
  onAllocate: AllocationPanelProps['onAllocate']
  onCancel: () => void
}) {
  const [itemId, setItemId] = useState('')
  const [waypointId, setWaypointId] = useState('')
  const [role, setRole] = useState<AllocationRole | ''>('')
  const [personnelId, setPersonnelId] = useState('')

  const waypoints = overlay?.features.filter(f => f.type === 'waypoint') ?? []

  const canSubmit = itemId && role

  function handleAdd() {
    if (!itemId || !role) return
    onAllocate(itemId, waypointId || null, role as AllocationRole, personnelId || null)
    onCancel()
  }

  return (
    <div className="rounded-2xl border border-themeblue3/10 bg-themewhite dark:bg-themewhite3 p-3 space-y-2">
      <p className="text-[10px] font-semibold text-tertiary/50 uppercase tracking-widest">
        Add Allocation
      </p>

      {/* Item */}
      <select
        value={itemId}
        onChange={e => setItemId(e.target.value)}
        className={selectCx}
        aria-label="Select item"
      >
        <option value="">Select item...</option>
        {propertyItems.map(item => (
          <option key={item.id} value={item.id}>
            {item.name}{item.nsn ? ` · ${item.nsn}` : ''}
          </option>
        ))}
      </select>

      {/* Waypoint */}
      <select
        value={waypointId}
        onChange={e => setWaypointId(e.target.value)}
        className={selectCx}
        aria-label="Select waypoint"
      >
        <option value="">Unpositioned</option>
        {waypoints.map(wp => (
          <option key={wp.id} value={wp.id}>
            {wp.label ?? wp.id}{wp.mgrs ? ` (${wp.mgrs})` : ''}
          </option>
        ))}
      </select>

      {/* Role */}
      <select
        value={role}
        onChange={e => setRole(e.target.value as AllocationRole | '')}
        className={selectCx}
        aria-label="Select role"
      >
        <option value="">Select role...</option>
        {ROLES.map(([val, label]) => (
          <option key={val} value={val}>{label}</option>
        ))}
      </select>

      {/* Personnel (optional) */}
      {medics.length > 0 && (
        <select
          value={personnelId}
          onChange={e => setPersonnelId(e.target.value)}
          className={selectCx}
          aria-label="Assign personnel"
        >
          <option value="">No personnel</option>
          {medics.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canSubmit}
          className="flex-1 py-1.5 rounded-full bg-themeblue3 text-white text-xs font-semibold disabled:opacity-40 transition-opacity active:scale-[0.98]"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-1.5 rounded-full border border-themeblue3/20 text-primary text-xs font-medium active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export function AllocationPanel({
  overlay,
  waypointSummaries,
  unpositioned,
  propertyItems,
  medics,
  onAllocate,
  onDeallocate,
  onUpdateAllocation,
}: AllocationPanelProps) {
  const [showForm, setShowForm] = useState(false)

  // Build a personnel name lookup
  const medicMap = new Map(medics.map(m => [m.id, m.name]))

  const hasContent =
    waypointSummaries.some(s => s.items.length > 0) || unpositioned.length > 0

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      {/* Waypoint sections */}
      {waypointSummaries.map(summary => (
        <div key={summary.waypoint.id}>
          {/* Section header */}
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <MapPin size={11} className="text-themeblue3 shrink-0" />
            <span className="text-[10px] font-semibold text-tertiary/60 uppercase tracking-widest truncate">
              {summary.waypoint.label ?? summary.waypoint.id}
            </span>
            {summary.waypoint.mgrs && (
              <span className="text-[10px] text-tertiary/40 font-mono ml-1 shrink-0">
                {summary.waypoint.mgrs}
              </span>
            )}
          </div>

          {summary.items.length === 0 ? (
            <p className="text-[10px] text-tertiary/30 italic px-2">No items assigned</p>
          ) : (
            <div className="flex flex-col gap-1">
              {summary.items.map(alloc => (
                <AllocationRow
                  key={alloc.item_id}
                  allocation={alloc}
                  waypointLabel={summary.waypoint.label ?? undefined}
                  personnelName={
                    alloc.personnel_id ? medicMap.get(alloc.personnel_id) : undefined
                  }
                  onRemove={onDeallocate}
                  onEdit={itemId =>
                    onUpdateAllocation(itemId, {})
                  }
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Unpositioned section */}
      {unpositioned.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <span className="text-[10px] font-semibold text-tertiary/40 uppercase tracking-widest">
              Unpositioned
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {unpositioned.map(alloc => (
              <AllocationRow
                key={alloc.item_id}
                allocation={alloc}
                personnelName={
                  alloc.personnel_id ? medicMap.get(alloc.personnel_id) : undefined
                }
                onRemove={onDeallocate}
                onEdit={itemId => onUpdateAllocation(itemId, {})}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasContent && !showForm && (
        <p className="text-xs text-tertiary/30 italic text-center py-2">
          No items allocated yet.
        </p>
      )}

      {/* Add form or button */}
      {showForm ? (
        <AddAllocationForm
          overlay={overlay}
          propertyItems={propertyItems}
          medics={medics}
          onAllocate={onAllocate}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-2xl border border-dashed border-themeblue3/20 text-themeblue3 text-xs font-medium hover:bg-themeblue3/5 active:scale-[0.98] transition-all"
        >
          <Plus size={13} />
          Add allocation
        </button>
      )}
    </div>
  )
}
