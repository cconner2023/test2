import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus } from 'lucide-react'
import { Sheet } from '../../Sheet'
import { ActionPill } from '../../ActionPill'
import { ActionButton } from '../../ActionButton'
import { SwipeToDeleteRow } from '../../SwipeToDeleteRow'
import { ConfirmDialog } from '../../ConfirmDialog'
import { AddMemberPopover } from '../../ClinicAdmin/AddMemberPopover'
import {
  listClinicMembers,
  removeClinicMember,
  type ClinicMember,
} from '../../../lib/supervisorService'

/**
 * Child-cluster roster management — the echelon drill-in. Tapping a Subordinate
 * Units card opens this: the direct-child clinic's roster with add / create /
 * remove. ONE echelon level, no further drill.
 *
 * All reads/writes go through the parameterized supervisor_* RPCs, which were
 * authorized down the parent_clinic_id subtree on 2026-07-02 (auth_supervisor_
 * scope_ids). Readiness/competency for the child is NOT shown here — that data is
 * enveloped in the child's vault and the parent can't decrypt it; the card's
 * summary already carries the percentages. This surface is roster ops only.
 */

function memberName(m: ClinicMember): string {
  const rank = m.rank ? `${m.rank} ` : ''
  const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email
  return `${rank}${name}`.trim()
}

export function ChildClinicRosterSheet({
  clinicId,
  clinicName,
  currentUserId,
  onClose,
}: {
  clinicId: string
  clinicName: string
  currentUserId: string | null
  onClose: () => void
}) {
  const [members, setMembers] = useState<ClinicMember[]>([])
  const [loading, setLoading] = useState(true)
  const [addAnchor, setAddAnchor] = useState<DOMRect | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ClinicMember | null>(null)
  const [removing, setRemoving] = useState(false)
  const addPillRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const res = await listClinicMembers(clinicId)
    if (res.success) setMembers(res.data.members)
    setLoading(false)
  }, [clinicId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleRemove = useCallback(async () => {
    if (!removeTarget) return
    setRemoving(true)
    const res = await removeClinicMember(clinicId, removeTarget.id)
    setRemoving(false)
    if (res.success) {
      setMembers((prev) => prev.filter((m) => m.id !== removeTarget.id))
      setRemoveTarget(null)
    }
  }, [removeTarget, clinicId])

  return (
    <Sheet isOpen onClose={onClose} title={clinicName} height="snap" zIndex={1250}>
      <div className="relative px-4 pb-6 pt-2">
        <ActionPill ref={addPillRef} shadow="sm" placement="overlay">
          <ActionButton
            icon={Plus}
            label="Add member"
            onClick={() => {
              if (addPillRef.current) setAddAnchor(addPillRef.current.getBoundingClientRect())
            }}
          />
        </ActionPill>

        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
          Roster
        </p>

        {loading ? (
          <p className="text-sm text-tertiary py-8 text-center">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-tertiary py-8 text-center">No members assigned.</p>
        ) : (
          <div className="rounded-2xl bg-themewhite2 overflow-hidden">
            {members.map((m) => (
              <SwipeToDeleteRow
                key={m.id}
                onDelete={() => setRemoveTarget(m)}
                disabled={m.id === currentUserId}
              >
                <div className="w-full flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary truncate">{memberName(m)}</p>
                    <p className="text-[9pt] text-tertiary truncate">{m.email}</p>
                  </div>
                </div>
              </SwipeToDeleteRow>
            ))}
          </div>
        )}
      </div>

      <AddMemberPopover
        isOpen={!!addAnchor}
        anchorRect={addAnchor}
        clinicId={clinicId}
        onClose={() => setAddAnchor(null)}
        onAdded={() => {
          setAddAnchor(null)
          refresh()
        }}
      />

      <ConfirmDialog
        visible={!!removeTarget}
        title={removeTarget ? `Remove ${memberName(removeTarget)}?` : ''}
        subtitle="They will be unassigned from this cluster."
        confirmLabel="Remove"
        variant="danger"
        processing={removing}
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
        zIndex={1300}
      />
    </Sheet>
  )
}
