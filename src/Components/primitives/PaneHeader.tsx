import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'

/**
 * Header row for a desktop detail pane (the `side="right"` half of a
 * SlideRevealPane split, or a full-pane overlay inside one).
 *
 * WHY this exists: a detail pane owns its own chrome. The drawer header names
 * the DRAWER; hoisting a pane's title and back affordance up there retitles the
 * whole surface after a drill and strands the dismiss control a pane-width away
 * from the thing it dismisses. Calendar, Property and Map all reached the same
 * conclusion independently and hand-rolled this row 21 times between them, with
 * three different paddings and three different title treatments. This is that
 * row, once.
 *
 * The canonical treatment is Map's: `px-3 py-2`, `text-[10pt] font-semibold`.
 * The `text-sm` titles the other consumers drifted to are sub-`text-base` and so
 * violate the pt-notation font floor (v2/conventions).
 *
 * Actions stay a slot rather than a prop shape — every pane's action set is
 * genuinely different, and they are already expressed as `<HeaderPill>` +
 * `PillButton`. What repeats is the row, not its contents.
 */
interface PaneHeaderProps {
    /** Primary label. Omit (with no eyebrow/subtitle) for a title-less row — an
     *  edit mode whose body input owns the name, e.g. the map FeatureEditor. */
    title?: ReactNode
    /** Above the title: a breadcrumb node, or a string rendered as dense caption text. */
    eyebrow?: ReactNode
    /** Below the title, same caption treatment as a string eyebrow. */
    subtitle?: ReactNode
    /** Renders a leading ChevronLeft that pops one layer. Omit for a root pane. */
    onBack?: () => void
    backLabel?: string
    /** Between the back button and the title — a menu trigger or a lone action. */
    leading?: ReactNode
    /** Right edge. Pass a `<HeaderPill>`; PaneHeader does not wrap it, so the
     *  pill's own multi-child detection keeps working. */
    actions?: ReactNode
    className?: string
}

const CAPTION = 'truncate text-[9pt] text-tertiary'

export function PaneHeader({
    title,
    eyebrow,
    subtitle,
    onBack,
    backLabel = 'Back',
    leading,
    actions,
    className = '',
}: PaneHeaderProps) {
    const hasLabel = title != null || eyebrow != null || subtitle != null

    return (
        <div className={`shrink-0 flex items-center gap-2 px-3 py-2 border-b border-tertiary/10 ${className}`}>
            {onBack && (
                <button
                    type="button"
                    onClick={onBack}
                    aria-label={backLabel}
                    className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                >
                    <ChevronLeft size={20} />
                </button>
            )}
            {leading}
            {hasLabel ? (
                <div className="flex-1 min-w-0">
                    {eyebrow != null && <div className={`${CAPTION} mb-0.5`}>{eyebrow}</div>}
                    {title != null && <div className="truncate text-[10pt] font-semibold text-primary">{title}</div>}
                    {subtitle != null && <div className={`${CAPTION} mt-0.5`}>{subtitle}</div>}
                </div>
            ) : (
                <div className="flex-1" />
            )}
            {actions}
        </div>
    )
}
