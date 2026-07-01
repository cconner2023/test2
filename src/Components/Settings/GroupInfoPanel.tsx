import { useState, useEffect, useCallback } from 'react'
import { X, UserPlus, UserMinus, LogOut, Pencil, Check, Mail, Hash, Send, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react'
import { UserAvatar } from './UserAvatar'
import { PreviewOverlay } from '../PreviewOverlay'
import { ConfirmDialog } from '../ConfirmDialog'
import { supabase } from '../../lib/supabase'
import { useMessagingStore } from '../../stores/useMessagingStore'
import { fetchProfileById } from '../../lib/peerLookup'
import type { GroupInfo, GroupMember } from '../../lib/signal/groupTypes'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'

type ActionResult = { ok: boolean; error?: string }

interface GroupInfoPanelProps {
  isOpen: boolean
  group: GroupInfo
  userId: string
  medics: ClinicMedic[]
  onClose: () => void
  onLeave: (groupId: string) => Promise<void>
  onRename: (groupId: string, name: string) => Promise<void>
  onAddMember: (groupId: string, userId: string) => Promise<void>
  onRemoveMember: (groupId: string, userId: string) => Promise<void>
  onPromoteMember: (groupId: string, userId: string) => Promise<ActionResult>
  onDemoteMember: (groupId: string, userId: string) => Promise<ActionResult>
  onPurge: (groupId: string) => Promise<ActionResult>
  fetchMembers: (groupId: string) => Promise<GroupMember[]>
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

export function GroupInfoPanel({
  isOpen,
  group,
  userId,
  medics,
  onClose,
  onLeave,
  onRename,
  onAddMember,
  onRemoveMember,
  onPromoteMember,
  onDemoteMember,
  onPurge,
  fetchMembers,
}: GroupInfoPanelProps) {
  const [members, setMembers] = useState<GroupMember[]>([])
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameText, setNameText] = useState(group.name)
  const [lookupMode, setLookupMode] = useState<'none' | 'email' | 'code'>('none')
  const [lookupValue, setLookupValue] = useState('')
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)

  const isPrimary = members.some(m => m.userId === userId && m.role === 'admin')
  const primaryCount = members.filter(m => m.role === 'admin').length
  const memberIds = new Set(members.map(m => m.userId))

  useEffect(() => {
    if (!isOpen) return
    fetchMembers(group.groupId).then(setMembers)
    setActionError(null)
    setConfirmPurge(false)
  }, [isOpen, group.groupId, fetchMembers])

  const handleRename = useCallback(async () => {
    const trimmed = nameText.trim()
    if (trimmed && trimmed !== group.name) {
      await onRename(group.groupId, trimmed)
    }
    setEditingName(false)
  }, [nameText, group.groupId, group.name, onRename])

  const handleAddMember = useCallback(async (memberId: string) => {
    await onAddMember(group.groupId, memberId)
    const refreshed = await fetchMembers(group.groupId)
    setMembers(refreshed)
    setShowAddPicker(false)
  }, [group.groupId, onAddMember, fetchMembers])

  const handleRemoveMember = useCallback(async (memberId: string) => {
    await onRemoveMember(group.groupId, memberId)
    const refreshed = await fetchMembers(group.groupId)
    setMembers(refreshed)
  }, [group.groupId, onRemoveMember, fetchMembers])

  const handlePromote = useCallback(async (memberId: string) => {
    setActionError(null)
    const res = await onPromoteMember(group.groupId, memberId)
    if (!res.ok) { setActionError(res.error ?? 'Could not promote'); return }
    setMembers(await fetchMembers(group.groupId))
  }, [group.groupId, onPromoteMember, fetchMembers])

  const handleDemote = useCallback(async (memberId: string) => {
    setActionError(null)
    const res = await onDemoteMember(group.groupId, memberId)
    if (!res.ok) { setActionError(res.error ?? 'Could not demote'); return }
    setMembers(await fetchMembers(group.groupId))
  }, [group.groupId, onDemoteMember, fetchMembers])

  const handlePurge = useCallback(async () => {
    setActionError(null)
    const res = await onPurge(group.groupId)
    if (!res.ok) { setActionError(res.error ?? 'Could not purge'); setConfirmPurge(false) }
    // on success the parent navigates away and this panel unmounts
  }, [group.groupId, onPurge])

  const closeAddPicker = useCallback(() => {
    setShowAddPicker(false)
    setLookupMode('none')
    setLookupValue('')
    setLookupError(null)
  }, [])

  const handleLookup = useCallback(async () => {
    const value = lookupValue.trim()
    setLookupError(null)
    if (!value) return
    if (lookupMode === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.toLowerCase())) {
      setLookupError('Enter a valid email')
      return
    }
    setLookupLoading(true)
    try {
      let medic: ClinicMedic | null = null
      if (lookupMode === 'email') {
        const { data, error } = await supabase.rpc('search_users', { query: value.toLowerCase() })
        if (error || !data) { setLookupError('Lookup failed'); return }
        const match = (data as Array<{ id: string; email?: string | null; first_name: string | null; last_name: string | null; middle_initial: string | null; rank: string | null; credential: string | null; avatar_id: string | null; clinic_id: string | null; clinic_name: string | null }>)
          .find(r => r.email?.toLowerCase() === value.toLowerCase())
        if (!match) { setLookupError('No user found with that email'); return }
        medic = {
          id: match.id,
          firstName: match.first_name,
          lastName: match.last_name,
          middleInitial: match.middle_initial,
          rank: match.rank,
          credential: match.credential,
          avatarId: match.avatar_id ?? null,
          clinicId: match.clinic_id ?? undefined,
          clinicName: match.clinic_name ?? undefined,
        }
      } else if (lookupMode === 'code') {
        medic = await fetchProfileById(value)
        if (!medic) { setLookupError('No user found with that code'); return }
      }
      if (medic) {
        if (memberIds.has(medic.id)) {
          setLookupError('Already in group')
          return
        }
        useMessagingStore.getState().setPeerProfile(medic)
        await handleAddMember(medic.id)
        setLookupValue('')
        setLookupMode('none')
      }
    } catch {
      setLookupError('Lookup failed')
    } finally {
      setLookupLoading(false)
    }
  }, [lookupMode, lookupValue, memberIds, handleAddMember])

  const nonMemberMedics = medics.filter(m => !memberIds.has(m.id))

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={null}
      title="Group Info"
      previewMaxHeight="55dvh"
      actions={[
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
      ]}
      preview={
        <div className="pb-2">
          {/* Group name */}
          <div className="px-4 py-3 flex items-center gap-3">
          {editingName ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={nameText}
                onChange={e => setNameText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename() }}
                autoFocus
                className="flex-1 px-3 py-1.5 rounded-lg bg-themewhite2 text-sm text-primary outline-none
                           focus:ring-1 focus:ring-themeblue2/40"
              />
              <button onClick={handleRename} className="p-1.5 rounded-full hover:bg-primary/5">
                <Check size={16} className="text-themeblue2" />
              </button>
              <button onClick={() => { setEditingName(false); setNameText(group.name) }} className="p-1.5 rounded-full hover:bg-primary/5">
                <X size={16} className="text-tertiary" />
              </button>
            </div>
          ) : (
            <>
              <p className="flex-1 text-base font-medium text-primary">{group.name}</p>
              {isPrimary && (
                <button onClick={() => setEditingName(true)} className="p-1.5 rounded-full hover:bg-primary/5">
                  <Pencil size={14} className="text-tertiary" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Members list */}
        <div className="px-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10pt] text-tertiary">{members.length} members</p>
            {isPrimary && (
              <button
                onClick={() => showAddPicker ? closeAddPicker() : setShowAddPicker(true)}
                className="flex items-center gap-1 text-[10pt] text-themeblue2 hover:text-themeblue2/80"
              >
                <UserPlus size={12} />
                Add
              </button>
            )}
          </div>

          {actionError && (
            <p className="mb-2 text-[10pt] text-themeredred">{actionError}</p>
          )}

          {/* Add member picker */}
          {showAddPicker && (
            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setLookupMode('email'); setLookupValue(''); setLookupError(null) }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10pt] transition-colors
                             ${lookupMode === 'email' ? 'bg-themeblue2 text-white' : 'bg-themewhite2 text-tertiary'}`}
                >
                  <Mail size={12} />
                  Email
                </button>
                <button
                  onClick={() => { setLookupMode('code'); setLookupValue(''); setLookupError(null) }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10pt] transition-colors
                             ${lookupMode === 'code' ? 'bg-themeblue2 text-white' : 'bg-themewhite2 text-tertiary'}`}
                >
                  <Hash size={12} />
                  User Code
                </button>
              </div>

              {lookupMode !== 'none' && (
                <div>
                  <div className="flex items-center gap-2">
                    <input
                      type={lookupMode === 'email' ? 'email' : 'text'}
                      inputMode={lookupMode === 'email' ? 'email' : 'text'}
                      value={lookupValue}
                      onChange={e => { setLookupValue(e.target.value); if (lookupError) setLookupError(null) }}
                      onKeyDown={e => { if (e.key === 'Enter' && lookupValue.trim() && !lookupLoading) { e.preventDefault(); handleLookup() } }}
                      placeholder={lookupMode === 'email' ? 'user@example.com' : 'Paste user code'}
                      autoFocus
                      className="flex-1 px-3 py-2 rounded-lg bg-themewhite2 text-sm text-primary
                                 outline-none focus:ring-1 focus:ring-themeblue2/40 placeholder:text-tertiary"
                    />
                    {lookupValue.trim() && !lookupLoading && (
                      <button
                        onClick={handleLookup}
                        className="w-9 h-9 rounded-full bg-themeblue2 text-white flex items-center justify-center
                                   active:scale-95 transition-all shrink-0"
                      >
                        <Send size={14} />
                      </button>
                    )}
                  </div>
                  {(lookupError || lookupLoading) && (
                    <p className={`mt-1 text-[10pt] ${lookupError ? 'text-themeredred' : 'text-tertiary'}`}>
                      {lookupLoading ? 'Looking up…' : lookupError}
                    </p>
                  )}
                </div>
              )}

              {nonMemberMedics.length > 0 && (
                <div className="border border-primary/10 rounded-xl overflow-hidden">
                  {nonMemberMedics.map(medic => (
                    <button
                      key={medic.id}
                      onClick={() => handleAddMember(medic.id)}
                      className="flex items-center w-full px-3 py-2 gap-2 hover:bg-themewhite2 transition-colors"
                    >
                      <UserAvatar avatarId={medic.avatarId} avatarBlob={medic.avatarBlob} userId={medic.id} firstName={medic.firstName} lastName={medic.lastName} className="w-7 h-7" />
                      <span className="flex-1 text-sm text-primary truncate">
                        {[medic.rank, medic.lastName].filter(Boolean).join(' ') || medic.firstName || 'Unknown'}
                      </span>
                      <UserPlus size={14} className="text-themeblue2/60" />
                    </button>
                  ))}
                </div>
              )}
            </div>
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
              {isPrimary && (
                <div className="flex items-center gap-0.5 shrink-0">
                  {member.role === 'admin' ? (
                    // Demote — hidden for the last primary (can't strand the group)
                    primaryCount > 1 && (
                      <button
                        onClick={() => handleDemote(member.userId)}
                        title="Remove primary"
                        className="p-1.5 rounded-full hover:bg-primary/5 active:scale-95 transition-all"
                      >
                        <ShieldOff size={14} className="text-tertiary" />
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => handlePromote(member.userId)}
                      title="Make primary"
                      className="p-1.5 rounded-full hover:bg-themeblue2/10 active:scale-95 transition-all"
                    >
                      <ShieldCheck size={14} className="text-themeblue2" />
                    </button>
                  )}
                  {member.userId !== userId && (
                    <button
                      onClick={() => setPendingRemove(member.userId)}
                      title="Remove from group"
                      className="p-1.5 rounded-full hover:bg-themeredred/10 active:scale-95 transition-all"
                    >
                      <UserMinus size={14} className="text-red-400" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          </div>

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
            onConfirm={() => { setConfirmLeave(false); onLeave(group.groupId) }}
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
        </div>
      }
    />
  )
}
