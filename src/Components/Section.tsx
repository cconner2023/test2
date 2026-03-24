import type { ReactNode } from 'react'

/**
 * Standard section header label.
 * Use standalone or via the <Section> compound primitive.
 */
export function SectionHeader({ children }: { children: ReactNode }) {
    return (
        <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-1.5">
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
            <div className="flex items-center gap-2 mb-2">
                <SectionHeader>{title}</SectionHeader>
                {count != null && (
                    <span className="text-[10px] text-tertiary/40">{count}</span>
                )}
            </div>
            {children}
        </div>
    )
}

/**
 * Standard card container used for roster lists and grouped content.
 * Matches the pattern: rounded-2xl, subtle border, themewhite2 background.
 */
export function SectionCard({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={`rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden ${className ?? ''}`}>
            {children}
        </div>
    )
}
