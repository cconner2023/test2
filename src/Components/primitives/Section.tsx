import type { ReactNode, Ref } from 'react'

/**
 * FOUR LABELS, EACH NAMED FOR WHERE IT GOES — NOT FOR ITS DEPTH.
 *
 * <PageSectionHeader> names a top-level block of a scrolling page (Profile,
 * Certifications, Readiness) — quiet tertiary, widest tracking, so it reads as a
 * divider rather than as content. <SectionHeader> names a group INSIDE one of
 * those blocks (Training Competency, Timeline) — primary colour, tighter
 * tracking. Those two only read as a hierarchy while both stay in their lane;
 * a nested group in tertiary/widest flattens the page.
 *
 * <CardLabel> labels a block of content INSIDE a card (the ICTL section title,
 * "Complications", "Key Points"), where the card is already the container and the
 * label only needs to break up prose. Near-zero bottom margin, because a
 * card-internal label on SectionHeader's `mb-2` opens a gap the card was drawn
 * to close.
 *
 * <ListGroupLabel> labels a group of rows in a RAIL or flat list — no card
 * underneath it, so it carries the list's own horizontal padding instead of
 * sitting flush with a card edge.
 *
 * They are named for their surface rather than numbered as levels, so nobody
 * reads this file and concludes there should be a level five.
 *
 * TRAILING CONTENT (a count, a dot, a "latest" badge) is a prop rather than a
 * hand-rolled flex wrapper around the header. Every call site that needed one had
 * built the same `<div className="flex items-center gap-2 mb-2">` by hand, and
 * they disagreed on whether the row centred or aligned to the baseline — baseline
 * is correct, since the header carries a bottom margin the trailing node does not.
 */

interface HeaderProps {
    children: ReactNode
    /** Count, badge or dot rendered beside the title, on its baseline. */
    trailing?: ReactNode
}

/** Standard section header label. Use standalone or via <Section>. */
export function SectionHeader({ children, trailing }: HeaderProps) {
    const label = (
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
            {children}
        </p>
    )
    if (trailing == null) return label
    return <div className="flex items-baseline gap-2">{label}{trailing}</div>
}

/** Top-level page block header. Owns its own bottom spacing, like SectionHeader. */
export function PageSectionHeader({ children, trailing }: HeaderProps) {
    const label = (
        <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest mb-2">
            {children}
        </p>
    )
    if (trailing == null) return label
    return <div className="flex items-baseline gap-2">{label}{trailing}</div>
}

/** Labels a block of content inside a card, with the block as its child. */
export function CardLabel({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider mb-0.5">{label}</p>
            {children}
        </div>
    )
}

/**
 * Group label above a run of rows or cards in a list.
 *
 * Two placements, and only two. `inset` (the default) is the RAIL case: there is
 * no card under the label, so it carries the list's own horizontal padding and
 * lines up with the row text beneath it. `inset={false}` is the CARD-GROUP case:
 * the card below already sets the left edge, so the label only needs the gap.
 */
export function ListGroupLabel({ children, inset = true }: { children: ReactNode; inset?: boolean }) {
    return (
        <p className={`text-[9pt] font-semibold text-tertiary uppercase tracking-wider ${
            inset ? 'px-4 pt-3 pb-1' : 'mb-1.5'
        }`}>
            {children}
        </p>
    )
}

interface SectionProps {
    title: string
    /** Optional count badge rendered beside the title. */
    count?: number
    children: ReactNode
    className?: string
}

/**
 * Groups a section header (with optional count) and its content
 * with standard vertical spacing.
 */
export function Section({ title, count, children, className = 'mb-5' }: SectionProps) {
    return (
        <div className={className}>
            <SectionHeader trailing={count != null ? <span className="text-[9pt] text-tertiary">{count}</span> : undefined}>
                {title}
            </SectionHeader>
            {children}
        </div>
    )
}

interface SectionCardProps {
    children: ReactNode
    className?: string
    /** Makes the whole card activate, as a real <button>. The card-shaped button
     *  was hand-rolled wherever a card was the tap target; it is the same surface,
     *  so it is the same component. */
    onClick?: () => void
    /** Anchor for a popover opened from the card. Only lands on the plain card —
     *  no call site needs a ref on the button form, and a single prop cannot type
     *  both elements. */
    ref?: Ref<HTMLDivElement>
}

/**
 * Standard card container used for roster lists and grouped content.
 * Matches the pattern: rounded-2xl, themewhite2 background (borderless).
 */
export function SectionCard({ children, className, onClick, ref }: SectionCardProps) {
    const classes = `rounded-2xl bg-themewhite2 overflow-hidden ${className ?? ''}`
    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={`w-full text-left transition-all hover:bg-themeblue2/5 active:scale-[0.99] ${classes}`}
            >
                {children}
            </button>
        )
    }
    return <div ref={ref} className={classes}>{children}</div>
}
