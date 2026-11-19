import { SkeletonRows } from '@/Components/primitives/Skeleton'
import { useState, useEffect, useCallback, useRef } from 'react'
import { clusterLabel } from '../../../Utilities/clusterLabel'
import { Plus } from 'lucide-react'
import { Sheet } from '@/Components/primitives/Sheet'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { PaneCard } from '@/Components/primitives/PaneCard'
import { SwipeToDeleteRow } from '@/Components/primitives/SwipeToDeleteRow'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { clinicMemberName } from './supervisorHelpers'
import { AddMemberPopover } from '../../ClinicAdmin/AddMemberPopover'
import { MemberEditPopover } from '../../ClinicAdmin/MemberEditPopover'
import { SectionCard } from '@/Components/primitives/Section'
import {
  listClinicMembers,
  removeClinicMember,
  type ClinicMember,
  type MemberProfileData,
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

/** Backstop profile from the roster row — the live supervisor_get_member_profile
 *  fetch (subtree-authorized) fills in the real component/roles once open. */
function toFallbackProfile(m: ClinicMember): MemberProfileData {
  return {
    firstName: m.first_name,
    lastName: m.last_name,
    middleInitial: m.middle_initial,
    credential: m.credential,
    component: null,
    rank: m.rank,
    uic: m.uic,
    roles: ['medic'],
    email: m.email,
    homeClinicId: null,
    homeClinicName: null,
  }
}

/**
 * Roster body for a subordinate (direct-child) cluster. Surface-agnostic: hosted by
 * ChildClinicRosterSheet (mobile) and ChildClinicRosterCard (desktop PaneCard). The
 * add-member trigger lives in each host's header, so a host bumps `reloadToken`
 * after an add.
 */
export function ChildClinicRosterBody({
  clinicId,
  currentUserId,
  reloadToken,
}: {
  clinicId: string
  currentUserId: string | null
  /** The add-member trigger lives in the host header (outside this body), so
   *  bumping this token tells the body to re-fetch after an add. */
  reloadToken?: number
}) {
  const [members, setMembers] = useState<ClinicMember[]>([])
  const [loading, setLoading] = useState(true)
  const [removeTarget, setRemoveTarget] = useState<ClinicMember | null>(null)
  const [removing, setRemoving] = useState(false)
  const [editTarget, setEditTarget] = useState<{ member: ClinicMember; anchor: DOMRect } | null>(null)

  const refresh = useCallback(async () => {
    const res = await listClinicMembers(clinicId)
    if (res.success) setMembers(res.members)
    setLoading(false)
  }, [clinicId])

  useEffect(() => {
    refresh()
  }, [refresh, reloadToken])

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

  const roster = loading ? (
    <SkeletonRows count={4} variant="avatar" />
  ) : members.length === 0 ? (
    <p className="text-sm text-tertiary py-8 text-center">No members assigned.</p>
  ) : (
    <SectionCard>
      {members.map((m) => (
        <SwipeToDeleteRow
          key={m.id}
          onDelete={() => setRemoveTarget(m)}
          disabled={m.id === currentUserId}
        >
          <button
            type="button"
            onClick={(e) => setEditTarget({ member: m, anchor: e.currentTarget.getBoundingClientRect() })}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/5 active:scale-[0.99] transition-all"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-primary truncate">{clinicMemberName(m)}</p>
              <p className="text-[9pt] text-tertiary truncate">{m.email}</p>
            </div>
          </button>
        </SwipeToDeleteRow>
      ))}
    </SectionCard>
  )

  const popovers = (
    <>
      <ConfirmDialog
        visible={!!removeTarget}
        title={removeTarget ? `Remove ${clinicMemberName(removeTarget)}?` : ''}
        subtitle="They will be unassigned from this cluster."
        confirmLabel="Remove"
        variant="danger"
        processing={removing}
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
        zIndex={1300}
      />

      {/* Edit a subordinate-cluster soldier. Profile + password/email only —
          cluster membership moves stay with the home-clinic supervisor. The
          edit RPCs are echelon-subtree authorized (see supervisorService). */}
      <MemberEditPopover
        isOpen={!!editTarget}
        anchorRect={editTarget?.anchor ?? null}
        memberId={editTarget?.member.id ?? null}
        clinicId={clinicId}
        fallbackProfile={editTarget ? toFallbackProfile(editTarget.member) : undefined}
        hideClusterActions
        onClose={() => setEditTarget(null)}
        onChanged={refresh}
      />
    </>
  )

  // No section label: the host header already names the cluster.
  return (
    <div className="px-4 pb-6 pt-3">
      {roster}
      {popovers}
    </div>
  )
}

/** Mobile host: the roster body inside a bottom Sheet. The add-member trigger
 *  rides in the Sheet header (folded into the close pill via `actions`); adding a
 *  member bumps `reloadToken` so the body re-fetches. */
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
  const [addAnchor, setAddAnchor] = useState<DOMRect | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const addBtnRef = useRef<HTMLDivElement>(null)

  const openAdd = () => {
    if (addBtnRef.current) setAddAnchor(addBtnRef.current.getBoundingClientRect())
  }

  return (
    <Sheet
      isOpen
      onClose={onClose}
      title={clusterLabel(clinicId, clinicName)}
      maxHeight={60}
      backdrop="dismiss"
      zIndex={1250}
      actions={
        <div ref={addBtnRef}>
          <PillButton icon={Plus} onClick={openAdd} label="Add member" />
        </div>
      }
    >
      <ChildClinicRosterBody
        clinicId={clinicId}
        currentUserId={currentUserId}
        reloadToken={reloadToken}
      />
      {/* Rendered inside the Sheet so it inherits the sheet's OverlayStackContext
          ceiling and stacks above it (the header trigger lives outside the body). */}
      <AddMemberPopover
        isOpen={!!addAnchor}
        anchorRect={addAnchor}
        clinicId={clinicId}
        onClose={() => setAddAnchor(null)}
        onAdded={() => {
          setAddAnchor(null)
          setReloadToken((t) => t + 1)
        }}
      />
    </Sheet>
  )
}

/** Desktop host: the roster body in a PaneCard over the Settings main pane. Same
 *  header shape as the mobile Sheet (Add member folded into the close pill). The
 *  caller holds `clinicId` / `clinicName` through the exit (useHeldWhileOpen). */
export function ChildClinicRosterCard({
  isOpen,
  clinicId,
  clinicName,
  currentUserId,
  onClose,
}: {
  isOpen: boolean
  clinicId: string
  clinicName: string
  currentUserId: string | null
  onClose: () => void
}) {
  const [addAnchor, setAddAnchor] = useState<DOMRect | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const addBtnRef = useRef<HTMLDivElement>(null)

  const openAdd = () => {
    if (addBtnRef.current) setAddAnchor(addBtnRef.current.getBoundingClientRect())
  }

  return (
    <PaneCard
      isOpen={isOpen}
      onClose={onClose}
      title={clusterLabel(clinicId, clinicName)}
      actions={
        <div ref={addBtnRef}>
          <PillButton icon={Plus} iconSize={18} onClick={openAdd} label="Add member" />
        </div>
      }
    >
      <ChildClinicRosterBody
        key={clinicId}
        clinicId={clinicId}
        currentUserId={currentUserId}
        reloadToken={reloadToken}
      />
      <AddMemberPopover
        isOpen={!!addAnchor}
        anchorRect={addAnchor}
        clinicId={clinicId}
        onClose={() => setAddAnchor(null)}
        onAdded={() => {
          setAddAnchor(null)
          setReloadToken((t) => t + 1)
        }}
      />
    </PaneCard>
  )
}
