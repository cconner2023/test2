import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import { getDisplayName } from '../../Utilities/nameUtils'
import { UserAvatar } from './UserAvatar'
import { ListItemRow, UnreadBadge } from '../ListItemRow'

interface ContactListItemProps {
  medic: ClinicMedic
  lastMessage?: string
  unreadCount?: number
  onClick: () => void
  unavailable?: boolean
}

export function ContactListItem({ medic, lastMessage, unreadCount, onClick, unavailable }: ContactListItemProps) {
  return (
    <ListItemRow
      onClick={onClick}
      className={`px-4 py-3 rounded-xl transition-all hover:bg-themewhite2 active:scale-[0.98] cursor-pointer${unavailable ? ' opacity-50' : ''}`}
      left={
        <UserAvatar avatarId={medic.avatarId} firstName={medic.firstName} lastName={medic.lastName} className="w-10 h-10" />
      }
      center={
        <>
          <p className="text-sm font-medium text-primary truncate">{getDisplayName(medic)}</p>
          {unavailable ? (
            <p className="text-[10px] text-amber-500/80">No active device</p>
          ) : (
            <>
              {medic.credential && (
                <p className="text-[10px] text-tertiary/50">{medic.credential}</p>
              )}
              {lastMessage && (
                <p className="text-xs text-tertiary/60 truncate mt-0.5">{lastMessage}</p>
              )}
            </>
          )}
        </>
      }
      right={<UnreadBadge count={unreadCount ?? 0} />}
    />
  )
}
