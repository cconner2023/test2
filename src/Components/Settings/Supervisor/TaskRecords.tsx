import { BookOpen, ClipboardCheck, ClipboardList } from 'lucide-react'
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'
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
 * BADGE ONLY WHAT A GLANCE NEEDS. A grade's result is the fact the whole row is
 * about, so it is badged; a read has no result worth naming (it happened, and
 * the row's presence says so) and an assignment's state is its due date. The
 * same restraint as the roster's GO/NO-GO, which badges neither untested nor
 * everything.
 */

const TYPE_ICON = {
  read: BookOpen,
  test: ClipboardCheck,
  assignment: ClipboardList,
} as const

const TYPE_LABEL = {
  read: 'Read',
  test: 'Evaluated',
  assignment: 'Assigned',
} as const

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  })
}

/** Due dates are date-only strings; parsing one bare lands it in UTC and shows
 *  the previous day west of Greenwich. */
function fmtDueDate(due: string): string {
  return new Date(`${due}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface TaskRecordsProps {
  records: TaskRecord[]
  /** Open one record's terminal. */
  onOpen: (record: TaskRecord) => void
  /** Hide the soldier's name — at soldier scope every row is about the same
   *  person, and repeating it down the list says nothing the card has not. */
  hideSoldier?: boolean
  /** Name the training item on each row. On a single ICTL every record is
   *  against that one packet, so the label is noise; on an algorithm the rows
   *  span the run and its graded dimensions, and without it they read alike. */
  showItem?: boolean
}

export function TaskRecords({ records, onOpen, hideSoldier, showItem }: TaskRecordsProps) {
  return (
    <div className="mt-4">
      <SectionHeader>Records</SectionHeader>
      <SectionCard>
        {records.length === 0 ? (
          <p className="px-4 py-4 text-[10pt] text-tertiary">
            Nothing on record yet — a read, an evaluation or an assignment lands here.
          </p>
        ) : (
          records.map(({ completion: c, soldier }) => {
            const type = c.completionType as keyof typeof TYPE_ICON
            const Icon = TYPE_ICON[type] ?? ClipboardList
            const open = type === 'assignment' && !c.completedAt
            const overdue = open && !!c.dueDate && new Date(`${c.dueDate}T00:00:00`) < new Date()
            const noGo = type === 'test' && c.result === 'NO_GO'

            return (
              <button
                key={c.id}
                onClick={() => onOpen({ completion: c, soldier })}
                className="w-full flex items-center gap-3 px-4 py-3 text-left border-t border-tertiary/8
                           first:border-t-0 transition-all hover:bg-themeblue2/5 active:scale-95"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  noGo ? 'bg-themeredred/10' : overdue ? 'bg-themeredred/10' : 'bg-themeblue3/10'
                }`}>
                  <Icon size={14} className={noGo || overdue ? 'text-themeredred' : 'text-themeblue2'} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[10pt] font-medium text-primary truncate">
                    {hideSoldier ? TYPE_LABEL[type] : formatMedicName(soldier)}
                  </p>
                  <p className="text-[9pt] text-tertiary truncate">
                    {[
                      hideSoldier ? null : TYPE_LABEL[type],
                      showItem ? recordItemLabel(c.trainingItemId) : null,
                      open && c.dueDate
                        ? `${overdue ? 'Overdue' : 'Due'} ${fmtDueDate(c.dueDate)}`
                        : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>

                {type === 'test' && (
                  <span className={`text-[9pt] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    noGo ? 'bg-themeredred/10 text-themeredred' : 'bg-themegreen/10 text-themegreen'
                  }`}>
                    {noGo ? 'NO GO' : 'GO'}
                  </span>
                )}

                <span className="text-[9pt] text-tertiary shrink-0 tabular-nums">
                  {fmtDate(c.updatedAt)}
                </span>
              </button>
            )
          })
        )}
      </SectionCard>
    </div>
  )
}
