import { useState } from 'react'
import { ToggleSwitch } from './ToggleSwitch'
import { HQ_SCOPE_ID, type IntakeLineScope } from '../../lib/eventIntakeService'
import type { SubCluster } from '../../lib/subClusterService'

interface Props {
  initial: IntakeLineScope
  subClusters: SubCluster[]
  /** Lifted so the parent overlay's footer button can submit the edited scope. */
  onChange: (scope: IntakeLineScope) => void
}

/**
 * Routing editor for one intake line — the body of the mint and "Edit routing"
 * overlays.
 *
 * One list, no mode selector. A mode chip made "whole cluster" a separate concept
 * from the sub-unit list, which then had to be kept in sync by hand; here the two
 * are the same statement — tick every row and the line is cluster-wide, and that
 * is what gets stored. There is still no implicit "unset means everyone": a fresh
 * line starts with nothing ticked, because a cluster runs several lines and a
 * silent default is how a new SD line ends up ringing the battalion.
 *
 * HQ/unassigned leads the list. Members sitting in no sub-unit (and loaned-in
 * members, who land in HQ here) are unreachable by any sub-unit tick, so without
 * a row of their own they could only be reached cluster-wide.
 *
 * A sub-unit with nobody in it is a legal target, NOT an error. Supervisors key
 * lines to a structure they are still building toward, so an empty sub-unit is a
 * no-op from the outside and a warning on this side; the caller renders the reach
 * count. Dangling ids (the sub-unit was deleted after the line was scoped) survive
 * the same way — carried in the selection, shown as a count, never silently dropped.
 */
export function IntakeLineScopeEditor({ initial, subClusters, onChange }: Props) {
  const rows = [{ id: HQ_SCOPE_ID, name: 'HQ / unassigned' }, ...subClusters]

  // 'cluster' arrives with an empty id list, so expand it back into a full tick
  // set — the stored shape and the rendered shape are not the same thing.
  const [selected, setSelected] = useState<string[]>(() =>
    initial.scopeMode === 'cluster' ? rows.map((r) => r.id) : initial.subClusters,
  )

  const known = new Set(rows.map((r) => r.id))
  const orphaned = selected.filter((id) => !known.has(id))
  const all = rows.length > 0 && rows.every((r) => selected.includes(r.id))

  const emit = (next: string[]) => {
    setSelected(next)
    const complete = rows.length > 0 && rows.every((r) => next.includes(r.id))
    // scope_members rides through untouched — this surface edits sub-units only,
    // and dropping the named-individual roster here would silently narrow a line.
    onChange(
      complete
        ? { scopeMode: 'cluster', subClusters: [], members: initial.members }
        : { scopeMode: 'sub_clusters', subClusters: next, members: initial.members },
    )
  }

  return (
    <div className="px-3 py-2">
      {rows.map((row, i) => {
        const checked = selected.includes(row.id)
        return (
          <button
            key={row.id}
            type="button"
            onClick={() => emit(checked ? selected.filter((id) => id !== row.id) : [...selected, row.id])}
            className={`flex items-center gap-3 w-full py-2.5 px-1 transition-colors hover:bg-themeblue3/5 ${
              i > 0 ? 'border-t border-tertiary/10' : ''
            }`}
          >
            <span className={`flex-1 min-w-0 text-left text-[10pt] font-medium truncate ${
              checked ? 'text-primary' : 'text-tertiary'
            }`}>
              {row.name}
            </span>
            <ToggleSwitch checked={checked} />
          </button>
        )
      })}

      {all && (
        <p className="text-[9pt] text-tertiary px-1 pt-2">
          Everyone in the cluster receives contact on this line.
        </p>
      )}

      {orphaned.length > 0 && (
        <p className="text-[9pt] text-tertiary/70 px-1 pt-2">
          {orphaned.length} scoped sub-unit{orphaned.length === 1 ? '' : 's'} no longer exist
          {orphaned.length === 1 ? 's' : ''} — reaches nobody until re-scoped.
        </p>
      )}

      {initial.members.length > 0 && (
        <p className="text-[9pt] text-tertiary/70 px-1 pt-2">
          Plus {initial.members.length} named member{initial.members.length === 1 ? '' : 's'}, kept as-is.
        </p>
      )}
    </div>
  )
}
