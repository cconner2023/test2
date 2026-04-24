import { Star, CheckCircle, UserPlus } from 'lucide-react'
import type { Certification } from '../../Data/User'
import { getExpirationStatus, certBadgeColors } from '../Certifications/certHelpers'

/** Format a timestamp as a human-readable relative time string */
export const formatLastActive = (isoString: string | null): string => {
  if (!isoString) return 'Never'
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  if (diffMs < 0) return 'Just now'
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

/** Color class for the last-active indicator dot */
export const lastActiveColor = (isoString: string | null): string => {
  if (!isoString) return 'bg-tertiary/30'
  const hrs = (Date.now() - new Date(isoString).getTime()) / 3_600_000
  if (hrs < 24) return 'bg-themegreen'
  if (hrs < 168) return 'bg-themeyellow'
  return 'bg-tertiary/40'
}

/** Condensed 1-letter role abbreviation */
const ROLE_ABBREV: Record<string, string> = {
  medic: 'M',
  supervisor: 'S',
  dev: 'D',
  admin: 'A',
  credentials_manager: 'C',
}

export const RoleBadge = ({ role }: { role: string }) => {
  const colors: Record<string, string> = {
    medic: 'bg-themeblue2/10 text-themeblue2 border-themeblue2/30',
    supervisor: 'bg-themeyellow/10 text-themeyellow border-themeyellow/30',
    dev: 'bg-themepurple/10 text-themepurple border-themepurple/30',
    admin: 'bg-themegreen/10 text-themegreen border-themegreen/30',
    credentials_manager: 'bg-themeblue2/10 text-themeblue2 border-themeblue2/30',
  }
  const label = ROLE_ABBREV[role] ?? role.charAt(0).toUpperCase()
  return (
    <span
      title={role}
      className={`w-5 h-5 flex items-center justify-center rounded text-[9pt] md:text-[9pt] font-bold border shrink-0 ${colors[role] || 'bg-tertiary/10 text-tertiary border-tertiary/30'}`}
    >
      {label}
    </span>
  )
}

/** Badge marking a user onboarded via the supervisor drawer (not admin-created). */
export const SupervisorCreatedBadge = () => (
  <span
    title="Created by supervisor"
    className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded text-[9pt] font-medium border bg-themeyellow/10 text-themeyellow border-themeyellow/30 shrink-0"
  >
    <UserPlus size={10} />
    Sup
  </span>
)

/** Inline cert badges for user cards */
export function CertBadges({ certs }: { certs: Certification[] }) {
  if (certs.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1">
      {certs.map((cert) => {
        const status = getExpirationStatus(cert.exp_date)
        const color = certBadgeColors[status]
        return (
          <span
            key={cert.id}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9pt] md:text-[9pt] font-medium border ${color}`}
          >
            {cert.title}
            {cert.is_primary && <Star size={8} className="fill-current" />}
            {cert.verified && <CheckCircle size={8} />}
          </span>
        )
      })}
    </div>
  )
}
