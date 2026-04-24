import { Award } from 'lucide-react'
import type { Certification } from '../../Data/User'
import { getExpirationStatus, statusLabel, formatCertDate } from './certHelpers'

interface CertificationRowProps {
  cert: Certification
  onClick?: () => void
}

export function CertificationRow({ cert, onClick }: CertificationRowProps) {
  const status = getExpirationStatus(cert.exp_date)
  const badge = statusLabel(status)

  const body = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
          <Award size={18} className="text-tertiary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary truncate">{cert.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9pt] text-tertiary">
              {cert.cert_number ? `#${cert.cert_number}` : 'No cert number'}
            </span>
            {cert.is_primary && (
              <>
                <span className="text-[9pt] text-tertiary">&middot;</span>
                <span className="text-[9pt] text-tertiary">Primary</span>
              </>
            )}
            {cert.exp_date && (
              <>
                <span className="text-[9pt] text-tertiary">&middot;</span>
                <span className="text-[9pt] text-tertiary">{formatCertDate(cert.exp_date)}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <span className={`text-[9pt] md:text-[9pt] font-medium px-1.5 py-0.5 rounded shrink-0 ${badge.cls}`}>
        {badge.text}
      </span>
    </div>
  )

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        }}
        className="px-4 py-3.5 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
      >
        {body}
      </div>
    )
  }

  return <div className="px-4 py-3.5">{body}</div>
}
