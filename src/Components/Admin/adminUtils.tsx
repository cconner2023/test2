import { Star, CheckCircle } from 'lucide-react'
import type { Certification } from '../../Data/User'

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

export const RoleBadge = ({ role }: { role: string }) => {
  const colors: Record<string, string> = {
    medic: 'bg-themeblue2/10 text-themeblue2 border-themeblue2/30',
    supervisor: 'bg-themeyellow/10 text-themeyellow border-themeyellow/30',
    dev: 'bg-themepurple/10 text-themepurple border-themepurple/30',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[role] || 'bg-tertiary/10 text-tertiary border-tertiary/30'}`}>
      {role}
    </span>
  )
}

export function getExpirationStatus(expDate: string | null): 'valid' | 'expiring' | 'expired' | 'none' {
  if (!expDate) return 'none'
  const now = new Date()
  const exp = new Date(expDate)
  const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'expired'
  if (diffDays <= 90) return 'expiring'
  return 'valid'
}

export const certBadgeColors = {
  valid:    'bg-themegreen/10 text-themegreen border-themegreen/30',
  expiring: 'bg-themeyellow/10 text-themeyellow border-themeyellow/30',
  expired:  'bg-themeredred/10 text-themeredred border-themeredred/30',
  none:     'bg-tertiary/5 text-tertiary/50 border-tertiary/20',
} as const

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
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium border ${color}`}
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
