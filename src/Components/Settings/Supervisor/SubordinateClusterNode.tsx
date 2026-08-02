import { useEffect, useState } from 'react'
import { PersonnelRow, PersonnelGroupBand } from '@/Components/primitives/PersonnelRow'
import type { TreeSelection } from './SupervisorTree'
import { UserAvatar } from '../UserAvatar'
import { clinicMemberName } from './supervisorHelpers'
import { listClinicMembers, type ClinicMember } from '../../../lib/supervisorService'
import type { ChildClinicCard } from '../../../Hooks/useEchelonSummaries'

/**
 * One subordinate cluster in the supervisor rail, rendered to read exactly like
 * an own-cluster sub-section: expand it and the personnel list out with their
 * readiness, collapse it and only the cluster's rollup shows.
 *
 * The two halves come from different places, which is the whole reason this is
 * its own component. NAMES come from the subtree-authorized supervisor RPC — the
 * parent has always been allowed to see who is in a child cluster. NUMBERS come
 * from the summary the child fanned up, because the events behind them are
 * sealed in the child's vault and the parent cannot compute them. Neither source
 * alone renders a row.
 *
 * The roster fetch is deferred to first expand: a parent with several children
 * would otherwise pay N round-trips to paint a collapsed list.
 *
 * READ-ONLY, structurally. Tapping the cluster NAME selects it as a scope, and a
 * member row selects that person — both only re-point the card. Roster operations
 * (add, remove, edit a member) are cluster management and live in that drawer;
 * this one only ever views training down the subtree.
 *
 * A child soldier is selectable because the fan-up is attributed: `summary.
 * soldiers` carries per-person readiness and cert percentages keyed by user_id
 * (see the ⚠️ note on EchelonReadinessSummary). What the parent still does not
 * have is the training records behind them — so the card shows the two numbers
 * and the center pane has nothing further to drill.
 */

export function SubordinateClusterNode({
  card,
  selection,
  onSelect,
}: {
  card: ChildClinicCard
  selection: TreeSelection
  onSelect: (selection: TreeSelection) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [members, setMembers] = useState<ClinicMember[] | null>(null)

  useEffect(() => {
    if (!expanded || members) return
    let cancelled = false
    listClinicMembers(card.clinicId).then((res) => {
      if (cancelled || !res.success) return
      setMembers(res.members)
    })
    return () => { cancelled = true }
  }, [expanded, members, card.clinicId])

  const byUser = new Map((card.summary?.soldiers ?? []).map((s) => [s.user_id, s]))

  // Worst-first, matching the own-cluster rows. A child soldier the summary has
  // no row for reads 0 and sorts to the top — an unpublished person is a gap,
  // not a pass.
  const rows = [...(members ?? [])].sort((a, b) => {
    const ar = byUser.get(a.id)?.readiness_pct ?? 0
    const br = byUser.get(b.id)?.readiness_pct ?? 0
    return ar - br || clinicMemberName(a).localeCompare(clinicMemberName(b))
  })

  return (
    <div>
      <PersonnelGroupBand
        depth={1}
        label={card.clinicName}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
        selected={selection.type === 'child-cluster' && selection.clinicId === card.clinicId}
        onSelect={() => onSelect({ type: 'child-cluster', clinicId: card.clinicId, name: card.clinicName })}
      />
      {expanded && members === null && (
        <p className="text-[9pt] text-tertiary py-2 px-4">Loading…</p>
      )}
      {expanded && members !== null && rows.length === 0 && (
        <p className="text-[9pt] text-tertiary py-2 px-4">No members assigned.</p>
      )}
      {/* No per-person percentage on the row. The rollup on the band above is the
          number a parent echelon acts on; twenty of them down a 260px rail is
          noise you read past. The summary still ORDERS the list — worst first —
          and selecting a row puts that person's numbers on the card. */}
      {expanded && rows.map((m) => (
        <PersonnelRow
          key={m.id}
          avatar={
            <UserAvatar
              avatarId={m.avatar_id}
              firstName={m.first_name}
              lastName={m.last_name}
              className="w-8 h-8"
            />
          }
          name={clinicMemberName(m)}
          sub={m.credential}
          selected={selection.type === 'child-soldier' && selection.soldier.id === m.id}
          onClick={() => onSelect({
            type: 'child-soldier',
            clinicId: card.clinicId,
            soldier: {
              id: m.id,
              name: clinicMemberName(m),
              firstName: m.first_name,
              lastName: m.last_name,
              credential: m.credential,
              avatarId: m.avatar_id,
            },
          })}
        />
      ))}
    </div>
  )
}
