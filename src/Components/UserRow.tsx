import { ChevronRight } from 'lucide-react'
import { UserAvatar } from './Settings/UserAvatar'
import { lastActiveColor } from './Admin/adminUtils'

// ─── Types ────────────────────────────────────────────────────────────

interface UserRowProps {
  /** Avatar identifier for SVG lookup */
  avatarId?: string | null
  firstName?: string | null
  lastName?: string | null
  middleInitial?: string | null
  rank?: string | null
  /** ISO timestamp — drives activity dot color */
  lastActiveAt?: string | null

  /** Rendered below the name. Caller builds context-appropriate content. */
  subtitle?: string
  /** Show the colored activity dot on the avatar (default true) */
  showActivityDot?: boolean
  /** Show a trailing chevron (default true) */
  showChevron?: boolean
  /** Avatar diameter — 'sm' = 36px row, 'md' = 44px detail header */
  size?: 'sm' | 'md'
  /** Custom content rendered to the right of the name/subtitle block */
  right?: React.ReactNode

  onClick?: () => void
  className?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────

const AVATAR_CLASS = { sm: 'w-9 h-9', md: 'w-11 h-11' } as const
const DOT_CLASS = { sm: 'w-2.5 h-2.5', md: 'w-2.5 h-2.5' } as const

export function formatUserName(
  rank: string | null | undefined,
  firstName: string | null | undefined,
  middleInitial: string | null | undefined,
  lastName: string | null | undefined,
): string {
  return [rank, firstName, middleInitial, lastName]
    .filter(Boolean)
    .join(' ')
}

// ─── Component ────────────────────────────────────────────────────────

export function UserRow({
  avatarId,
  firstName,
  lastName,
  middleInitial,
  rank,
  lastActiveAt,
  subtitle,
  showActivityDot = true,
  showChevron = true,
  size = 'sm',
  right,
  onClick,
  className,
}: UserRowProps) {
  const name = formatUserName(rank, firstName, middleInitial, lastName)

  const content = (
    <>
      {/* Avatar + activity dot */}
      <div className="relative shrink-0">
        <UserAvatar
          avatarId={avatarId}
          firstName={firstName}
          lastName={lastName}
          className={AVATAR_CLASS[size]}
        />
        {showActivityDot && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 ${DOT_CLASS[size]} rounded-full border-2 border-themewhite2 ${lastActiveColor(lastActiveAt ?? null)}`}
          />
        )}
      </div>

      {/* Name + subtitle */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">
          {name || '\u00A0'}
        </p>
        {subtitle && (
          <p className="text-[11px] text-tertiary/70 mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>

      {/* Right slot */}
      {right}

      {/* Chevron */}
      {showChevron && (
        <ChevronRight size={16} className="text-tertiary/40 shrink-0" />
      )}
    </>
  )

  const baseClass = `flex items-center gap-3 px-4 py-3.5${className ? ` ${className}` : ''}`

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClass} w-full text-left transition-all active:scale-95 hover:bg-themeblue2/5`}
      >
        {content}
      </button>
    )
  }

  return <div className={baseClass}>{content}</div>
}
