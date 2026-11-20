import { displayGroupName, type GroupInfo } from '../../lib/signal/groupTypes'
import { ListItemRow, UnreadBadge, RowMoreButton } from '@/Components/primitives/ListItemRow'

interface GroupListItemProps {
  group: GroupInfo
  lastMessage?: string
  unreadCount?: number
  onClick: () => void
  /** Ellipsis → the row's context menu (rect = the row). */
  onMore?: (rect: DOMRect) => void
}

export function GroupListItem({ group, lastMessage, unreadCount, onClick, onMore }: GroupListItemProps) {
  const label = displayGroupName(group.name)
  return (
    <ListItemRow
      as={onMore ? 'div' : 'button'}
      onClick={onClick}
      className="px-4 py-4 transition-all duration-150 hover:bg-primary/3 active:scale-[0.98] cursor-pointer"
      left={
        <div className="w-10 h-10 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
          <span className="text-sm font-semibold text-themeblue2 uppercase">{label.slice(0, 2)}</span>
        </div>
      }
      center={
        <>
          <p className="text-sm font-medium text-primary truncate">{label}</p>
          {lastMessage && (
            <p className="text-[10pt] text-tertiary truncate mt-0.5">{lastMessage}</p>
          )}
        </>
      }
      right={onMore ? (
        <div className="flex items-center gap-2 shrink-0">
          <UnreadBadge count={unreadCount ?? 0} />
          <RowMoreButton onMore={onMore} />
        </div>
      ) : <UnreadBadge count={unreadCount ?? 0} />}
    />
  )
}
