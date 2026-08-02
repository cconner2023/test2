import type { ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'

/**
 * The roster row, and the group band above it. ONE component for every surface
 * that lists a clinic's people: the calendar's personnel filter, the supervisor
 * rail's cluster tree, and — in reading order if not in markup — the messaging
 * contact list. They were three hand-rolled lists of the same object; a medic's
 * name sat at a different weight in each.
 *
 * Not a TreeRow. That primitive indents to carry level and gives its rows no
 * avatar, which suits a hand receipt's nested stock numbers. People are not a
 * hierarchy you drill — they are a flat list you scan by face, so the group band
 * carries the grouping and the rows stay flush.
 *
 * The left rail is always present and merely uncoloured when unselected. Adding
 * a border on selection alone shifts every row 2px sideways as you pick down a
 * list, which reads as the list flinching.
 */

/** Depth indents the BAND only. Rows stay flush — their avatars already give the
 *  list a left edge, and indenting them would misalign that column. */
function bandIndent(depth: number): string {
  return `${16 + depth * 16}px`
}

interface PersonnelRowProps {
  /** Avatar element, sized by the caller (rails use w-8, chat lists w-10). */
  avatar: ReactNode
  name: string
  /** Credential, loan state — one line under the name. */
  sub?: ReactNode
  /** Draws the left rail and tint. */
  selected?: boolean
  /** Omit for a read-only row (a child cluster's roster the parent cannot act on). */
  onClick?: () => void
  /** Readiness count, unread badge, or the selection check. */
  trailing?: ReactNode
}

export function PersonnelRow({ avatar, name, sub, selected, onClick, trailing }: PersonnelRowProps) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={`w-full flex items-center gap-3 py-2.5 px-4 text-left border-l-2 transition-colors
        disabled:cursor-default enabled:active:scale-[0.99] ${
        selected
          ? 'border-l-themeblue3 bg-themeblue3/8'
          : 'border-l-transparent enabled:hover:bg-secondary/5'
      }`}
    >
      {avatar}
      <div className="flex-1 min-w-0">
        <p className="text-[10pt] text-secondary truncate">{name}</p>
        {sub != null && <p className="text-[9pt] text-tertiary truncate">{sub}</p>}
      </div>
      {trailing}
    </button>
  )
}

interface PersonnelGroupBandProps {
  label: string
  expanded: boolean
  onToggle: () => void
  /** Tapping the label. Calendar selects every member at once; the supervisor
   *  rail re-scopes to the sub-cluster. Omit and the label is inert. */
  onSelect?: () => void
  selected?: boolean
  /** Rollup percentage, or the all-selected check. */
  trailing?: ReactNode
  /** 0 for a top-level band, 1 for one nested under another. */
  depth?: number
}

export function PersonnelGroupBand({
  label,
  expanded,
  onToggle,
  onSelect,
  selected,
  trailing,
  depth = 0,
}: PersonnelGroupBandProps) {
  const identity = (
    <>
      <span className="text-[9pt] font-semibold text-secondary uppercase tracking-wider truncate flex-1">
        {label}
      </span>
      {trailing}
    </>
  )
  return (
    <div
      className={`flex items-center gap-2 py-2 pr-3 border-l-2 border-y border-primary/5 transition-colors ${
        selected ? 'border-l-themeblue3 bg-themeblue3/8' : 'border-l-transparent bg-secondary/5'
      }`}
      style={{ paddingLeft: bandIndent(depth) }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={expanded ? 'Collapse' : 'Expand'}
        className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          className="flex items-center gap-2 flex-1 min-w-0 text-left active:opacity-70"
        >
          {identity}
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-1 min-w-0">{identity}</div>
      )}
    </div>
  )
}

/** The selection tick both filter surfaces put at the end of a chosen row. */
export function PersonnelCheck({ size = 14 }: { size?: number }) {
  return <Check size={size} className="text-themeblue2 shrink-0" />
}
