import type { Certification } from '../../Data/User'
import { useRowDensity, ROW_META } from '@/Components/primitives/rowDensity'
import { getExpirationStatus, formatCertDate } from './certHelpers'

interface CertificationRowProps {
  cert: Certification
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}

export function CertificationRow({ cert, onClick }: CertificationRowProps) {
  const isExpired = getExpirationStatus(cert.exp_date) === 'expired'
  const d = useRowDensity()

  const body = (
    <div className="min-w-0">
      <p className={`${d.label} font-medium text-primary truncate`}>{cert.title}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <span className={ROW_META}>
          {cert.cert_number ? `#${cert.cert_number}` : 'No cert number'}
        </span>
        {cert.is_primary && (
          <>
            <span className={ROW_META}>&middot;</span>
            <span className={ROW_META}>Primary</span>
          </>
        )}
        {cert.exp_date && (
          <>
            <span className={ROW_META}>&middot;</span>
            <span className={`text-[9pt] ${isExpired ? 'text-themeredred font-medium' : 'text-tertiary'}`}>
              {formatCertDate(cert.exp_date)}
            </span>
          </>
        )}
      </div>
    </div>
  )

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => onClick(e)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            ;(e.currentTarget as HTMLDivElement).click()
          }
        }}
        className={`${d.pad} ${d.press} cursor-pointer transition-all hover:bg-themeblue2/5`}
      >
        {body}
      </div>
    )
  }

  return <div className={d.pad}>{body}</div>
}
