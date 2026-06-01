import { profileAvatars } from '../../Data/ProfileAvatars'
import { getInitials } from '../../Utilities/nameUtils'
import { useResolvedAvatar } from '../../Hooks/useResolvedAvatar'
import type { AvatarBlob } from '../../Types/SupervisorTestTypes'

interface UserAvatarProps {
  avatarId: string | null | undefined
  firstName: string | null | undefined
  lastName: string | null | undefined
  className?: string
  /** Encrypted custom photo when avatarId === 'custom' (from fetch_profiles_by_ids / roster). */
  avatarBlob?: AvatarBlob | null
  /** Lets the signed-in user render their own seeded custom photo without a blob. */
  userId?: string | null
}

/** Renders a user's custom photo, preset avatar (SVG), or initials fallback. */
export function UserAvatar({ avatarId, firstName, lastName, className = 'w-10 h-10', avatarBlob, userId }: UserAvatarProps) {
  const customUrl = useResolvedAvatar(avatarId, avatarBlob, userId)
  const avatar = avatarId && avatarId !== 'custom' ? profileAvatars.find(a => a.id === avatarId) : undefined

  if (customUrl) {
    return (
      <div className={`${className} rounded-full overflow-hidden shrink-0`}>
        <img src={customUrl} alt="" className="w-full h-full object-cover" />
      </div>
    )
  }

  if (avatar) {
    return (
      <div className={`${className} rounded-full overflow-hidden shrink-0 [&>svg]:w-full [&>svg]:h-full`}>
        {avatar.svg}
      </div>
    )
  }

  // Initials fallback
  const initials = getInitials(firstName, lastName)

  return (
    <div className={`${className} rounded-full bg-themeblue2/15 flex items-center justify-center shrink-0`}>
      <span className="text-sm font-semibold text-themeblue2">{initials}</span>
    </div>
  )
}
