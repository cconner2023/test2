import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import type { UnavailableReason } from '../../Hooks/usePeerAvailability'
import { getDisplayName } from '../../Utilities/nameUtils'
import { UserAvatar } from './UserAvatar'
import { ListItemRow, UnreadBadge } from '../ListItemRow'

interface ContactListItemProps {
  medic: ClinicMedic
  lastMessage?: string
  unreadCount?: number
  onClick: () => void
  unavailable?: boolean
  unavailableReason?: UnavailableReason
}

const UNAVAILABLE_LABELS: Record<UnavailableReason, string> = {
  no_device: 'Not yet registered',
  no_keys: 'Setting up encryption',
}

export function ContactListItem({ medic, lastMessage, unreadCount, onClick, unavailable, unavailableReason }: ContactListItemProps) {
  return (
    <ListItemRow
      onClick={onClick}
      className={`px-4 py-3 transition-all duration-150 hover:bg-primary/3 active:scale-[0.98] cursor-pointer${unavailable ? ' opacity-50' : ''}`}
      left={
        <UserAvatar avatarId={medic.avatarId} firstName={medic.firstName} lastName={medic.lastName} className="w-10 h-10" />
      }
      center={
        <>
          <p className="text-sm font-medium text-primary truncate">{getDisplayName(medic)}</p>
          {unavailable ? (
            <p className="text-[10px] text-thememuted">{UNAVAILABLE_LABELS[unavailableReason ?? 'no_device']}</p>
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
