import { profileAvatars } from '../../Data/ProfileAvatars'
import { getInitials } from '../../Utilities/nameUtils'

interface UserAvatarProps {
  avatarId: string | null | undefined
  firstName: string | null | undefined
  lastName: string | null | undefined
  className?: string
}

/** Renders a user's profile avatar (SVG) or falls back to initials. */
export function UserAvatar({ avatarId, firstName, lastName, className = 'w-10 h-10' }: UserAvatarProps) {
  const avatar = avatarId ? profileAvatars.find(a => a.id === avatarId) : undefined

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
