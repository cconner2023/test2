import { Fragment, useCallback, useMemo, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Check, Plus, Users } from 'lucide-react'
import { FooterPill } from '../primitives/FooterPill'
import { ActionButton } from '../primitives/ActionButton'
import { UserAvatar } from '../Settings/UserAvatar'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { useMessageRoster } from '../../Hooks/useMessageRoster'
import { useMessagingStore } from '../../stores/useMessagingStore'
import { useOffRosterAdd } from './useOffRosterAdd'
import { getDisplayName } from '../../Utilities/nameUtils'
import { displayGroupName, type GroupInfo } from '../../lib/signal/groupTypes'
import type { StackNav, StackScreen } from '../stackNav'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'

/**
 * useContactPicker — THE shared "pick who this goes to" card.
 *
 * New Message / New Group and Share-to-chat had drifted into two hand-rolled
 * roster lists over the same OverlayStack shell: different roster sources
 * (MessagesPanel filtered its own `allMedics`, the share picker used
 * useMessageRoster), different rows, and groups only on one side. This hook owns
 * that surface once — the roster rows, the existing-group rows, the New Group
 * builder, and the off-roster Add footer — and hands back the `main` StackScreen
 * plus the useOffRosterAdd screens for the host to spread into its own
 * OverlayStack. The host keeps the shell (z-tier, width) and decides what a pick
 * MEANS: open the conversation, or add a recipient to a send.
 *
 * Single-select (`onPick`) and multi-select (`selectedTargets`) are the same card;
 * only the row's trailing slot changes. A host that needs to morph the root for
 * its own phases overrides `main` after spreading `screens`.
 */

export type ContactPickerTarget =
  | { kind: 'contact'; medic: ClinicMedic }
  | { kind: 'group'; group: GroupInfo }

export interface ContactPickerOptions {
  /** Shared nav of the host OverlayStack — off-roster resets the card through it. */
  navRef: RefObject<StackNav | null>
  /** Root title in contacts mode (group mode always titles itself "New Group"). */
  title: string
  /** Checkbox rows the caller reads from `selectedTargets`, vs tap-to-act rows. */
  multiSelect?: boolean
  /** Single-select only: what a tapped row means. */
  onPick?: (target: ContactPickerTarget) => void
  /** Prepend a self row (self-notes / save to your own conversation). */
  includeSelf?: boolean
  selfLabel?: string
  /** Out-of-cluster peers merged into the roster (e.g. resolved peer profiles). */
  extraPeers?: ClinicMedic[]
  /** List existing (non-system) groups alongside contacts. */
  includeGroups?: boolean
  /** Offer the New Group builder in the footer. */
  allowCreateGroup?: boolean
  /** Fires after createGroup resolves. The host decides what happens next —
   *  close the card, or select the fresh group as a recipient. */
  onGroupCreated?: (groupId: string) => void
  /** Hide the shared off-roster Add button (nothing an out-of-cluster user could
   *  actually receive here). */
  hideAdd?: boolean
  /** Extra left-pill buttons, contacts mode only (e.g. the outbound Email compose). */
  extraFooter?: (nav: StackNav) => ReactNode
  /** Right-pill slot in contacts mode. Group mode owns its own (Create Group). */
  rightFooter?: ReactNode
  emptyText?: string
}

export interface ContactPicker {
  /** Spread into the host `screens` map. Keys: main, plus the off-roster screens. */
  screens: Record<string, StackScreen>
  /** Multi-select: what is currently checked, resolved to contacts / groups. */
  selectedTargets: ContactPickerTarget[]
  selectedCount: number
  /** Open the card straight into the New Group builder (a "New Group" entry point
   *  outside this card, e.g. a conversation-list action). */
  openGroupMode: () => void
  /** Tear down selection, group draft and lookup state (call from onClose / on open). */
  reset: () => void
}

export function useContactPicker({
  navRef,
  title,
  multiSelect = false,
  onPick,
  includeSelf,
  selfLabel,
  extraPeers,
  includeGroups = false,
  allowCreateGroup = false,
  onGroupCreated,
  hideAdd = false,
  extraFooter,
  rightFooter,
  emptyText = 'No contacts found',
}: ContactPickerOptions): ContactPicker {
  const ctx = useMessagesContext()
  const allGroups = useMessagingStore(s => s.groups)

  const [mode, setMode] = useState<'contacts' | 'group'>('contacts')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Peers resolved by QR / email / user code. They join the roster for this card
  // only; useOffRosterAdd has already persisted the profile.
  const [foundPeers, setFoundPeers] = useState<ClinicMedic[]>([])

  const [groupName, setGroupName] = useState('')
  const [groupMemberIds, setGroupMemberIds] = useState<Set<string>>(new Set())
  const [groupCreating, setGroupCreating] = useState(false)
  const [groupError, setGroupError] = useState<string | null>(null)

  const mergedExtras = useMemo(
    () => (foundPeers.length === 0 ? extraPeers : [...(extraPeers ?? []), ...foundPeers]),
    [extraPeers, foundPeers],
  )
  const { roster, applyFilter } = useMessageRoster({
    includeSelf,
    ...(selfLabel ? { selfLabel } : {}),
    ...(mergedExtras ? { extraPeers: mergedExtras } : {}),
  })

  // System-typed groups (calendar / on-call / system) are machinery, not chats.
  const groupList = useMemo(
    () => Object.values(allGroups).filter(g => !g.systemType),
    [allGroups],
  )

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleGroupMember = useCallback((id: string) => {
    setGroupMemberIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // A found user is added to the roster AND acted on — the lookup only ever
  // happened because you meant to reach them.
  const handleFound = useCallback((medic: ClinicMedic) => {
    setFoundPeers(prev => (prev.some(p => p.id === medic.id) ? prev : [...prev, medic]))
    if (mode === 'group') toggleGroupMember(medic.id)
    else if (multiSelect) toggle(medic.id)
    else onPick?.({ kind: 'contact', medic })
  }, [mode, multiSelect, onPick, toggle, toggleGroupMember])

  const offRoster = useOffRosterAdd({ navRef, onFound: handleFound })
  const resetOffRoster = offRoster.reset

  const reset = useCallback(() => {
    setMode('contacts')
    setSelected(new Set())
    setFoundPeers([])
    setGroupName('')
    setGroupMemberIds(new Set())
    setGroupCreating(false)
    setGroupError(null)
    resetOffRoster()
  }, [resetOffRoster])

  const enterGroupMode = useCallback(() => {
    setMode('group')
    setGroupName('')
    setGroupMemberIds(new Set())
    setGroupError(null)
  }, [])

  const exitGroupMode = useCallback(() => {
    setMode('contacts')
    setGroupMemberIds(new Set())
    setGroupError(null)
  }, [])

  const handleCreateGroup = useCallback(async () => {
    if (!ctx || groupCreating) return
    const trimmed = groupName.trim()
    if (!trimmed || groupMemberIds.size === 0) return
    setGroupCreating(true)
    setGroupError(null)
    const id = await ctx.createGroup(trimmed, [...groupMemberIds])
    setGroupCreating(false)
    if (!id) {
      setGroupError('Could not create the group. Please try again.')
      return
    }
    setMode('contacts')
    setGroupMemberIds(new Set())
    setGroupName('')
    // On a multi-select card the group you just built IS a recipient — checking
    // it saves the user hunting for the new row they just created.
    if (multiSelect) setSelected(prev => new Set(prev).add(id))
    onGroupCreated?.(id)
  }, [ctx, groupName, groupMemberIds, groupCreating, multiSelect, onGroupCreated])

  const selectedTargets = useMemo<ContactPickerTarget[]>(() => {
    if (!multiSelect) return []
    const out: ContactPickerTarget[] = []
    for (const g of groupList) if (selected.has(g.groupId)) out.push({ kind: 'group', group: g })
    for (const m of roster) if (selected.has(m.id)) out.push({ kind: 'contact', medic: m })
    return out
  }, [multiSelect, groupList, roster, selected])

  // ── Rows ────────────────────────────────────────────────────────────
  // One row shape for contacts and groups: avatar, name, and a trailing check
  // circle only when the card is multi-select.
  const row = (key: string, avatar: ReactNode, label: string, checked: boolean, onClick: () => void, showCheck: boolean) => (
    <button
      key={key}
      onClick={onClick}
      className="flex items-center w-full px-4 py-2.5 gap-3 text-left hover:bg-themewhite2 active:scale-95 transition-all"
    >
      {avatar}
      <span className="flex-1 text-sm text-primary truncate">{label}</span>
      {showCheck && (
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0
                       ${checked ? 'bg-themeblue2 border-themeblue2' : 'border-tertiary/30'}`}>
          {checked && <Check size={12} className="text-white" />}
        </div>
      )}
    </button>
  )

  const contactAvatar = (medic: ClinicMedic) => (
    <UserAvatar
      avatarId={medic.avatarId}
      avatarBlob={medic.avatarBlob}
      userId={medic.id}
      firstName={medic.firstName}
      lastName={medic.lastName}
      className="w-8 h-8"
    />
  )

  const groupAvatar = (label: string) => (
    <div className="w-8 h-8 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
      <span className="text-[10pt] font-semibold text-themeblue2 uppercase">{label.slice(0, 2)}</span>
    </div>
  )

  const body = (filter: string) => {
    const contacts = applyFilter(filter)

    if (mode === 'group') {
      return (
        <div className="py-1">
          <div className="px-4 pb-2 pt-1">
            <input
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Group name"
              autoFocus
              className="w-full px-4 py-2 rounded-full bg-themewhite2 text-sm text-primary
                         placeholder:text-tertiary outline-none focus:ring-1 focus:ring-themeblue2/40 transition-all"
            />
            {groupError && <p className="px-1 pt-2 text-[10pt] text-themeredred">{groupError}</p>}
          </div>
          {contacts.map(medic =>
            row(medic.id, contactAvatar(medic), getDisplayName(medic), groupMemberIds.has(medic.id), () => toggleGroupMember(medic.id), true),
          )}
          {contacts.length === 0 && (
            <p className="text-[10pt] text-tertiary text-center py-6">{emptyText}</p>
          )}
        </div>
      )
    }

    const q = filter.trim().toLowerCase()
    const groups = includeGroups
      ? groupList.filter(g => !q || displayGroupName(g.name).toLowerCase().includes(q))
      : []

    if (contacts.length === 0 && groups.length === 0) {
      return <p className="text-[10pt] text-tertiary text-center py-6">{emptyText}</p>
    }

    return (
      <div className="py-1">
        {groups.map(group => {
          const label = displayGroupName(group.name)
          return row(
            group.groupId,
            groupAvatar(label),
            label,
            selected.has(group.groupId),
            () => (multiSelect ? toggle(group.groupId) : onPick?.({ kind: 'group', group })),
            multiSelect,
          )
        })}
        {contacts.map(medic =>
          row(
            medic.id,
            contactAvatar(medic),
            getDisplayName(medic),
            selected.has(medic.id),
            () => (multiSelect ? toggle(medic.id) : onPick?.({ kind: 'contact', medic })),
            multiSelect,
          ),
        )}
      </div>
    )
  }

  // ── Chrome ──────────────────────────────────────────────────────────
  const footer = (_p: unknown, nav: StackNav) => {
    const buttons: ReactNode[] = []
    if (mode === 'contacts' && allowCreateGroup) {
      buttons.push(<ActionButton key="group" icon={Users} label="New Group" onClick={enterGroupMode} />)
    }
    if (!hideAdd) {
      buttons.push(<ActionButton key="add" icon={Plus} label="Add" onClick={() => offRoster.openMethods(nav)} />)
    }
    if (mode === 'contacts') {
      const extra = extraFooter?.(nav)
      if (extra) buttons.push(<Fragment key="extra">{extra}</Fragment>)
    }
    if (buttons.length === 0) return null
    return <FooterPill>{buttons}</FooterPill>
  }

  // Create Group is rendered only once it can fire — no dimmed action button.
  const groupCreatable = !!groupName.trim() && groupMemberIds.size > 0
  const rightSlot: ReactNode = mode === 'group'
    ? (groupCreatable || groupCreating) && (
        <FooterPill side="right">
          <ActionButton
            icon={Check}
            label={groupCreating ? 'Creating…' : 'Create Group'}
            variant="confirm"
            onClick={() => void handleCreateGroup()}
          />
        </FooterPill>
      )
    : rightFooter

  const main: StackScreen = {
    title: mode === 'group' ? 'New Group' : title,
    searchPlaceholder: 'Search contacts...',
    ...(mode === 'group' ? { onBack: () => exitGroupMode() } : {}),
    footer,
    ...(rightSlot ? { rightFooter: rightSlot } : {}),
    render: (_p: unknown, _nav: StackNav, filter: string) => body(filter),
  }

  return {
    screens: { main, ...offRoster.screens },
    selectedTargets,
    selectedCount: selected.size,
    openGroupMode: enterGroupMode,
    reset,
  }
}
