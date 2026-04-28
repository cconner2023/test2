import { useState, useEffect, useCallback } from 'react'
import { X, UserPlus, UserMinus, LogOut, Pencil, Check } from 'lucide-react'
import { UserAvatar } from './UserAvatar'
import type { GroupInfo, GroupMember } from '../../lib/signal/groupTypes'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'

interface GroupInfoPanelProps {
  group: GroupInfo
  userId: string
  medics: ClinicMedic[]
  onClose: () => void
  onLeave: (groupId: string) => Promise<void>
  onRename: (groupId: string, name: string) => Promise<void>
  onAddMember: (groupId: string, userId: string) => Promise<void>
  onRemoveMember: (groupId: string, userId: string) => Promise<void>
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
  group,
  userId,
  medics,
  onClose,
  onLeave,
  onRename,
  onAddMember,
  onRemoveMember,
  fetchMembers,
}: GroupInfoPanelProps) {
  const [members, setMembers] = useState<GroupMember[]>([])
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameText, setNameText] = useState(group.name)

  const isAdmin = members.some(m => m.userId === userId && m.role === 'admin')
  const memberIds = new Set(members.map(m => m.userId))

  useEffect(() => {
    fetchMembers(group.groupId).then(setMembers)
  }, [group.groupId, fetchMembers])

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

  const nonMemberMedics = medics.filter(m => !memberIds.has(m.id))

  return (
    <div className="absolute inset-0 z-10 bg-themewhite3 flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-primary/10 flex items-center justify-between">
        <p className="text-sm font-medium text-primary">Group Info</p>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-primary/5 active:scale-95 transition-all">
          <X size={18} className="text-tertiary" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Group name */}
        <div className="px-4 py-4 flex items-center gap-3">
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
              {isAdmin && (
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
            {isAdmin && (
              <button
                onClick={() => setShowAddPicker(!showAddPicker)}
                className="flex items-center gap-1 text-[10pt] text-themeblue2 hover:text-themeblue2/80"
              >
                <UserPlus size={12} />
                Add
              </button>
            )}
          </div>

          {/* Add member picker */}
          {showAddPicker && nonMemberMedics.length > 0 && (
            <div className="mb-3 border border-primary/10 rounded-xl overflow-hidden">
              {nonMemberMedics.map(medic => (
                <button
                  key={medic.id}
                  onClick={() => handleAddMember(medic.id)}
                  className="flex items-center w-full px-3 py-2 gap-2 hover:bg-themewhite2 transition-colors"
                >
                  <UserAvatar avatarId={medic.avatarId} firstName={medic.firstName} lastName={medic.lastName} className="w-7 h-7" />
                  <span className="flex-1 text-sm text-primary truncate">
                    {[medic.rank, medic.lastName].filter(Boolean).join(' ') || medic.firstName || 'Unknown'}
                  </span>
                  <UserPlus size={14} className="text-themeblue2/60" />
                </button>
              ))}
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
                  <span className="text-[9pt] text-themeblue2 font-medium">Admin</span>
                )}
              </div>
              {isAdmin && member.userId !== userId && (
                <button
                  onClick={() => handleRemoveMember(member.userId)}
                  className="p-1.5 rounded-full hover:bg-themeredred/10 active:scale-95 transition-all"
                >
                  <UserMinus size={14} className="text-red-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Leave group button */}
      <div className="shrink-0 px-4 py-3 border-t border-primary/10">
        <button
          onClick={() => onLeave(group.groupId)}
          className="w-full py-2.5 rounded-full border border-red-200 text-sm font-medium
                     text-red-500 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <LogOut size={14} />
          Leave Group
        </button>
      </div>
    </div>
  )
}
