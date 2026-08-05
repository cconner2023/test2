import type { ReactNode } from 'react'
import { Pencil, type LucideIcon } from 'lucide-react'
import { FillBar } from '@/Components/primitives/FillBar'

/**
 * A rail's pinned context object — whichever subject the rail is currently
 * scoped to. It is the structural analogue of CalendarDrawer's pinned
 * MiniCalendar: one fixed card above a scrolling list stack.
 *
 * TWO RAILS USE IT. The supervisor rail pins the selected soldier or cluster;
 * the desktop settings rail pins YOU — same frame, same two bars, same numbers
 * (both read the supervisor competency helpers). That is the point: the medic's
 * own card and the card their team lead sees are one component.
 *
 * It shows BASICS ONLY. The subject's full contents (certs, assignments,
 * timeline, competency) are the center pane's job, so the card never grows into
 * a second copy of them — that duplication is what this layout exists to remove.
 * Actions are not its job either: they live on the island's FAB, which is scope-
 * aware and so does not need one pill per surface.
 *
 * Identity is a slot because the subjects differ there — a cluster carries a
 * Building2 bubble, a soldier a UserAvatar. What repeats is the frame and the
 * two bars.
 *
 * Bars stack under the centered identity rather than sitting beside it — at the
 * 260px rail width (and inside the mobile sheet) there is no room for the
 * side-by-side w-48 treatment the center-pane cards used.
 *
 * PROFILE LAYOUT: an inset rounded cover with the action in its top-right, the
 * identity overlapping the cover's lower edge, then name and caption centered
 * beneath. Centering is what separates the subject from the rows below it —
 * every list row in the rail is left-aligned with its avatar in the same column,
 * so a centered one cannot be misread as another row.
 *
 * The COVER is the only framed thing here; the identity below it sits on the
 * rail's own ground. That is the whole trick — one rounded panel to anchor the
 * subject, no box drawn around the text and bars, so the card does not read as a
 * second surface competing with the rows for the same 260px.
 *
 * The cover's wash runs top-down and BOTTOMS OUT AT `themewhite2`, never at
 * `themewhite3` and never at transparent. Both of those equal the rail's own
 * `themewhite` ground in the default theme, so the cover lost its bottom edge and
 * the avatar's white circle lost its outline — white on white on white. The floor
 * has to stay a shade the ground is not.
 *
 * Selection tints the cover with the same `themeblue3` wash the rail's rows use
 * when selected, so the pinned subject and a picked row say "current" the one way.
 */
export interface SubjectCardProps {
  /** Avatar or icon bubble, sized by the caller — w-14 h-14, the size the cover
   *  overlap is cut for. It is ringed here rather than by the caller so a photo
   *  and a Building2 bubble get the same halo. */
  icon: ReactNode
  title: string
  /** One caption line — credential plus loan state, and only for a person. A
   *  cluster gets none: a headcount under a title the tree below already lists
   *  is a number nobody acts on. */
  subtitle?: ReactNode
  /** Both bars or neither. A guest has no readiness to show, and a card with one
   *  bar reads as a bar that failed to load. */
  readinessPercent?: number
  compliancePercent?: number
  /** Displaces both bars while the surface is scoped to ONE thing — a selected
   *  ICTL. Readiness and compliance are the subject's whole training; while you
   *  are reading a single task they are the wrong two numbers to leave under the
   *  name, and the task's own coverage is the one you came for. `title` names it
   *  in full above the bar, so the body below can open on its contents. */
  stat?: { title?: string; label: string; percent: number; value?: string }
  /** Activates the card, from the cover's top-right button and nowhere else: the
   *  supervisor opens the subject's edit popover (hence the rect it hands back),
   *  settings opens your profile in the center pane and ignores it. Absent = the
   *  card is inert (a read-only viewer with no edit right) and no button renders.
   *
   *  The card body is deliberately NOT a click target. It is a status readout you
   *  look at constantly and act on rarely, and a full-card button made every
   *  glance at the bars feel like a thing you were about to trigger. */
  onActivate?: (rect: DOMRect) => void
  /** The action's icon and its accessible name. Defaults to a pencil — every
   *  current caller opens an editor. */
  actionIcon?: LucideIcon
  actionLabel?: string
  /** The pinned subject is the selection by definition in the supervisor rail, but
   *  in settings the card is one destination among many — so it can be off.
   *  Reads as the cover taking the accent tint, nothing else. */
  active?: boolean
  /** Cover height, `h-20` in a rail. Taller where the cover has to hold header
   *  pills as well as the corner action. */
  coverHeightClass?: string
  /** Chrome hosted in the cover's top corners. The mobile center hands its drawer
   *  header's pills here and renders NO header of its own: the card is the header
   *  there, so a bar above it would be a second one naming the same subject. The
   *  right slot wins over the `onActivate` button when both are given. */
  coverLeft?: ReactNode
  coverRight?: ReactNode
  /** Pin the cover (and the avatar hanging off it) to the top of the host's
   *  scroller, so the body passes underneath. For the surface where the card is
   *  the header — a header that scrolls away is not one. The name, caption and
   *  bars are NOT pinned: they are the card's contents, and a strip that keeps
   *  the identity while the readout scrolls is the point. */
  stickyCover?: boolean
}

export function SubjectCard({
  icon,
  title,
  subtitle,
  readinessPercent,
  compliancePercent,
  onActivate,
  actionIcon: ActionIcon = Pencil,
  actionLabel = 'Edit',
  active = false,
  coverHeightClass = 'h-20',
  coverLeft,
  coverRight,
  stickyCover = false,
  stat,
}: SubjectCardProps) {
  return (
    // TWO SIBLINGS, NOT ONE BOX. A sticky child only stays put while its PARENT is
    // on screen, so a wrapper around both halves would unpin the cover the moment
    // the card's own height scrolled past — a header that leaves at 250px. As a
    // fragment the cover's parent is the host's scroller, and it holds for the
    // whole scroll.
    //
    // Both halves rise and fade on mount — drawer or sheet open — via the shared
    // AppearIn. Neither replays when the selection changes: React keeps these
    // elements and swaps their contents, which is right, since re-animating the
    // frame on every pick would make the rail twitchy.
    <>
      {/* Cover — inset and rounded, so it is a panel the identity sits on rather
          than a stripe across the rail. Its bottom edge lands at the avatar's
          midline: the overlap is what ties the two together, and an avatar
          clearing the cover entirely would just be an avatar under a stripe.

          Pinned, it also owns the status-bar pad and an OPAQUE `themewhite` base.
          The wash's top stop is an alpha tint, so without a base under it the text
          scrolling past would read straight through the gradient. */}
      <div
        className={`animate-AppearIn ${
          stickyCover
            ? 'sticky top-0 z-20 px-3 pt-[max(0.75rem,var(--sat,0px))] bg-themewhite'
            : 'px-3'
        }`}
      >
        <div
          className={`relative ${coverHeightClass} rounded-xl bg-gradient-to-b transition-colors ${
            active ? 'from-themeblue3/30 to-themeblue3/12' : 'from-themeblue3/18 to-themewhite2'
          }`}
        >
          {coverLeft && <div className="absolute top-2 left-2">{coverLeft}</div>}
          {coverRight && <div className="absolute top-2 right-2">{coverRight}</div>}

          {/* Top right, the one action. Absent when the viewer holds no edit
              right — a dimmed button on a card is a promise nobody can take up. */}
          {onActivate && !coverRight && (
            <button
              type="button"
              onClick={(e) => onActivate(e.currentTarget.getBoundingClientRect())}
              aria-label={actionLabel}
              title={actionLabel}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-themewhite shadow-xs
                flex items-center justify-center text-tertiary
                hover:text-primary active:scale-95 transition-all"
            >
              <ActionIcon size={16} />
            </button>
          )}

          {/* Hung off the cover's bottom edge rather than laid out under it, so it
              rides with a pinned cover and takes no flow space — what follows can
              then scroll behind it. Its own opaque circle is 16px wider than the
              w-14 it holds, and that gutter is the border. */}
          <div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2">
            <div className="w-[72px] h-[72px] rounded-full bg-themewhite flex items-center justify-center">
              {icon}
            </div>
          </div>
        </div>
      </div>

      {/* The card's contents — pinned by nothing, so they pass under the cover.
          The top pad clears the avatar's lower half (36px) plus its gap. */}
      <div className="pb-4 animate-AppearIn">
        <div className="px-4 pt-11 text-center">
          <p className="text-[10pt] font-semibold text-primary truncate">{title}</p>
          {subtitle != null && <p className="text-[9pt] text-tertiary truncate">{subtitle}</p>}
        </div>

        {stat ? (
          <div className="mt-3 px-4">
            {stat.title && (
              <p className="text-[10pt] font-medium text-primary text-center mb-2">{stat.title}</p>
            )}
            {/* w-auto: the label is a hyphenated task number and the default
                column width breaks it across three lines. */}
            <FillBar
              label={stat.label}
              labelWidth="w-auto"
              percent={stat.percent}
              value={stat.value}
            />
          </div>
        ) : (
          // Independent, not paired: a soldier exempt from the medic ICTL roster
          // has no readiness figure but still holds certifications.
          (readinessPercent != null || compliancePercent != null) && (
            <div className="flex flex-col gap-1.5 mt-3 px-4">
              {readinessPercent != null && <FillBar label="Readiness" percent={readinessPercent} />}
              {compliancePercent != null && <FillBar label="Compliance" percent={compliancePercent} />}
            </div>
          )
        )}
      </div>
    </>
  )
}
