import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import { getDisplayName } from '../../Utilities/nameUtils'
import { UserAvatar } from './UserAvatar'

interface ContactListItemProps {
  medic: ClinicMedic
  lastMessage?: string
  unreadCount?: number
  onClick: () => void
}

export function ContactListItem({ medic, lastMessage, unreadCount, onClick }: ContactListItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center w-full px-4 py-3 rounded-xl text-left transition-all
                 hover:bg-themewhite2 active:scale-[0.98] cursor-pointer gap-3"
    >
      {/* Avatar */}
      <UserAvatar avatarId={medic.avatarId} firstName={medic.firstName} lastName={medic.lastName} className="w-10 h-10" />

      {/* Name + last message preview */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">{getDisplayName(medic)}</p>
        {medic.credential && (
          <p className="text-[10px] text-tertiary/50">{medic.credential}</p>
        )}
        {lastMessage && (
          <p className="text-xs text-tertiary/60 truncate mt-0.5">{lastMessage}</p>
        )}
      </div>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <div className="w-5 h-5 rounded-full bg-themeblue2 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
        </div>
      )}
    </button>
  )
}
