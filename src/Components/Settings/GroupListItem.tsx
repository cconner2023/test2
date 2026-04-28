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
      className="px-4 py-4 transition-all duration-150 hover:bg-primary/3 active:scale-[0.98] cursor-pointer"
      left={
        <div className="w-10 h-10 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
          <Users size={18} className="text-themeblue2" />
        </div>
      }
      center={
        <>
          <p className="text-sm font-medium text-primary truncate">{group.name}</p>
          <p className="text-[9pt] text-tertiary">{group.memberCount} members</p>
          {lastMessage && (
            <p className="text-[10pt] text-tertiary truncate mt-0.5">{lastMessage}</p>
          )}
        </>
      }
      right={<UnreadBadge count={unreadCount ?? 0} />}
    />
  )
}
