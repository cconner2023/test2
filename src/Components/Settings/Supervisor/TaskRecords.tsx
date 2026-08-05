import { BookOpen, Check, ClipboardList, Info, MoreHorizontal } from 'lucide-react'
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'
import { ErrorPill } from '@/Components/primitives/ErrorPill'
import { useIsMobile } from '@/Hooks/useIsMobile'
import { formatMedicName, recordItemLabel, type TaskRecord } from './supervisorHelpers'

/**
 * The records held against whatever drill is open — every read, evaluation and
 * assignment on the audit spine, as rows you can open and act on.
 *
 * WHY THIS EXISTS. Everything else in this drawer is a ROLLUP: a coverage bar, a
 * GO badge, a fraction. Those answer "how is the cluster doing" and cannot
 * answer "who wrote this, when, and can I take it back" — but every one of them
 * is folded from records that are individually deletable and editable, exactly
 * the way a property item's lifecycle rides audit_log. A surface that only ever
 * shows the fold's OUTPUT leaves the supervisor unable to correct its INPUT.
 *
 * A LIST, SO THE CENTER. The drawer's contract puts anything you scan in the
 * center and anything you act on one-of in the pane, which is why a row here
 * opens a terminal rather than expanding in place: an expanding row would put a
 * destructive action inside a scrolling list, and the pane is where this drawer
 * already keeps acts that must not be walked away from by re-pointing the rail.
 *
 * THE ROW SAYS WHAT AND WHEN, THEN WHO. The verdict is the ICON — a green check
 * for a GO, a red info for a NO GO — so the row does not also carry a badge
 * saying the same word beside it. The first line is the task and its date in
 * DTG; everything else about the record (the soldier, what kind of record it is,
 * what it is due) is the second line. That ordering is the scan: a supervisor
 * reads down a column of tasks, not a column of names.
 *
 * ACTIONS RIDE THE ELLIPSIS, hover-revealed on desktop and always present on
 * touch — the same row-menu contract as the property tree, and it anchors the
 * host's AnchoredMenu rather than owning one, because a delete needs a confirm
 * and an error surface that outlive the row.
 */

const TYPE_LABEL = {
  read: 'Read',
  test: 'Evaluated',
  assignment: 'Assigned',
} as const

/** DTG date — 02AUG26. The format every other paper the medic touches uses, and
 *  unambiguous in a way "8/2" is not. */
function fmtDtg(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return `${day}${month}${String(d.getFullYear() % 100).padStart(2, '0')}`
}

/** Due dates are date-only strings; parsing one bare lands it in UTC and shows
 *  the previous day west of Greenwich. */
function fmtDueDtg(due: string): string {
  return fmtDtg(new Date(`${due}T00:00:00`))
}

interface TaskRecordsProps {
  records: TaskRecord[]
  /** Open one record's terminal. */
  onOpen: (record: TaskRecord) => void
  /** Open the row's action menu, anchored to the row. Absent where the scope has
   *  no acts to offer — a subordinate cluster's records are a readout. */
  onOpenMenu?: (record: TaskRecord, anchor: DOMRect) => void
  /** Why the last act on a row did not take. Rides above the list because the row
   *  it was refused on is still sitting there unchanged. */
  error?: string | null
  /** Hide the soldier's name — at soldier scope every row is about the same
   *  person, and repeating it down the list says nothing the card has not. */
  hideSoldier?: boolean
  /** What an empty list says. The default speaks for a drill on one item; a week
   *  of the activity graph is empty for a different reason and has to say so. */
  emptyLabel?: string
}

export function TaskRecords({ records, onOpen, onOpenMenu, error, hideSoldier, emptyLabel }: TaskRecordsProps) {
  const isMobile = useIsMobile()

  return (
    <div className="mt-4">
      <SectionHeader>Records</SectionHeader>
      {error && <div className="mb-2"><ErrorPill>{error}</ErrorPill></div>}
      <SectionCard>
        {records.length === 0 ? (
          <p className="px-4 py-4 text-[10pt] text-tertiary">
            {emptyLabel ?? 'Nothing on record yet — a read, an evaluation or an assignment lands here.'}
          </p>
        ) : (
          records.map(({ completion: c, soldier }) => {
            const type = c.completionType as keyof typeof TYPE_LABEL
            const open = type === 'assignment' && !c.completedAt
            const overdue = open && !!c.dueDate && new Date(`${c.dueDate}T00:00:00`) < new Date()
            const noGo = type === 'test' && c.result === 'NO_GO'
            const alert = noGo || overdue

            // A grade's verdict IS its icon. A read and an assignment have no
            // verdict, so they keep the icon that says which of the three the
            // row is — the second line names it in words either way.
            const Icon = type === 'test' ? (noGo ? Info : Check) : type === 'read' ? BookOpen : ClipboardList

            const detail = [
              hideSoldier ? null : formatMedicName(soldier),
              TYPE_LABEL[type],
              open && c.dueDate ? `${overdue ? 'Overdue' : 'Due'} ${fmtDueDtg(c.dueDate)}` : null,
            ].filter(Boolean).join(' · ')

            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                data-record-row
                onClick={() => onOpen({ completion: c, soldier })}
                onKeyDown={(e) => { if (e.key === 'Enter') onOpen({ completion: c, soldier }) }}
                className="group w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer
                           border-t border-tertiary/8 first:border-t-0 transition-colors hover:bg-themeblue2/5"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  alert ? 'bg-themeredred/10' : type === 'test' ? 'bg-themegreen/10' : 'bg-themeblue3/10'
                }`}>
                  <Icon
                    size={14}
                    className={alert ? 'text-themeredred' : type === 'test' ? 'text-themegreen' : 'text-themeblue2'}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[10pt] font-medium text-primary truncate">
                    {recordItemLabel(c.trainingItemId)}
                    <span className="text-tertiary font-normal tabular-nums"> · {fmtDtg(new Date(c.updatedAt))}</span>
                  </p>
                  <p className="text-[9pt] text-tertiary truncate">{detail}</p>
                </div>

                {onOpenMenu && (
                  <button
                    type="button"
                    aria-label="Record actions"
                    onClick={(e) => {
                      e.stopPropagation()
                      const row = (e.currentTarget as HTMLElement).closest('[data-record-row]') as HTMLElement | null
                      onOpenMenu({ completion: c, soldier }, (row ?? e.currentTarget).getBoundingClientRect())
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-tertiary
                                hover:text-primary active:scale-95 transition-all ${
                      isMobile ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                    }`}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                )}
              </div>
            )
          })
        )}
      </SectionCard>
    </div>
  )
}
