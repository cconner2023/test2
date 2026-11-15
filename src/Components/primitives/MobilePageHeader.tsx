import type { ReactNode } from 'react'
import { ChevronLeft, type LucideIcon } from 'lucide-react'

/**
 * Header row for a mobile full page that owns its own chrome — the Messaging
 * conversation pattern (1:1, group, outside contact) and anything mirroring it
 * (Tracking Board BRN page). Bordered circular back button · title · actions.
 *
 * Mobile counterpart of PaneHeader: PaneHeader is the desktop detail-pane row;
 * this is the page-level row that clears the safe area (`--sat`).
 */

/** The bordered circular icon button used in this header (back, group info). */
export function PageCircleButton({ icon: Icon, onClick, label, iconClassName = 'w-6 h-6' }: {
    icon: LucideIcon
    onClick?: () => void
    label: string
    iconClassName?: string
}) {
    return (
        <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 overflow-hidden shrink-0">
            <button
                onClick={onClick}
                className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                aria-label={label}
            >
                <Icon className={`${iconClassName} text-tertiary`} />
            </button>
        </div>
    )
}

/** Conversation title as a capsule (avatar + name), sized to its content so it
 *  reads as one object beside the back button rather than a stretched bar.
 *  Pass as MobilePageHeader `title`. Tappable only when there is somewhere to go. */
export function ConversationTitlePill({ avatar, title, onClick }: {
    avatar: ReactNode
    title: string
    onClick?: () => void
}) {
    const body = (
        <>
            <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 flex items-center justify-center">{avatar}</div>
            <span className="text-[11pt] font-semibold text-primary truncate min-w-0">{title}</span>
        </>
    )
    // inline-flex, not flex: a block-level flex box fills the title slot, which
    // stretched short names (Notes) to the reserve edge instead of fitting them.
    const cls = 'max-w-full rounded-full border border-tertiary/20 bg-themewhite p-0.5 pr-4 inline-flex items-center gap-2.5 overflow-hidden align-middle'
    return onClick
        ? <button onClick={onClick} className={`${cls} active:scale-[0.98] transition-transform`} aria-label={`${title}, conversation info`}>{body}</button>
        : <div className={cls}>{body}</div>
}

/** Stands in for a conversation's two-button call pill when it isn't shown
 *  (Notes, groups, no call permission), so the title pill truncates at the same
 *  point in every conversation. Width = HeaderPill multi: 2 x 43px buttons +
 *  gap + padding + border. Re-measure if PillButton's mobile size changes. */
export function ConversationActionsReserve() {
    return <div className="w-[6.25rem] shrink-0" aria-hidden />
}

interface MobilePageHeaderProps {
    onBack?: () => void
    /** A string renders the standard truncated title; pass a node for custom
     *  layouts (e.g. a group's centered name + member count). */
    title: ReactNode
    /** Right edge — a `<HeaderPill>` or `<PageCircleButton>`. Omitted → a
     *  spacer so the title stays balanced against the back button. */
    actions?: ReactNode
    className?: string
}

export function MobilePageHeader({ onBack, title, actions, className = '' }: MobilePageHeaderProps) {
    return (
        <div className={`shrink-0 px-3 py-2 pt-[max(0.5rem,var(--sat,0px))] flex items-center ${className}`}>
            <PageCircleButton icon={ChevronLeft} onClick={onBack} label="Back" />
            {typeof title === 'string'
                ? <p className="flex-1 text-sm font-medium text-primary truncate mx-3">{title}</p>
                : <div className="flex-1 min-w-0 mx-3">{title}</div>}
            {actions ?? <div className="w-12 shrink-0" />}
        </div>
    )
}
