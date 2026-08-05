import { ChevronRight, BadgeCheck, Plus } from 'lucide-react'
import { FillBar } from '@/Components/primitives/FillBar'
import { SectionCard } from '@/Components/primitives/Section'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { formatMedicName, type CertHolder, type CertTitleRow } from './supervisorHelpers'
import { formatCertDate, statusLabel } from '../../Certifications/certHelpers'

/**
 * The Certs stop: which credentials the scope holds, and who is short.
 *
 * ONE ROUTE, like Training's. A credential row goes to the same holder roster at
 * every scope the rail can point at, and a holder row goes to the same terminal.
 * At soldier scope the roster is one name — which is a roster of one, not a
 * different surface — because a scope may change the numbers on a row and may
 * not change where the row goes.
 *
 * THE BAR IS VALID / HEADCOUNT, NOT VALID / HELD. A clinic where two people hold
 * BLS and both are current is not 100% covered, it is two-fourteenths covered,
 * and the question this stop is asked is what the unit can field. Held is stated
 * beside it so the gap reads as "nine hold it, seven are current" rather than a
 * single number that could mean either.
 */
interface CertsViewProps {
  /** One row per credential in scope, alphabetical. */
  rows: CertTitleRow[]
  /** The open credential's holders, worst first. Empty until one is open. */
  holders: CertHolder[]
  /** The open credential's display title, or null for the list. Owned by the
   *  host, so back walks it like every other center drill. */
  title?: string | null
  /** Soldier scope: the numbers are out of one, and "1/1" is a fraction nobody
   *  reads as a yes. */
  single: boolean
  onSelectTitle?: (row: CertTitleRow) => void
  /** Open one cert's terminal. Absent where there is no pane to open it in. */
  onOpenCert?: (holder: CertHolder) => void
  /** Add a certification. Soldier scope only — a cert belongs to a person, and
   *  at group scope there is no one row to write it against. */
  onAddCert?: () => void
}

export function CertsView({
  rows,
  holders,
  title = null,
  single,
  onSelectTitle,
  onOpenCert,
  onAddCert,
}: CertsViewProps) {
  if (title) {
    return (
      <div>
        <SectionCard>
          {holders.map(({ soldier, cert, status }) => {
            const s = statusLabel(status)
            return (
              <button
                key={cert.id}
                onClick={() => onOpenCert?.({ soldier, cert, status })}
                disabled={!onOpenCert}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all
                  hover:bg-themeblue2/5 active:scale-95 disabled:active:scale-100
                  border-t border-tertiary/8 first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-primary truncate">{formatMedicName(soldier)}</p>
                  <p className="text-[9pt] text-tertiary">
                    {cert.exp_date ? `Expires ${formatCertDate(cert.exp_date)}` : 'No expiration on file'}
                  </p>
                </div>
                {/* Verified is a supervisor's signature, so its absence is the
                    actionable state — the check marks the ones already signed
                    and an unverified row simply carries none. */}
                {cert.verified && (
                  <BadgeCheck size={15} className="text-themegreen shrink-0" />
                )}
                <span className={`text-[9pt] font-semibold px-2 py-0.5 rounded-full shrink-0 ${s.cls}`}>
                  {s.text}
                </span>
                {onOpenCert && <ChevronRight size={16} className="text-tertiary shrink-0" />}
              </button>
            )
          })}
        </SectionCard>
      </div>
    )
  }

  if (rows.length === 0) {
    return onAddCert ? (
      <EmptyState
        title="Add a certification"
        action={{ icon: Plus, label: 'Add certification', onClick: () => onAddCert() }}
      />
    ) : (
      <EmptyState title="No certifications on file for this scope." />
    )
  }

  return (
    <div>
      <SectionCard>
        {rows.map(row => (
          <button
            key={row.key}
            onClick={() => onSelectTitle?.(row)}
            disabled={!onSelectTitle}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all
              hover:bg-themeblue2/5 active:scale-95 disabled:active:scale-100
              border-t border-tertiary/8 first:border-t-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-primary truncate">{row.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <FillBar
                  className="flex-1 min-w-0"
                  percent={row.pct}
                  value={single ? (row.valid > 0 ? 'Current' : 'Not current') : `${row.valid}/${row.total}`}
                  valueWidth={single ? 'w-20' : 'w-12'}
                />
              </div>
              {/* Only the states that need an act. A row of zeroes for a
                  credential everyone holds and nobody has let lapse is a line
                  that says nothing is wrong, which the bar already said. */}
              {(row.expiring > 0 || row.expired > 0 || row.unverified > 0) && (
                <p className="text-[9pt] text-tertiary mt-1">
                  {[
                    row.expired > 0 ? `${row.expired} expired` : null,
                    row.expiring > 0 ? `${row.expiring} expiring` : null,
                    row.unverified > 0 ? `${row.unverified} unverified` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {onSelectTitle && <ChevronRight size={16} className="text-tertiary shrink-0" />}
          </button>
        ))}
      </SectionCard>
    </div>
  )
}
