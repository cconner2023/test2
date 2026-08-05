import { ClipboardList } from 'lucide-react'
import { useAuthStore } from '../../stores/useAuthStore'
import { useSelfReadiness } from '../../Hooks/useSelfReadiness'
import { getEvaluableTaskData } from '../../Utilities/algorithmCompetency'
import { PageSectionHeader, SectionCard } from '@/Components/primitives/Section'
import { FillBar } from '@/Components/primitives/FillBar'
import { useRowDensity } from '@/Components/primitives/rowDensity'
import type { Certification } from '../../Data/User'

/**
 * MyReadinessSection — the read-only self-facing mirror of the supervisor's
 * per-soldier readiness lens, scoped to the current user.
 *
 * The numbers come from useSelfReadiness, which runs the SAME pure helpers the
 * supervisor runs over a subordinate — so a medic sees exactly what their team
 * lead sees about them, minus every edit/evaluate control. The desktop settings
 * rail's pinned card reads that same hook, which is why the rail card and this
 * section cannot disagree.
 *
 * Every bar here is the FillBar primitive, the one the supervisor readiness
 * surfaces already use. The local `readinessColor` / `readinessTextColor` pair
 * this file used to carry was a byte-for-byte re-derivation of FillBar's own
 * threshold — two copies of one rule, which is how a threshold change lands on
 * the supervisor view and not the self view.
 *
 * Data is delta-only: completions come from the offline-first audit fold and
 * certs are passed down from the host (ProfilePage already loads them).
 */
export function MyReadinessSection({ certs }: {
  certs: Certification[]
}) {
  const userId = useAuthStore(s => s.user?.id ?? null)
  const d = useRowDensity()
  const {
    readinessPercent,
    compliancePercent,
    assignments,
    exempt,
  } = useSelfReadiness(certs)

  if (!userId) return null

  return (
    <section>
      <PageSectionHeader>Readiness</PageSectionHeader>

      <div className="space-y-3">
        {/* Readiness + Compliance headline — the same two FillBars, in the same
            order, that the desktop rail's pinned card shows. Readiness drops for
            an exempt user; certifications still bind them, so compliance stays. */}
        <SectionCard className="px-4 py-4 space-y-2.5">
          {!exempt && <FillBar label="Readiness" percent={readinessPercent} />}
          <FillBar label="Compliance" percent={compliancePercent} />
        </SectionCard>

        {/* Assignments — built like a SettingsRow (medallion on mobile, bare icon
            on desktop) because it is the same shape: icon, label, trailing state. */}
        {assignments.length > 0 && (
          <SectionCard>
            {assignments.map((a, i) => {
              const taskTitle = getEvaluableTaskData(a.trainingItemId)?.title ?? a.trainingItemId
              const isCompleted = !!a.completedAt
              const isOverdue = !isCompleted && a.dueDate && new Date(a.dueDate) < new Date()
              const formatDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              const tone = isCompleted ? 'text-themegreen' : isOverdue ? 'text-themeredred' : 'text-themeblue2'
              const toneBg = isCompleted ? 'bg-themegreen/10' : isOverdue ? 'bg-themeredred/10' : 'bg-themeblue3/10'
              return (
                <div key={a.id} className={`flex items-center gap-3 ${d.pad} ${i > 0 ? 'border-t border-tertiary/10' : ''}`}>
                  {d.isMobile ? (
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${toneBg}`}>
                      <ClipboardList size={d.iconSize} className={tone} />
                    </span>
                  ) : (
                    <span className="w-5 shrink-0 flex items-center justify-center">
                      <ClipboardList size={d.iconSize} className={tone} />
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`${d.label} font-medium text-primary truncate`}>{taskTitle}</p>
                    {a.dueDate && (
                      <span className={`block text-[9pt] mt-0.5 ${isCompleted || isOverdue ? tone : 'text-tertiary'}`}>
                        {isCompleted ? 'Done' : isOverdue ? 'Overdue' : 'Due'} {formatDate(a.dueDate)}
                      </span>
                    )}
                  </div>
                  <span className={`text-[9pt] font-medium shrink-0 ${tone}`}>
                    {isCompleted ? 'Complete' : isOverdue ? 'Overdue' : 'Pending'}
                  </span>
                </div>
              )
            })}
          </SectionCard>
        )}

        {/* No per-category competency breakdown and no lifecycle timeline on the
            self view — both stay evaluator-side, in the supervisor drawer, where
            the per-record controls that make them actionable live. */}
      </div>
    </section>
  )
}
