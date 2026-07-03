import { useState } from 'react'
import { Building2, ChevronRight, Users } from 'lucide-react'
import { useEchelonSummaries, type ChildClinicCard } from '../../../Hooks/useEchelonSummaries'
import { ChildClinicRosterSheet } from './ChildClinicRosterSheet'

/**
 * "Subordinate Units" — echelon roll-up cards for a parent-cluster supervisor.
 * One card per DIRECT child clinic (one level down; no further drill). Each shows
 * the child's de-identified readiness/compliance/coverage IF the child has fanned
 * a summary up, else the "No active users" state. Renders nothing when the clinic
 * has no children, so it's safe to mount unconditionally on the supervisor surface.
 *
 * Numbers come from the child (which alone can decrypt its own training data);
 * the parent never decrypts child data — see echelonSummary.ts.
 */

// Two-tone metric scheme, matching TeamReporting.
function barColor(pct: number): string {
  return pct >= 50 ? 'bg-themeblue3/50' : 'bg-themeredred'
}
function textColor(pct: number): string {
  return pct >= 50 ? 'text-themeblue3' : 'text-themeredred'
}

/** Compact "3h ago" / "2d ago" staleness from an ISO timestamp. */
function agoLabel(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function MetricRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9pt] text-tertiary w-18 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
        <div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[9pt] font-medium w-8 text-right ${textColor(pct)}`}>{pct}%</span>
    </div>
  )
}

function ChildCard({ card, onOpen }: { card: ChildClinicCard; onOpen: () => void }) {
  const { clinicName, medicCount, summary } = card
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-xl bg-themewhite2 px-4 py-3 hover:bg-secondary/5 active:scale-[0.99] transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
          <Building2 size={16} className="text-tertiary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary truncate">{clinicName}</p>
          <p className="text-[9pt] text-tertiary">
            {medicCount} personnel
            {summary && <span> · updated {agoLabel(summary.computed_at)}</span>}
          </p>
        </div>
        {summary && summary.coverage_gap_count > 0 && (
          <span className="shrink-0 text-[9pt] font-medium px-2 py-0.5 rounded-full bg-themeredred/10 text-themeredred">
            {summary.coverage_gap_count} gap{summary.coverage_gap_count === 1 ? '' : 's'}
          </span>
        )}
        <ChevronRight size={16} className="text-tertiary shrink-0" />
      </div>

      {summary ? (
        <div className="flex flex-col gap-1.5 mt-2 ml-11">
          <MetricRow label="Readiness" pct={summary.readiness_pct} />
          <MetricRow label="Compliance" pct={summary.cert_pct} />
        </div>
      ) : (
        <div className="mt-2 ml-11 flex items-center gap-2 text-[9pt] text-tertiary">
          <Users size={13} className="shrink-0" />
          <span>No active users. Cannot compute summary data.</span>
        </div>
      )}
    </button>
  )
}

export function SubordinateUnitsCards({
  clinicId,
  isSupervisor,
  currentUserId,
}: {
  clinicId: string | null
  isSupervisor: boolean
  currentUserId?: string | null
}) {
  const { cards } = useEchelonSummaries(clinicId, isSupervisor)
  const [openChild, setOpenChild] = useState<{ id: string; name: string } | null>(null)
  if (cards.length === 0) return null

  return (
    <div>
      <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
        Subordinate Units
      </p>
      <div className="space-y-2">
        {cards.map((card) => (
          <ChildCard
            key={card.clinicId}
            card={card}
            onOpen={() => setOpenChild({ id: card.clinicId, name: card.clinicName })}
          />
        ))}
      </div>

      {openChild && (
        <ChildClinicRosterSheet
          clinicId={openChild.id}
          clinicName={openChild.name}
          currentUserId={currentUserId ?? null}
          onClose={() => setOpenChild(null)}
        />
      )}
    </div>
  )
}
