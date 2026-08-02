import { useState } from 'react'
import { Building2, ChevronRight } from 'lucide-react'
import { useEchelonSummaries } from '../../../Hooks/useEchelonSummaries'
import { ChildClinicRosterSheet } from './ChildClinicRosterSheet'
import { PageSectionHeader } from '@/Components/primitives/Section'

/**
 * "Subordinate Clusters" — the echelon child-cluster ROSTER-MANAGEMENT surface for
 * cluster management (ClinicPanel), mirroring the Supervisor drawer's echelon drill.
 *
 * DELIBERATE SPLIT (2026-07-07, restated 2026-07-30): the Supervisor drawer is the STATS
 * lens; THIS is the user-CRUD lens. Same child clusters (useEchelonSummaries), same shared
 * editor (ChildClinicRosterSheet → ChildClinicRosterBody, echelon-subtree authorized via
 * auth_supervisor_scope_ids), but here we show a plain name + personnel-count list — NO
 * readiness bars — so cluster management stays the place you MANAGE people and Supervisor
 * stays the place you READ numbers. The editing logic is shared, so the two surfaces
 * cannot drift.
 *
 * The supervisor side used to be SubordinateUnitsCards, a card stack at the bottom of the
 * dashboard scroll. Child clusters are now rows in the supervisor rail's tree, so the
 * cards are gone and the split is drawer-vs-ClinicPanel rather than two components.
 *
 * Renders nothing when the clinic has no children, so it's safe to mount unconditionally
 * under the supervisor gate.
 */
export function SubordinateClustersManager({
  clinicId,
  isSupervisor,
  currentUserId,
  onSelectChild,
  activeChildId,
}: {
  clinicId: string | null
  isSupervisor: boolean
  currentUserId: string | null
  /** When provided (desktop), tapping a card routes the drill to the Settings
   *  right pane instead of opening the local Sheet. */
  onSelectChild?: (child: { id: string; name: string }) => void
  /** Highlights the card whose roster is open in the right pane (desktop). */
  activeChildId?: string | null
}) {
  const { cards } = useEchelonSummaries(clinicId, isSupervisor)
  const [openChild, setOpenChild] = useState<{ id: string; name: string } | null>(null)
  if (cards.length === 0) return null

  const handleOpen = (child: { id: string; name: string }) => {
    if (onSelectChild) onSelectChild(child)
    else setOpenChild(child)
  }

  return (
    <section>
      <PageSectionHeader>Subordinate Clusters</PageSectionHeader>
      <div className="rounded-xl bg-themewhite2 overflow-hidden">
        <div className="px-4 py-3">
          <div className="space-y-1">
            {cards.map((card) => (
              <button
                key={card.clinicId}
                type="button"
                onClick={() => handleOpen({ id: card.clinicId, name: card.clinicName })}
                className={`w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left hover:bg-secondary/5 active:scale-95 transition-all ${
                  card.clinicId === activeChildId ? 'bg-themeblue3/8' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-tertiary/10 shrink-0">
                  <Building2 size={14} className="text-tertiary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary truncate">
                    {card.clinicName}
                    <span className="text-tertiary font-normal"> · {card.medicCount} personnel</span>
                  </p>
                </div>
                <ChevronRight size={16} className="text-tertiary shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile host: inline Sheet. Desktop routes to the right pane via onSelectChild. */}
      {!onSelectChild && openChild && (
        <ChildClinicRosterSheet
          clinicId={openChild.id}
          clinicName={openChild.name}
          currentUserId={currentUserId}
          onClose={() => setOpenChild(null)}
        />
      )}
    </section>
  )
}
