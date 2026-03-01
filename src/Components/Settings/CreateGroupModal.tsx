import { useState, useCallback } from 'react'
import { X, Check } from 'lucide-react'
import { UserAvatar } from './UserAvatar'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'

interface CreateGroupModalProps {
  medics: ClinicMedic[]
  onClose: () => void
  onCreate: (name: string, memberIds: string[]) => Promise<string | null>
}

function getDisplayName(medic: ClinicMedic): string {
  const parts: string[] = []
  if (medic.rank) parts.push(medic.rank)
  if (medic.lastName) {
    let name = medic.lastName
    if (medic.firstName) name += `, ${medic.firstName.charAt(0)}.`
    parts.push(name)
  }
  return parts.join(' ') || 'Unknown'
}

export function CreateGroupModal({ medics, onClose, onCreate }: CreateGroupModalProps) {
  const [name, setName] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)

  const toggleMember = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed || selectedIds.size === 0 || creating) return

    setCreating(true)
    const groupId = await onCreate(trimmed, [...selectedIds])
    setCreating(false)
    if (groupId) onClose()
  }, [name, selectedIds, creating, onCreate, onClose])

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-themewhite3 rounded-2xl w-[90%] max-w-md max-h-[80vh] flex flex-col shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-primary/10 flex items-center justify-between">
          <p className="text-sm font-medium text-primary">New Group</p>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-primary/5 active:scale-95 transition-all">
            <X size={18} className="text-tertiary" />
          </button>
        </div>

        {/* Group name input */}
        <div className="shrink-0 px-4 pt-3 pb-2">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Group name"
            autoFocus
            className="w-full px-4 py-2.5 rounded-full bg-themewhite2 text-sm text-primary
                       placeholder:text-tertiary/40 outline-none focus:ring-1 focus:ring-themeblue2/40 transition-all"
          />
        </div>

        {/* Member selection */}
        <p className="text-xs text-tertiary/60 px-4 mb-1">Select members</p>
        <div className="flex-1 overflow-y-auto px-2">
          {medics.map(medic => (
            <button
              key={medic.id}
              onClick={() => toggleMember(medic.id)}
              className="flex items-center w-full px-4 py-2.5 rounded-xl text-left gap-3
                         hover:bg-themewhite2 active:scale-[0.98] transition-all"
            >
              <UserAvatar avatarId={medic.avatarId} firstName={medic.firstName} lastName={medic.lastName} className="w-8 h-8" />
              <span className="flex-1 text-sm text-primary truncate">{getDisplayName(medic)}</span>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                             ${selectedIds.has(medic.id) ? 'bg-themeblue2 border-themeblue2' : 'border-tertiary/30'}`}>
                {selectedIds.has(medic.id) && <Check size={12} className="text-white" />}
              </div>
            </button>
          ))}
        </div>

        {/* Create button */}
        <div className="shrink-0 px-4 py-3 border-t border-primary/10">
          <button
            onClick={handleCreate}
            disabled={!name.trim() || selectedIds.size === 0 || creating}
            className="w-full py-2.5 rounded-full bg-themeblue2 text-sm font-medium text-white
                       disabled:opacity-30 active:scale-[0.98] transition-all"
          >
            {creating ? 'Creating...' : `Create Group (${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
