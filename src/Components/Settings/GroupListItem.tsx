import { Users } from 'lucide-react'
import type { GroupInfo } from '../../lib/signal/groupTypes'

interface GroupListItemProps {
  group: GroupInfo
  lastMessage?: string
  unreadCount?: number
  onClick: () => void
}

export function GroupListItem({ group, lastMessage, unreadCount, onClick }: GroupListItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center w-full px-4 py-3 rounded-xl text-left transition-all
                 hover:bg-themewhite2 active:scale-[0.98] cursor-pointer gap-3"
    >
      {/* Group icon */}
      <div className="w-10 h-10 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
        <Users size={18} className="text-themeblue2" />
      </div>

      {/* Name + last message preview */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">{group.name}</p>
        <p className="text-[10px] text-tertiary/50">{group.memberCount} members</p>
        {lastMessage && (
          <p className="text-xs text-tertiary/60 truncate mt-0.5">{lastMessage}</p>
        )}
      </div>

      {/* Unread badge */}
      {!!unreadCount && unreadCount > 0 && (
        <div className="w-5 h-5 rounded-full bg-themeblue2 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
        </div>
      )}
    </button>
  )
}
