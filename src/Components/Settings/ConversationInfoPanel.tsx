import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { X, LogOut, Plus, Star, Pencil, Check, UserPlus, Trash2, Image as ImageIcon, Mic, ChevronRight } from 'lucide-react'
import { UserAvatar } from './UserAvatar'
import { getDisplayName } from '../../Utilities/nameUtils'
import { OverlayStack, type StackNav } from '@/Components/primitives/OverlayStack'
import { SheetStack } from '@/Components/primitives/SheetStack'
import type { StackScreen } from '@/Components/stackNav'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { ActionPill } from '@/Components/primitives/ActionPill'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { useOffRosterAdd } from '../Messages/useOffRosterAdd'
import { relativeShort } from '../../Utilities/conversationActivity'
import { displayGroupName, type GroupInfo, type GroupMember } from '../../lib/signal/groupTypes'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'
import type { ImageContent, VoiceContent } from '../../lib/signal/messageContent'

type ActionResult = { ok: boolean; error?: string }

/** Identity block for a 1:1 conversation (mutually exclusive with `group`). */
interface DirectPeer {
  userId: string
  name: string
  avatarId?: string | null
  firstName?: string | null
  lastName?: string | null
}

interface ConversationInfoPanelProps {
  isOpen: boolean
  onClose: () => void
  /** Every message in this conversation — drives the shared-media index. */
  messages: DecryptedSignalMessage[]
  /** Media browsing is a dev-only surface for now. */
  isDevRole: boolean
  /** Jump the thread to a message (reuses ChatDetailView's scroll-to plumbing). */
  onJumpToMessage?: (messageId: string) => void
  /** Present for a 1:1 conversation. */
  peer?: DirectPeer
  /** Present for a group conversation — enables the governance section. */
  group?: GroupInfo
  userId?: string
  medics?: ClinicMedic[]
  onLeave?: (groupId: string) => Promise<void>
  onRename?: (groupId: string, name: string) => Promise<void>
  onAddMember?: (groupId: string, userId: string) => Promise<void>
  onRemoveMember?: (groupId: string, userId: string) => Promise<void>
  onPromoteMember?: (groupId: string, userId: string) => Promise<ActionResult>
  onDemoteMember?: (groupId: string, userId: string) => Promise<ActionResult>
  onPurge?: (groupId: string) => Promise<ActionResult>
  fetchMembers?: (groupId: string) => Promise<GroupMember[]>
}


function getMemberName(member: GroupMember): string {
  const parts: string[] = []
  if (member.rank) parts.push(member.rank)
  if (member.lastName) {
    let name = member.lastName
    if (member.firstName) name += `, ${member.firstName.charAt(0)}.`
    parts.push(name)
  }
  return parts.join(' ') || 'Unknown'
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Settings-row-style drill affordance into a media category. */
function MediaCategoryRow({
  icon: Icon,
  label,
  count,
  onClick,
}: {
  icon: typeof ImageIcon
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-themewhite2 transition-colors"
    >
      <div className="w-8 h-8 rounded-lg bg-themeblue2/8 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-themeblue2" />
      </div>
      <span className="flex-1 text-left text-sm text-primary">{label}</span>
      <span className="text-[10pt] text-tertiary tabular-nums">{count}</span>
      <ChevronRight size={16} className="text-tertiary/60" />
    </button>
  )
}

export function ConversationInfoPanel({
  isOpen,
  onClose,
  messages,
  isDevRole,
  onJumpToMessage,
  peer,
  group,
  userId,
  medics = [],
  onLeave,
  onRename,
  onAddMember,
  onRemoveMember,
  onPromoteMember,
  onDemoteMember,
  onPurge,
  fetchMembers,
}: ConversationInfoPanelProps) {
  const [members, setMembers] = useState<GroupMember[]>([])
  const [groupEditing, setGroupEditing] = useState(false)
  const [nameText, setNameText] = useState(group?.name ?? '')
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)
  const isMobile = useIsMobile()

  // The drill "morph" runs on the shared useStack engine (OverlayStack card on
  // desktop / SheetStack bottom-sheet on mobile). navRef drives handler-initiated
  // navigation (Add action) from outside a screen render.
  const navRef = useRef<StackNav | null>(null)

  const isPrimary = members.some(m => m.userId === userId && m.role === 'admin')
  const primaryCount = members.filter(m => m.role === 'admin').length
  const memberIds = useMemo(() => new Set(members.map(m => m.userId)), [members])

  const handleAddMember = useCallback(async (memberId: string) => {
    if (!group || !onAddMember || !fetchMembers) return
    await onAddMember(group.groupId, memberId)
    setMembers(await fetchMembers(group.groupId))
  }, [group, onAddMember, fetchMembers])

  // Off-roster add (Scan QR / Email / Code) — the shared drill that the New
  // Message / New Group builder also uses. It resolves the peer and morphs the
  // card back to root; we only say a found user means "add them as a member".
  const offRoster = useOffRosterAdd({
    navRef,
    onFound: (medic) => { handleAddMember(medic.id) },
    isPresent: (id) => memberIds.has(id),
    presentMessage: 'Already in group',
    methodsTitle: 'Add member',
  })

  // Shared-media index — a derived read over the thread, never a store. Newest first.
  const media = useMemo(() => {
    const photos: DecryptedSignalMessage[] = []
    const voice: DecryptedSignalMessage[] = []
    for (const m of messages) {
      if (m.content?.type === 'image') photos.push(m)
      else if (m.content?.type === 'voice') voice.push(m)
    }
    photos.reverse()
    voice.reverse()
    return { photos, voice }
  }, [messages])

  const groupId = group?.groupId
  useEffect(() => {
    if (!isOpen) return
    setActionError(null)
    setConfirmPurge(false)
    setGroupEditing(false)
    offRoster.reset()
    if (groupId && fetchMembers) fetchMembers(groupId).then(setMembers)
    // offRoster.reset is stable; excluded to keep this an isOpen/group effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, groupId, fetchMembers])

  const handleRename = useCallback(async () => {
    if (!group || !onRename) return
    // We don't hold the group-name secret yet (name is still ciphertext) — renaming
    // now would re-encrypt under the legacy fallback key and break the name for
    // everyone who does hold it. Wait for the secret to arrive.
    if (displayGroupName(group.name) !== group.name) return
    const trimmed = nameText.trim()
    if (trimmed && trimmed !== group.name) {
      await onRename(group.groupId, trimmed)
    }
  }, [nameText, group, onRename])

  const enterGroupEdit = useCallback(() => {
    if (!group) return
    setNameText(displayGroupName(group.name))
    setActionError(null)
    setGroupEditing(true)
  }, [group])

  const exitGroupEdit = useCallback(() => {
    setGroupEditing(false)
    offRoster.reset()
    setActionError(null)
    // offRoster.reset is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRemoveMember = useCallback(async (memberId: string) => {
    if (!group || !onRemoveMember || !fetchMembers) return
    await onRemoveMember(group.groupId, memberId)
    setMembers(await fetchMembers(group.groupId))
  }, [group, onRemoveMember, fetchMembers])

  const handlePromote = useCallback(async (memberId: string) => {
    if (!group || !onPromoteMember || !fetchMembers) return
    setActionError(null)
    const res = await onPromoteMember(group.groupId, memberId)
    if (!res.ok) { setActionError(res.error ?? 'Could not promote'); return }
    setMembers(await fetchMembers(group.groupId))
  }, [group, onPromoteMember, fetchMembers])

  const handleDemote = useCallback(async (memberId: string) => {
    if (!group || !onDemoteMember || !fetchMembers) return
    setActionError(null)
    const res = await onDemoteMember(group.groupId, memberId)
    if (!res.ok) { setActionError(res.error ?? 'Could not demote'); return }
    setMembers(await fetchMembers(group.groupId))
  }, [group, onDemoteMember, fetchMembers])

  const handlePurge = useCallback(async () => {
    if (!group || !onPurge) return
    setActionError(null)
    const res = await onPurge(group.groupId)
    if (!res.ok) { setActionError(res.error ?? 'Could not purge'); setConfirmPurge(false) }
    // on success the parent navigates away and this panel unmounts
  }, [group, onPurge])

  // Drill into the add-member process (morph) — push the 'add' roster screen.
  const openAddFlow = useCallback(() => {
    navRef.current?.push('add')
  }, [])

  const nonMemberMedics = medics.filter(m => !memberIds.has(m.id))

  const jumpTo = useCallback((messageId: string) => {
    onJumpToMessage?.(messageId)
    onClose()
  }, [onJumpToMessage, onClose])

  const rootTitle = group ? 'Group Info' : (peer?.name ?? 'Info')

  // Root chrome (shown only at the stack root). LEFT slot = the destructive/additive
  // actions (danger-first): Purge/Leave in read mode, Add member while editing.
  // RIGHT slot = the single non-destructive primary action, opposite the danger
  // cluster: Edit → Confirm (primaries only).
  const leftActions = group
    ? (groupEditing
        ? [{
            key: 'add',
            label: 'Add member',
            icon: Plus,
            closesOnAction: false,
            onAction: openAddFlow,
          }]
        : [
            ...(isPrimary ? [{
              key: 'purge',
              label: 'Purge group',
              icon: Trash2,
              variant: 'danger' as const,
              closesOnAction: false,
              onAction: () => setConfirmPurge(true),
            }] : []),
            {
              key: 'leave',
              label: 'Leave',
              icon: LogOut,
              variant: 'danger' as const,
              closesOnAction: false,
              onAction: () => setConfirmLeave(true),
            },
          ])
    : []

  const rightAction = group && isPrimary
    ? (groupEditing
        ? { key: 'confirm', label: 'Confirm', icon: Check, onAction: exitGroupEdit }
        : { key: 'edit', label: 'Edit', icon: Pencil, onAction: enterGroupEdit })
    : null

  // Root chrome nodes. Desktop OverlayStack reads the root screen's footer (left)
  // + rightFooter (right) slots; mobile SheetStack shows the host's rootLeftContent
  // + rootRightContent. Same data, two renderings, preserving the left/right split.
  const leftFooterNode = leftActions.length > 0 ? (
    <ActionPill>
      {leftActions.map(a => (
        <ActionButton key={a.key} icon={a.icon} label={a.label} variant={a.variant} onClick={a.onAction} />
      ))}
    </ActionPill>
  ) : undefined
  const rightFooterNode = rightAction ? (
    <ActionPill>
      <ActionButton icon={rightAction.icon} label={rightAction.label} onClick={rightAction.onAction} />
    </ActionPill>
  ) : undefined
  const sheetLeftContent = leftActions.length > 0 ? (
    <div className="flex items-center gap-1">
      {leftActions.map(a => (
        <PillButton key={a.key} icon={a.icon} variant={a.variant} onClick={a.onAction} label={a.label} compact />
      ))}
    </div>
  ) : undefined
  const sheetRightContent = rightAction ? (
    <PillButton icon={rightAction.icon} label={rightAction.label} onClick={rightAction.onAction} compact />
  ) : undefined

  // ── Media sub-views (morph) ────────────────────────────────────────────────
  const photosGrid = (
    <div className="grid grid-cols-3 gap-1 p-2">
      {media.photos.map(m => {
        const c = m.content as ImageContent
        return (
          <button
            key={m.id}
            onClick={() => jumpTo(m.id)}
            className="aspect-square rounded-lg overflow-hidden bg-themewhite2 active:scale-95 transition-transform"
          >
            {c.thumbnail ? (
              <img src={c.thumbnail} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon size={18} className="text-tertiary/50" />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )

  const voiceList = (
    <div className="py-1">
      {media.voice.map(m => {
        const c = m.content as VoiceContent
        return (
          <button
            key={m.id}
            onClick={() => jumpTo(m.id)}
            className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-themewhite2 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-themeblue2/8 flex items-center justify-center shrink-0">
              <Mic size={15} className="text-themeblue2" />
            </div>
            <span className="flex-1 text-left text-sm text-primary">Voice message</span>
            <span className="text-[10pt] text-tertiary tabular-nums">{formatDuration(c.duration)}</span>
            <span className="text-[9pt] text-tertiary/70 w-9 text-right">{relativeShort(m.createdAt)}</span>
          </button>
        )
      })}
    </div>
  )

  // ── Add-member roster screen (useStack) — roster already excludes current
  //    members. The 'add' screen declares a searchPlaceholder, so the shell pins
  //    its own search box and hands the live filter into render(). Off-roster
  //    (QR / Email / Code) drills further via the shared useOffRosterAdd screens,
  //    reached from this screen's footer — identical to the New Message flow. ───
  const renderAddRoster = (filter: string) => {
    const q = filter.trim().toLowerCase()
    const list = q
      ? nonMemberMedics.filter(m =>
          m.firstName?.toLowerCase().includes(q) ||
          m.lastName?.toLowerCase().includes(q) ||
          m.rank?.toLowerCase().includes(q) ||
          [m.rank, m.lastName].filter(Boolean).join(' ').toLowerCase().includes(q)
        )
      : nonMemberMedics
    return (
      <div className="py-1">
        {list.map(medic => (
          <button
            key={medic.id}
            onClick={() => handleAddMember(medic.id)}
            className="flex items-center w-full px-4 py-2.5 gap-3 text-left hover:bg-themewhite2 active:scale-95 transition-all"
          >
            <UserAvatar avatarId={medic.avatarId} avatarBlob={medic.avatarBlob} userId={medic.id} firstName={medic.firstName} lastName={medic.lastName} className="w-8 h-8" />
            <span className="flex-1 text-sm text-primary truncate">{getDisplayName(medic)}</span>
          </button>
        ))}
        {list.length === 0 && (
          <p className="text-[10pt] text-tertiary text-center py-6">
            {q ? 'No contacts found' : 'Everyone in the cluster is already in the group'}
          </p>
        )}
      </div>
    )
  }

  // ── Root view (governance / identity + shared media) ───────────────────────
  const mediaSection = isDevRole && (
    <div className="pb-1">
      <p className="px-4 pt-3 pb-1.5 text-[10pt] text-tertiary">Shared media</p>
      {media.photos.length === 0 && media.voice.length === 0 ? (
        <p className="px-4 py-4 text-center text-[10pt] text-tertiary">No media shared</p>
      ) : (
        <div className="mx-4 border border-primary/10 rounded-xl overflow-hidden">
          {media.photos.length > 0 && (
            <MediaCategoryRow icon={ImageIcon} label="Photos" count={media.photos.length} onClick={() => navRef.current?.push('photos')} />
          )}
          {media.voice.length > 0 && (
            <MediaCategoryRow icon={Mic} label="Voice notes" count={media.voice.length} onClick={() => navRef.current?.push('voice')} />
          )}
        </div>
      )}
    </div>
  )

  const directIdentity = peer && (
    <div className="px-4 py-4 flex items-center gap-3">
      <UserAvatar avatarId={peer.avatarId} firstName={peer.firstName} lastName={peer.lastName} className="w-12 h-12" />
      <p className="flex-1 text-base font-medium text-primary truncate">{peer.name}</p>
    </div>
  )

  const groupGovernance = group && (
    <>
      {/* Group name — editable inline while in edit mode, read-only otherwise. */}
      <div className="px-4 py-3">
        {groupEditing ? (
          <input
            type="text"
            value={nameText}
            onChange={e => setNameText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { handleRename(); e.currentTarget.blur() } }}
            onBlur={handleRename}
            placeholder="Group name"
            className="w-full px-3 py-1.5 rounded-lg bg-themewhite2 text-base font-medium text-primary outline-none
                       focus:ring-1 focus:ring-themeblue2/40"
          />
        ) : (
          <p className="text-base font-medium text-primary">{displayGroupName(group.name)}</p>
        )}
      </div>

      {/* Members list */}
      <div className="px-4">
        <div className="mb-2">
          <p className="text-[10pt] text-tertiary">{members.length} members</p>
        </div>

        {actionError && (
          <p className="mb-2 text-[10pt] text-themeredred">{actionError}</p>
        )}

        {/* Current members */}
        {members.map(member => (
          <div key={member.userId} className="flex items-center gap-3 py-2">
            <UserAvatar
              avatarId={member.avatarId}
              firstName={member.firstName}
              lastName={member.lastName}
              className="w-9 h-9"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-primary truncate">{getMemberName(member)}</p>
              {member.role === 'admin' && (
                <span className="text-[9pt] text-themeblue2 font-medium">Primary</span>
              )}
            </div>
            {groupEditing && isPrimary && (
              <div className="flex items-center gap-1 shrink-0">
                {/* ★ primary toggle — filled = primary; last primary is locked (can't strand the group). */}
                {member.role === 'admin' ? (
                  primaryCount > 1 ? (
                    <button
                      onClick={() => handleDemote(member.userId)}
                      title="Remove primary"
                      className="p-1.5 rounded-full hover:bg-primary/5 active:scale-95 transition-all"
                    >
                      <Star size={15} className="text-themeblue2 fill-themeblue2" />
                    </button>
                  ) : (
                    <span className="p-1.5" title="Last primary">
                      <Star size={15} className="text-themeblue2 fill-themeblue2" />
                    </span>
                  )
                ) : (
                  <button
                    onClick={() => handlePromote(member.userId)}
                    title="Make primary"
                    className="p-1.5 rounded-full hover:bg-themeblue2/10 active:scale-95 transition-all"
                  >
                    <Star size={15} className="text-tertiary" />
                  </button>
                )}
                {/* × remove — never self */}
                {member.userId !== userId && (
                  <button
                    onClick={() => setPendingRemove(member.userId)}
                    title="Remove from group"
                    className="p-1.5 rounded-full hover:bg-themeredred/10 active:scale-95 transition-all"
                  >
                    <X size={15} className="text-red-400" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )

  // The root screen body (governance/identity + shared media). The purge/leave/
  // remove ConfirmDialogs live here so they render inside the shell's stacking
  // context; they're only ever triggered from the root, which stays mounted.
  const rootBody = (
    <div className="pb-2">
      {group ? groupGovernance : directIdentity}
      {mediaSection}
      {group && (
        <>
          <ConfirmDialog
            visible={confirmPurge}
            title="Purge this group?"
            subtitle="Deletes the conversation and all its messages for everyone. This can't be undone."
            confirmLabel="Purge"
            variant="danger"
            onConfirm={handlePurge}
            onCancel={() => setConfirmPurge(false)}
          />

          <ConfirmDialog
            visible={confirmLeave}
            title="Leave this group?"
            subtitle="You'll stop receiving its messages. Rejoining needs another member to add you back."
            confirmLabel="Leave"
            variant="danger"
            onConfirm={() => { setConfirmLeave(false); if (onLeave) onLeave(group.groupId) }}
            onCancel={() => setConfirmLeave(false)}
          />

          <ConfirmDialog
            visible={!!pendingRemove}
            title="Remove this member?"
            subtitle="They lose access to the group and its messages."
            confirmLabel="Remove"
            variant="danger"
            onConfirm={() => { const id = pendingRemove; setPendingRemove(null); if (id) handleRemoveMember(id) }}
            onCancel={() => setPendingRemove(null)}
          />
        </>
      )}
    </div>
  )

  // Drill-down screens for the shared useStack engine. Chrome (title/back/footer)
  // is read fresh each render, so these closures over host state stay live. Root
  // chrome differs per shell: OverlayStack reads the root screen's footer/rightFooter;
  // SheetStack shows rootLeftContent/rootRightContent (below). The off-roster
  // (QR / Email / Code) screens come from useOffRosterAdd — the same primitive the
  // New Message / New Group builder uses.
  const screens: Record<string, StackScreen> = {
    root: {
      title: rootTitle,
      footer: leftFooterNode,
      rightFooter: rightFooterNode,
      render: () => rootBody,
    },
    photos: { title: 'Photos', render: () => photosGrid },
    voice: { title: 'Voice notes', render: () => voiceList },
    add: {
      title: 'Add member',
      searchPlaceholder: 'Filter roster…',
      footer: (_p, nav) => (
        <ActionPill>
          <ActionButton icon={UserPlus} label="Off-roster" onClick={() => offRoster.openMethods(nav)} />
        </ActionPill>
      ),
      render: (_p, _nav, filter) => renderAddRoster(filter),
    },
    ...offRoster.screens,
  }

  // SheetStack (mobile bottom-sheet) / OverlayStack (desktop card) shell the SAME
  // drill engine, so both morph identically. Root chrome = the governance actions;
  // drilled screens surface their own title/back/footer via the engine.
  return isMobile ? (
    <SheetStack
      isOpen={isOpen}
      onClose={onClose}
      initial={{ key: 'root' }}
      screens={screens}
      navRef={navRef}
      rootTitle={rootTitle}
      rootLeftContent={sheetLeftContent}
      rootRightContent={sheetRightContent}
      height="fit"
      maxHeight={60}
      zIndex={1200}
    />
  ) : (
    <OverlayStack
      isOpen={isOpen}
      onClose={onClose}
      initial={{ key: 'root' }}
      screens={screens}
      navRef={navRef}
      anchorRect={null}
      previewMaxHeight="55dvh"
    />
  )
}
