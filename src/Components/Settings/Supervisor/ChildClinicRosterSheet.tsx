import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, ChevronLeft } from 'lucide-react'
import { Sheet } from '@/Components/primitives/Sheet'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { SwipeToDeleteRow } from '@/Components/primitives/SwipeToDeleteRow'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { AddMemberPopover } from '../../ClinicAdmin/AddMemberPopover'
import { MemberEditPopover } from '../../ClinicAdmin/MemberEditPopover'
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

function memberName(m: ClinicMember): string {
  const rank = m.rank ? `${m.rank} ` : ''
  const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email
  return `${rank}${name}`.trim()
}

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
 * Roster body for a subordinate (direct-child) cluster. Surface-agnostic so it can
 * host inside a Sheet (mobile) OR the supervisor's right detail pane (desktop) —
 * mirrors the shared-settings-body pattern (MapSettingsBody). All chrome (add pill,
 * add popover, remove confirm) lives here so both host surfaces behave identically.
 */
export function ChildClinicRosterBody({
  clinicId,
  currentUserId,
  title,
  onBack,
  reloadToken,
}: {
  clinicId: string
  currentUserId: string | null
  /** Desktop pane host: renders a detail header (back + title + Add-member icon
   *  primitive on the right) instead of the mobile overlay add-pill above the list. */
  title?: string
  onBack?: () => void
  /** Mobile host nudge: the add-member trigger lives in the Sheet header (outside
   *  this body), so bumping this token tells the body to re-fetch after an add. */
  reloadToken?: number
}) {
  const [members, setMembers] = useState<ClinicMember[]>([])
  const [loading, setLoading] = useState(true)
  const [addAnchor, setAddAnchor] = useState<DOMRect | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ClinicMember | null>(null)
  const [removing, setRemoving] = useState(false)
  const [editTarget, setEditTarget] = useState<{ member: ClinicMember; anchor: DOMRect } | null>(null)
  const addPillRef = useRef<HTMLDivElement>(null)

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

  const openAdd = () => {
    if (addPillRef.current) setAddAnchor(addPillRef.current.getBoundingClientRect())
  }

  const roster = loading ? (
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
          <button
            type="button"
            onClick={(e) => setEditTarget({ member: m, anchor: e.currentTarget.getBoundingClientRect() })}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/5 active:scale-[0.99] transition-all"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-primary truncate">{memberName(m)}</p>
              <p className="text-[9pt] text-tertiary truncate">{m.email}</p>
            </div>
          </button>
        </SwipeToDeleteRow>
      ))}
    </div>
  )

  const popovers = (
    <>
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

  // Desktop pane host: detail header (back + name + Add icon primitive on the right),
  // scrollable roster below. Mirrors ProviderTemplateDetail's header layout.
  if (title || onBack) {
    return (
      <div className="flex h-full flex-col">
        <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-tertiary/10">
          {onBack && (
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all shrink-0"
              aria-label="Back to dashboard"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <p className="flex-1 min-w-0 text-sm font-semibold text-primary truncate">{title}</p>
          <div ref={addPillRef}>
            <HeaderPill>
              <PillButton icon={Plus} iconSize={16} onClick={openAdd} label="Add member" />
            </HeaderPill>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 pt-3">
          {roster}
        </div>
        {popovers}
      </div>
    )
  }

  // Mobile Sheet host: the add-member trigger lives in the Sheet header (folded
  // into the close pill via the Sheet `actions` slot — see ChildClinicRosterSheet).
  // No section label — the Sheet title already names the cluster; this is its roster.
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
      title={clinicName}
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
