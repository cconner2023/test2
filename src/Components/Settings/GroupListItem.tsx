import { Users } from 'lucide-react'
import type { GroupInfo } from '../../lib/signal/groupTypes'
import { ListItemRow, UnreadBadge } from '../ListItemRow'

interface GroupListItemProps {
  group: GroupInfo
  lastMessage?: string
  unreadCount?: number
  onClick: () => void
}

export function GroupListItem({ group, lastMessage, unreadCount, onClick }: GroupListItemProps) {
  return (
    <ListItemRow
      onClick={onClick}
      className="px-4 py-3 rounded-xl transition-all hover:bg-themewhite2 active:scale-95 cursor-pointer"
      left={
        <div className="w-10 h-10 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
          <Users size={18} className="text-themeblue2" />
        </div>
      }
      center={
        <>
          <p className="text-sm font-medium text-primary truncate">{group.name}</p>
          <p className="text-[10px] text-tertiary/50">{group.memberCount} members</p>
          {lastMessage && (
            <p className="text-xs text-tertiary/60 truncate mt-0.5">{lastMessage}</p>
          )}
        </>
      }
      right={<UnreadBadge count={unreadCount ?? 0} />}
    />
  )
}
